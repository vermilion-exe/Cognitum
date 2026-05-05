import { createContext, useContext, useEffect, useState } from "react";
import { SyncStatus } from "../types/SyncStatus";
import { RequestNote } from "../types/RequestNote";
import { useActiveFile } from "./ActiveFileContext";
import { areSamePath, collectAllNodes, isImage, normalizePath, toRelativePath } from "../utils/fsUtils";
import { invoke } from "@tauri-apps/api/core";
import { useUser } from "./UserContext";
import { ResponseSummary } from "../types/ResponseSummary";
import { ResponseHighlight } from "../types/ResponseHighlight";
import { RequestSyncProgress } from "../types/RequestSyncProgress";
import { SyncOperation } from "../types/SyncOperation";
import { useSyncManager } from "../hooks/useSyncManager";
import { join } from "@tauri-apps/api/path";
import { useToast } from "../hooks/useToast";
import { FsNode } from "../types/FsNode";
import { useVault } from "./VaultContext";
import { ResponseFlashcard } from "../types/ResponseFlashcard";
import { ResponseAttachment } from "../types/ResponseAttachment";

type SyncContextType = {
    status: SyncStatus;
    setStatus: (s: SyncStatus) => void;
    syncEnabled: boolean;
    setSyncEnabled: (enabled: boolean) => void;
    currentNote: RequestNote | null;
    setCurrentNote: (note: RequestNote) => void;
    isNoteLoading: boolean;
    setIsNoteLoading: (loading: boolean) => void;
    lastSyncTimestamp: number | null;
    triggerFullSync: () => Promise<void>;
    fetchUpdates: (timestampOverride?: number | null) => Promise<void>;
};

type NodeWithRelativePath = {
    node: FsNode;
    relativePath: string | undefined;
};

type ImageWithRelativePath = {
    image: FsNode;
    relativePath: string | undefined;
};

const SyncContext = createContext<SyncContextType>({
    status: "idle",
    setStatus: () => { },
    syncEnabled: false,
    setSyncEnabled: () => { },
    currentNote: null,
    setCurrentNote: () => { },
    isNoteLoading: false,
    setIsNoteLoading: () => { },
    lastSyncTimestamp: null,
    triggerFullSync: async () => { },
    fetchUpdates: async () => { }
});

