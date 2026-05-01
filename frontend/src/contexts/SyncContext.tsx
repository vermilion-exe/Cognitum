import { createContext, useContext, useEffect, useState } from "react";
import { SyncStatus } from "../types/SyncStatus";
import { RequestNote } from "../types/RequestNote";
import { useActiveFile } from "./ActiveFileContext";
import { collectAllNodes, isImage, toRelativePath } from "../utils/fsUtils";
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
            await invoke("save_sync_enabled", { syncEnabled: syncEnabled });
        }

        saveSyncEnabled();
    }, [syncEnabled, syncLoaded]);

    useEffect(() => {
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
        if (!lastSyncTimestamp || lastSyncTimestamp === null) return;
        invoke("save_sync_timestamp", { timestamp: new Date(lastSyncTimestamp!).toISOString() });
    }, [lastSyncTimestamp]);

    const handleSync = async () => {
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

    const triggerFullSync = async (progress?: RequestSyncProgress) => {
        if (!user) return;

        setStatus("syncing");

        if (!progress) {
            progress = { completed_note_ids: [], started_at: new Date().toISOString() }
        }

        try {
            console.log("Getting notes from DB.");
            const db_notes = await invoke<RequestNote[]>("get_all_notes");
            const db_images = await invoke<ResponseAttachment[]>("get_attachments");

            console.log("Getting local notes.");
            const children = await invoke<FsNode[]>("scan_dir", {
                path: root?.id,
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

            if (db_notes.length !== 0) {
                console.log("Found DB notes, syncing.");
            }
            await Promise.all(db_notes.map(async (note) => {
                if (progress.completed_note_ids.includes(note.id!)) return;

                const matchedNode = nodes_with_paths.find(
                    ({ relativePath }) => relativePath === note.path
                );
                const fullPath = await getFullPath(note.path);

                const localTimestamp = await invoke<string | null>("get_local_note_timestamp", { path: fullPath });
                const localLastUpdated = localTimestamp ? new Date(localTimestamp) : (matchedNode?.node.lastModified ? new Date(matchedNode?.node.lastModified) : null);

                // If the local note is newer
                if (matchedNode && localLastUpdated && localLastUpdated > new Date(note.last_updated)) {
                    console.log("Local note is newer for note with path", note.path);
                    // Create the note in DB
                    const text = await getNoteText(note.path);
                    await invoke("create_note", { request: { id: note.id, text: text, path: note.path, created_at: note.created_at, last_updated: localTimestamp } });

                    // Push the local summary, if exists
                    const summary = await invoke<String | null>("get_local_summary", { fileId: matchedNode.node.id });
                    if (summary !== null) {
                        let id = null;
                        try {
                            const summary = await invoke<ResponseSummary | null>("get_summary_by_note_id", { noteId: note.id });
                            id = summary && summary.id;
                        }
                        catch (_) { }

                        await invoke("create_summary", { request: { id: id, summary: summary, note_id: note.id } });
                    }

                    // Push local highlights, if exist
                    const highlights = await invoke<ResponseHighlight[] | null>("read_highlights", { fileId: fullPath });
                    if (highlights !== null && highlights.length !== 0) {
                        try {
                            await invoke("delete_explanations_except", { ids: highlights.map((h) => h.id) });
                        }
                        catch (e) {
                            // If explanations do not exist in DB, delete all
                            await invoke("delete_all_note_explanations", { noteId: note.id });
                        }

                        // Create the highlights in DB
                        await Promise.all(highlights.map(async (h) => {
                            await invoke("create_explanation", { request: { ...h, note_id: note.id } });
                        }));

                        // Ensure the highlights point to correct note id
                        const local_note_id = highlights[0].note_id;
                        if (local_note_id !== note.id) {
                            await invoke("save_highlights", { fileId: matchedNode.node.id, highlights: highlights.map((h) => ({ ...h, note_id: note.id })) });
                        }
                    }
                    else {
                        await invoke("delete_all_note_explanations", { noteId: note.id });
                    }

                    // Push local flashcards, if exist
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
                    console.log("Uploaded local note to DB");
                }
                // If the database note is newer
                else if ((matchedNode && localLastUpdated && (localLastUpdated < new Date(note.last_updated))) || !matchedNode || !localLastUpdated) {
                    console.log("DB note is newer for note with path", note.path);
                    if (activeFileId === fullPath)
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
                }

                progress.completed_note_ids.push(note.id!);
                await invoke("save_sync_progress", { progress });
            }));

            if (nodes_with_paths.length !== 0) {
                console.log("Local notes found, syncing.");
            }
            // Add any local files not existing in the database
            await Promise.all(nodes_with_paths.map(async (node_with_path) => {
                const db_exists = db_notes.some(file => file.path === node_with_path.relativePath);

                if (!db_exists) {
                    console.log("Note does not exist in DB with path", node_with_path.relativePath);
                    const text = await getNoteText(node_with_path.relativePath!);

                    const localTimestamp = await invoke<string | null>("get_local_note_timestamp", { path: node_with_path.node.id });
                    const createdNote = await invoke<RequestNote>("create_note",
                        { request: { id: null, text: text, path: node_with_path.relativePath, created_at: new Date().toISOString(), last_updated: localTimestamp } });

                    console.log("created note");

                    console.log("Checking summaries");
                    // Push the local summary, if exists
                    const summary = await invoke<String | null>("get_local_summary", { fileId: node_with_path.node.id });
                    if (summary !== null && summary !== "") {
                        console.log("Found summary, uploading");
                        await invoke("create_summary", { request: { id: null, summary: summary, note_id: createdNote.id! } });
                    }

                    console.log("Checking highlights");
                    // Push local highlights, if exist
                    const highlights = await invoke<ResponseHighlight[] | null>("read_highlights", { fileId: node_with_path.node.id });
                    if (highlights !== null && highlights.length !== 0) {
                        console.log("Found highlights, uploading");
                        // Create the highlights in DB
                        await Promise.all(highlights.map(async (h) => {
                            await invoke("create_explanation", { request: { ...h, note_id: createdNote.id! } });
                        }));

                        // Ensure the highlights point to correct note id
                        const local_note_id = highlights[0].note_id;
                        if (local_note_id !== createdNote.id) {
                            await invoke("save_highlights", { fileId: node_with_path.node.id, highlights: highlights.map((h) => ({ ...h, note_id: createdNote.id! })) });
                        }
                    }

                    console.log("Checking flashcards");
                    // Push local flashcards, if exist
                    const flashcards = await invoke<ResponseFlashcard[] | null>("load_local_flashcards", { fileId: node_with_path.node.id });
                    if (flashcards !== null && flashcards.length !== 0) {
                        console.log("Found flashcards");
                        await invoke("create_flashcard", { request: flashcards.map((f) => ({ ...f, note_id: createdNote.id! })) });

                        const local_note_id = flashcards[0].note_id;
                        if (local_note_id !== createdNote.id) {
                            await invoke("save_local_flashcards", { fileId: node_with_path.node.id, flashcards: flashcards.map((f) => ({ ...f, note_id: createdNote.id! })) });
                        }
                    }

                    console.log("Uploaded local note to DB");
                    progress.completed_note_ids.push(createdNote.id!);
                }

                await invoke("save_sync_progress", { progress });
                console.log("saved progress");
            }));

            const images_with_paths = await Promise.all(
                images.map(async (image) => ({
                    image,
                    relativePath: await toRelativePath(image.id),
                }))
            );

            await Promise.all(db_images.map(async (image) => {
                const matchedImage = images_with_paths.find(
                    ({ relativePath }) => relativePath === image.path
                );

                // Local image is newer
                if (matchedImage && (new Date(matchedImage.image.lastModified!) > new Date(image.last_updated))) {
                    const lastModified = !matchedImage.image.lastModified ? null : new Date(matchedImage.image.lastModified).toISOString();
                    await invoke("create_attachment", { request: { file_path: matchedImage.image.id, relative_path: image.path, last_updated: lastModified } });
                }
                else if ((matchedImage && (new Date(matchedImage.image.lastModified!) < new Date(image.last_updated))) || !matchedImage) {
                    const fullPath = matchedImage ? matchedImage.image.id : await getFullPath(image.path);
                    if (matchedImage) await invoke("delete_file", { path: fullPath });
                    await invoke("create_image", { path: fullPath, contents: image.bytes });
                }
            }));

            await Promise.all(images_with_paths.map(async (image_with_path) => {
                const db_exists = db_images.some(image => image.path === image_with_path.relativePath);

                if (!db_exists) {
                    const lastModified = !image_with_path.image.lastModified ? null : new Date(image_with_path.image.lastModified).toISOString();
                    await invoke("create_attachment", { request: { file_path: image_with_path.image.id, relative_path: image_with_path.relativePath, last_updated: lastModified } });
                }
            }));

            setLastSyncTimestamp(Date.now());
            await invoke("clear_sync_progress");
            setStatus("idle");
        } catch (e) {
            setStatus("error");
            console.error("Full sync failed:", e);
        }
    };

    const fetchUpdates = async (timestampOverride?: number | null) => {
        if (!user) return;
        const syncTimestamp = timestampOverride ?? lastSyncTimestamp;
        if (!syncTimestamp || syncTimestamp === null || syncTimestamp === 0) return;
        setStatus("syncing");

        try {
            const since = new Date(syncTimestamp).toISOString();
            const new_notes = await invoke<RequestNote[]>("get_notes_since", { since: since });
            const children = root?.id ? await invoke<FsNode[]>("scan_dir", {
                path: root.id,
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
                    ({ relativePath }) => relativePath === note.path
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
        return await invoke("read_file", { path: await getFullPath(path) });
    }

    const getFullPath = async (relativePath: string) => {
        const cfg = await invoke<{ vaultPath?: string }>("load_config");

        if (cfg.vaultPath) {
            return await join(cfg.vaultPath, relativePath);
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