export function SyncProvider({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<SyncStatus>("idle");
    const [syncEnabled, setSyncEnabled] = useState(false);
    const [syncLoaded, setSyncLoaded] = useState(false);
    const [currentNote, setCurrentNote] = useState<RequestNote | null>(null);
    const { root, setRoot, markAppFileWrite } = useVault();
    const [isNoteLoading, setIsNoteLoading] = useState(false);
    const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number | null>(null);
    const { scheduleSync } = useSyncManager();
    const { setActiveFileId, activeFileId } = useActiveFile();
    const { user } = useUser();
    const toast = useToast();

    async function getCurrentNote() {
        // Load the DB note for the active file, or create one if missing
        const relativePath = await toRelativePath(activeFileId);
        setIsNoteLoading(true);
        try {
            const note = await invoke<RequestNote | null>("get_note_by_path", { path: relativePath });
            setCurrentNote(note);
        }
        catch {
            const text = await invoke("read_file", { path: activeFileId! });
            const now = new Date().toISOString();
            const createdNote = await invoke<RequestNote>("create_note", { request: { id: null, text: text, path: relativePath, created_at: now, last_updated: now } });
            setCurrentNote(createdNote);
        }
        finally {
            setIsNoteLoading(false);
        }
    }

    useEffect(() => {
        async function loadSyncEnabled() {
            if (!user) return;
            // Read the saved sync setting once the user is available
            console.log("loading sync enabled");
            const cfg = await invoke<{ syncEnabled?: boolean }>("load_config");
            console.log(cfg.syncEnabled);
            if (cfg.syncEnabled) {
                setSyncEnabled(cfg.syncEnabled);
            }
            else {
                await invoke("delete_sync_data");
            }
            setSyncLoaded(true);
        }

        loadSyncEnabled();
    }, [user]);

    useEffect(() => {
        if (!syncLoaded) return;

        async function saveSyncEnabled() {
            // Persist sync toggle changes after the initial load
            await invoke("save_sync_enabled", { syncEnabled: syncEnabled });
        }

        saveSyncEnabled();
    }, [syncEnabled, syncLoaded]);

    useEffect(() => {
        // Refresh the current note when the active file changes
        if (!activeFileId || !syncEnabled || status === "syncing") {
            setCurrentNote(null);
            return;
        }

        getCurrentNote();
    }, [activeFileId, syncEnabled, status]);

    useEffect(() => {
        if (status === "syncing") toast.info("Sync in progress..");
        else if (status === "error") toast.error("Sync failed");
    }, [status]);

    const updateSyncEnabled = async (enabled: boolean) => {
        if (!user) return;
        setSyncEnabled(enabled);
        if (!enabled) await invoke("delete_sync_data");
    }

    const replayOfflineQueue = async () => {
        // Re-schedule operations saved while the app was offline
        invoke<Record<string, SyncOperation>>("load_sync_queue")
            .then((saved) => {
                if (!saved) return;
                console.log("Replaying offline queue");
                Object.entries(saved).forEach(([key, op]) => {
                    scheduleSync(key, op);
                })
            });
    }

    useEffect(() => {
        // Store the latest successful sync time locally
        if (!lastSyncTimestamp || lastSyncTimestamp === null) return;
        invoke("save_sync_timestamp", { timestamp: new Date(lastSyncTimestamp!).toISOString() });
    }, [lastSyncTimestamp]);

    const handleSync = async () => {
        // Decide whether to resume a full sync or fetch recent changes
        const timestamp = await invoke<string | null>("load_sync_timestamp");
        const loadedTimestamp = timestamp ? new Date(timestamp).getTime() : null;
        setLastSyncTimestamp(loadedTimestamp);

        if (!timestamp || timestamp === null) {
            console.log("No previous sync, performing full sync.");
            const progress = await invoke<RequestSyncProgress | null>("load_sync_progress");
            if (progress) {
                await triggerFullSync(progress);
                await replayOfflineQueue();
            }
            else {
                await triggerFullSync();
                await replayOfflineQueue();
            }
        }
        else {
            console.log("Sync timestamp found, fetching updates.");
            await fetchUpdates(loadedTimestamp);
            await replayOfflineQueue();
        }
    }

    const createFullSyncProgress = (progress?: RequestSyncProgress) => {
        return progress ?? { completed_note_ids: [], started_at: new Date().toISOString() };
    };

    const loadFullSyncData = async () => {
        // Collect DB notes, attachments, and current vault files
        console.log("Getting notes from DB.");
        const db_notes = await invoke<RequestNote[]>("get_all_notes");
        const db_images = await invoke<ResponseAttachment[]>("get_attachments");

        console.log("Getting local notes.");
        const children = await invoke<FsNode[]>("scan_dir", {
            path: root?.id!,
            recursive: true,
        });

        setRoot({
            id: root!.id,
            name: root!.name,
            kind: "dir",
            children,
            lastModified: root!.lastModified
        });

        let nodes = collectAllNodes(children);
        const images = nodes.filter((node) => isImage(root, node.id));

        nodes = nodes.filter((node) => node.kind === "file" && node.extension === "md");
        const nodes_with_paths = await Promise.all(
            nodes.map(async (node) => ({
                node,
                relativePath: await toRelativePath(node.id),
            }))
        );

        return { db_notes, db_images, nodes_with_paths, images };
    };

    const getLocalLastUpdated = async (fullPath: string | undefined, matchedNode?: NodeWithRelativePath) => {
        // Prefer saved note timestamps, falling back to file modified time
        console.log("Getting timestamp");
        const localTimestamp = await invoke<string | null>("get_local_note_timestamp", { path: fullPath });
        console.log("Could get timestamp");
        const localLastUpdated = localTimestamp ? new Date(localTimestamp) : (matchedNode?.node.lastModified ? new Date(matchedNode?.node.lastModified) : null);

        return { localTimestamp, localLastUpdated };
    };

    const uploadExistingLocalSummary = async (note: RequestNote, fileId: string) => {
        // Copy an existing local summary into the DB
        const summary = await invoke<string | null>("get_local_summary", { fileId });
        if (summary !== null) {
            let id: ResponseSummary["id"] | null = null;
            try {
                const existingSummary = await invoke<ResponseSummary | null>("get_summary_by_note_id", { noteId: note.id });
                id = existingSummary && existingSummary.id;
            }
            catch (_) { }

            await invoke("create_summary", { request: { id: id, summary: summary, note_id: note.id } });
        }
    };

    const uploadExistingLocalHighlights = async (note: RequestNote, fullPath: string | undefined, localFileId: string) => {
        // Copy local highlights and explanations into the DB
        const highlights = await invoke<ResponseHighlight[] | null>("read_highlights", { fileId: fullPath });
        if (highlights !== null && highlights.length !== 0) {
            try {
                await invoke("delete_explanations_except", { ids: highlights.map((h) => h.id) });
            }
            catch (e) {
                // If explanations do not exist in DB, delete all
                await invoke("delete_all_note_explanations", { noteId: note.id });
            }

            await Promise.all(highlights.map(async (h) => {
                await invoke("create_explanation", { request: { ...h, note_id: note.id } });
            }));

            const local_note_id = highlights[0].note_id;
            if (local_note_id !== note.id) {
                await invoke("save_highlights", { fileId: localFileId, highlights: highlights.map((h) => ({ ...h, note_id: note.id })) });
            }
        }
        else {
            await invoke("delete_all_note_explanations", { noteId: note.id });
        }
    };

    const uploadExistingLocalFlashcards = async (note: RequestNote, fullPath: string | undefined) => {
        // Copy local flashcards into the DB
        const flashcards = await invoke<ResponseFlashcard[] | null>("load_local_flashcards", { fileId: fullPath });
        if (flashcards !== null && flashcards.length !== 0) {
            try {
                await invoke("delete_flashcards_except", { ids: flashcards.map((f) => f.id) });
            }
            catch (e) {
                // If flashcards do not exist in DB, delete all
                await invoke("delete_all_flashcards_by_note_id", { noteId: note.id });
            }

            await invoke("create_flashcard", { request: flashcards.map((f) => ({ ...f, note_id: note.id })) });

            const local_note_id = flashcards[0].note_id;
            if (local_note_id !== note.id) {
                await invoke("save_local_flashcards", { fileId: fullPath, flashcards: flashcards.map((f) => ({ ...f, note_id: note.id })) });
            }
        }
        else {
            await invoke("delete_all_flashcards_by_note_id", { noteId: note.id });
        }
    };

    const uploadExistingLocalNote = async (note: RequestNote, matchedNode: NodeWithRelativePath, fullPath: string | undefined, localTimestamp: string | null) => {
        // Local version won the timestamp check, so upload it
        console.log("Local note is newer for note with path", note.path);
        const text = await getNoteText(note.path);
        await invoke("create_note", { request: { id: note.id, text: text, path: note.path, created_at: note.created_at, last_updated: localTimestamp } });

        await uploadExistingLocalSummary(note, matchedNode.node.id);
        await uploadExistingLocalHighlights(note, fullPath, matchedNode.node.id);
        await uploadExistingLocalFlashcards(note, fullPath);
        console.log("Uploaded local note to DB");
    };

    const downloadDbNote = async (note: RequestNote, fullPath: string | undefined) => {
        // DB version won the timestamp check, so write it locally
        console.log("DB note is newer for note with path", note.path);
        if (areSamePath(activeFileId, fullPath))
            setActiveFileId(undefined);
        markAppFileWrite(fullPath!);
        await invoke("create_file", { path: fullPath, contents: note.text });

        await invoke("save_note_timestamp", { path: fullPath, timestamp: note.last_updated });

        try {
            const summary = await invoke<ResponseSummary>("get_summary_by_note_id", { noteId: note.id });
            await invoke("save_summary", { fileId: fullPath, summary: summary.summary });
        }
        catch (_) { }

        const highlights = await invoke<ResponseHighlight[]>("get_explanations_by_note_id", { noteId: note.id });
        await invoke("remove_local_highlights", { fileId: fullPath });
        await invoke("save_highlights", { fileId: fullPath, highlights });

        const flashcards = await invoke<ResponseFlashcard[]>("get_flashcards_by_note_id", { noteId: note.id });
        await invoke("remove_local_flashcards", { fileId: fullPath });
        await invoke("save_local_flashcards", { fileId: fullPath, flashcards: flashcards });
        console.log("Downloaded DB note");
    };

    const syncDbNote = async (note: RequestNote, nodes_with_paths: NodeWithRelativePath[], progress: RequestSyncProgress) => {
        // Sync one DB note against its matching local file
        if (progress.completed_note_ids.includes(note.id!)) return;

        const matchedNode = nodes_with_paths.find(
            ({ relativePath }) => areSamePath(relativePath, note.path)
        );
        const fullPath = await getFullPath(note.path);
        const { localTimestamp, localLastUpdated } = await getLocalLastUpdated(fullPath, matchedNode);

        if (matchedNode && localLastUpdated && localLastUpdated > new Date(note.last_updated)) {
            await uploadExistingLocalNote(note, matchedNode, fullPath, localTimestamp);
        }
        else if ((matchedNode && localLastUpdated && (localLastUpdated < new Date(note.last_updated))) || !matchedNode || !localLastUpdated) {
            await downloadDbNote(note, fullPath);
        }

        progress.completed_note_ids.push(note.id!);
        await invoke("save_sync_progress", { progress });
    };

    const syncDbNotes = async (db_notes: RequestNote[], nodes_with_paths: NodeWithRelativePath[], progress: RequestSyncProgress) => {
        // Process notes that already exist in the DB
        if (db_notes.length !== 0) {
            console.log("Found DB notes, syncing.");
        }

        await Promise.all(db_notes.map(async (note) => {
            await syncDbNote(note, nodes_with_paths, progress);
        }));
    };

    const uploadNewLocalNoteSummary = async (noteId: bigint, fileId: string) => {
        // Upload summary data for a newly discovered local note
        console.log("Checking summaries");
        const summary = await invoke<string | null>("get_local_summary", { fileId });
        if (summary !== null && summary !== "") {
            console.log("Found summary, uploading");
            await invoke("create_summary", { request: { id: null, summary: summary, note_id: noteId } });
        }
    };

    const uploadNewLocalNoteHighlights = async (noteId: bigint, fileId: string) => {
        // Upload highlights for a newly discovered local note
        console.log("Checking highlights");
        const highlights = await invoke<ResponseHighlight[] | null>("read_highlights", { fileId });
        if (highlights !== null && highlights.length !== 0) {
            console.log("Found highlights, uploading");
            await Promise.all(highlights.map(async (h) => {
                await invoke("create_explanation", { request: { ...h, note_id: noteId } });
            }));

            const local_note_id = highlights[0].note_id;
            if (local_note_id !== noteId) {
                await invoke("save_highlights", { fileId, highlights: highlights.map((h) => ({ ...h, note_id: noteId })) });
            }
        }
    };

    const uploadNewLocalNoteFlashcards = async (noteId: bigint, fileId: string) => {
        // Upload flashcards for a newly discovered local note
        console.log("Checking flashcards");
        const flashcards = await invoke<ResponseFlashcard[] | null>("load_local_flashcards", { fileId });
        if (flashcards !== null && flashcards.length !== 0) {
            console.log("Found flashcards");
            await invoke("create_flashcard", { request: flashcards.map((f) => ({ ...f, note_id: noteId })) });

            const local_note_id = flashcards[0].note_id;
            if (local_note_id !== noteId) {
                await invoke("save_local_flashcards", { fileId, flashcards: flashcards.map((f) => ({ ...f, note_id: noteId })) });
            }
        }
    };

    const uploadNewLocalNote = async (node_with_path: NodeWithRelativePath, progress: RequestSyncProgress) => {
        // Create a DB note for a local markdown file that is not synced yet
        console.log("Note does not exist in DB with path", node_with_path.relativePath);
        const text = await getNoteText(node_with_path.relativePath!);

        const localTimestamp = await invoke<string | null>("get_local_note_timestamp", { path: node_with_path.node.id });
        const createdNote = await invoke<RequestNote>("create_note",
            { request: { id: null, text: text, path: node_with_path.relativePath, created_at: new Date().toISOString(), last_updated: localTimestamp } });

        console.log("created note");

        await uploadNewLocalNoteSummary(createdNote.id!, node_with_path.node.id);
        await uploadNewLocalNoteHighlights(createdNote.id!, node_with_path.node.id);
        await uploadNewLocalNoteFlashcards(createdNote.id!, node_with_path.node.id);

        console.log("Uploaded local note to DB");
        progress.completed_note_ids.push(createdNote.id!);
    };

    const syncNewLocalNotes = async (nodes_with_paths: NodeWithRelativePath[], db_notes: RequestNote[], progress: RequestSyncProgress) => {
        // Find local markdown files that do not exist in the DB yet
        if (nodes_with_paths.length !== 0) {
            console.log("Local notes found, syncing.");
        }

        await Promise.all(nodes_with_paths.map(async (node_with_path) => {
            const db_exists = db_notes.some(file => areSamePath(file.path, node_with_path.relativePath));

            if (!db_exists) {
                await uploadNewLocalNote(node_with_path, progress);
            }

            await invoke("save_sync_progress", { progress });
            console.log("saved progress");
        }));
    };

    const collectImagesWithPaths = async (images: FsNode[]) => {
        // Attach vault-relative paths to image nodes
        return await Promise.all(
            images.map(async (image) => ({
                image,
                relativePath: await toRelativePath(image.id),
            }))
        );
    };

    const syncDbImages = async (db_images: ResponseAttachment[], images_with_paths: ImageWithRelativePath[]) => {
        // Sync attachments that already exist in the DB
        await Promise.all(db_images.map(async (image) => {
            const matchedImage = images_with_paths.find(
                ({ relativePath }) => areSamePath(relativePath, image.path)
            );

            console.log("here");
            if (matchedImage && (new Date(matchedImage.image.lastModified!) > new Date(image.last_updated))) {
                const lastModified = !matchedImage.image.lastModified ? null : new Date(matchedImage.image.lastModified).toISOString();
                await invoke("create_attachment", { request: { file_path: matchedImage.image.id, relative_path: image.path, last_updated: lastModified } });
            }
            else if ((matchedImage && (new Date(matchedImage.image.lastModified!) < new Date(image.last_updated))) || !matchedImage) {
                const fullPath = matchedImage ? matchedImage.image.id : await getFullPath(image.path);
                if (matchedImage) await invoke("delete_file", { path: fullPath });
                await invoke("create_image", { path: fullPath, contents: Array.from(image.bytes) });
            }
        }));
    };

    const syncNewLocalImages = async (images_with_paths: ImageWithRelativePath[], db_images: ResponseAttachment[]) => {
        // Upload local images that do not exist in the DB yet
        await Promise.all(images_with_paths.map(async (image_with_path) => {
            const db_exists = db_images.some(image => areSamePath(image.path, image_with_path.relativePath));

            if (!db_exists) {
                const lastModified = !image_with_path.image.lastModified ? null : new Date(image_with_path.image.lastModified).toISOString();
                await invoke("create_attachment", { request: { file_path: image_with_path.image.id, relative_path: image_with_path.relativePath, last_updated: lastModified } });
            }
        }));
    };

    const triggerFullSync = async (progress?: RequestSyncProgress) => {
        // Run the full two-way sync for notes and images
        if (!user) return;

        setStatus("syncing");
        progress = createFullSyncProgress(progress);

        try {
            const { db_notes, db_images, nodes_with_paths, images } = await loadFullSyncData();

            await syncDbNotes(db_notes, nodes_with_paths, progress);
            await syncNewLocalNotes(nodes_with_paths, db_notes, progress);

            const images_with_paths = await collectImagesWithPaths(images);
            await syncDbImages(db_images, images_with_paths);
            await syncNewLocalImages(images_with_paths, db_images);

            setLastSyncTimestamp(Date.now());
            await invoke("clear_sync_progress");
            setStatus("idle");
        } catch (e) {
            setStatus("error");
            console.error("Full sync failed:", e);
        }
    };

    const fetchUpdates = async (timestampOverride?: number | null) => {
        // Fetch notes changed since the last successful sync
        if (!user) return;
        const syncTimestamp = timestampOverride ?? lastSyncTimestamp;
        if (!syncTimestamp || syncTimestamp === null || syncTimestamp === 0) return;
        setStatus("syncing");

        try {
            const since = new Date(syncTimestamp).toISOString();
            const new_notes = await invoke<RequestNote[]>("get_notes_since", { since: since });
            const children = root?.id ? await invoke<FsNode[]>("scan_dir", {
                path: root.id!,
                recursive: true,
            }) : [];
            const nodes_with_paths = await Promise.all(
                collectAllNodes(children)
                    .filter((node) => node.kind === "file" && node.extension === "md")
                    .map(async (node) => ({
                        node,
                        relativePath: await toRelativePath(node.id),
                    }))
            );

            if (root) {
                setRoot({
                    id: root.id,
                    name: root.name,
                    kind: "dir",
                    children,
                    lastModified: root.lastModified
                });
            }

            await Promise.all(new_notes.map(async (note) => {
                const fullPath = await getFullPath(note.path);
                const matchedNode = nodes_with_paths.find(
                    ({ relativePath }) => areSamePath(relativePath, note.path)
                );

                const localTimestamp = await invoke<string | null>("get_local_note_timestamp", { path: fullPath });
                const localLastUpdated = localTimestamp ? new Date(localTimestamp) : (matchedNode?.node.lastModified ? new Date(matchedNode?.node.lastModified) : null);
                if (matchedNode && localLastUpdated && localLastUpdated > new Date(note.last_updated)) {
                    const text = await invoke<string>("read_file", { path: fullPath });

                    await invoke<RequestNote>("create_note", {
                        request: { ...note, text, last_updated: localTimestamp }
                    });
                    return;
                }

                markAppFileWrite(fullPath!);
                await invoke("create_file", { path: fullPath, contents: note.text });
                await invoke("save_note_timestamp", { path: fullPath, timestamp: note.last_updated });

                try {
                    const summary = await invoke<ResponseSummary>("get_summary_by_note_id", { noteId: note.id });
                    await invoke("save_summary", { fileId: fullPath, summary: summary.summary });
                }
                catch (_) { }

                const highlights = await invoke<ResponseHighlight[]>("get_explanations_by_note_id", { noteId: note.id });
                await invoke("remove_local_highlights", { fileId: fullPath });
                await invoke("save_highlights", { fileId: fullPath, highlights });

                const flashcards = await invoke<ResponseFlashcard[]>("get_flashcards_by_note_id", { noteId: note.id });
                await invoke("remove_local_flashcards", { fileId: fullPath });
                await invoke("save_local_flashcards", { fileId: fullPath, flashcards });
            }));

            setLastSyncTimestamp(Date.now());
            setStatus("idle");
        }
        catch (e) {
            setStatus("error");
            console.error("Sync failed:", e);
        }
    }

    const getNoteText = async (path: string) => {
        // Read a note using its vault-relative path
        return await invoke("read_file", { path: await getFullPath(path) });
    }

    const getFullPath = async (relativePath: string) => {
        // Convert a vault-relative path into a full filesystem path
        const cfg = await invoke<{ vaultPath?: string }>("load_config");

        if (cfg.vaultPath) {
            return await join(cfg.vaultPath, normalizePath(relativePath));
        }
        else {
            console.error("File not found: ", relativePath);
        }
    }

    // Trigger full sync when user logs in
    useEffect(() => {
        if (user && syncEnabled) {
            handleSync();
        }
    }, [user, syncEnabled]);

    return (
        <SyncContext.Provider value={{
            status,
            setStatus,
            syncEnabled,
            setSyncEnabled: updateSyncEnabled,
            currentNote,
            setCurrentNote,
            isNoteLoading,
            setIsNoteLoading,
            lastSyncTimestamp,
            triggerFullSync,
            fetchUpdates
        }}>
            {children}
        </SyncContext.Provider>
    );
}

export const useSyncStatus = () => {
    const context = useContext(SyncContext);
    if (!context) throw new Error("useSyncStatus must be used within an SyncProvider");
    return context;
}
