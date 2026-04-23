import { createContext, useContext, useEffect, useState } from "react";
import { SyncStatus } from "../types/SyncStatus";
import { RequestNote } from "../types/RequestNote";
import { useActiveFile } from "./ActiveFileContext";
import { collectAllNodes, toRelativePath } from "../utils/fsUtils";
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
    fetchUpdates: () => Promise<void>;
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
    const [currentNote, setCurrentNote] = useState<RequestNote | null>(null);
    const { root, setRoot } = useVault();
    const [isNoteLoading, setIsNoteLoading] = useState(false);
    const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number | null>(null);
    const { scheduleSync } = useSyncManager();
    const { activeFileId } = useActiveFile();
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
            const createdNote = await invoke<RequestNote>("create_note", { request: { id: null, text: text, path: relativePath } });
            setCurrentNote(createdNote);
        }
        finally {
            setIsNoteLoading(false);
        }
    }

    useEffect(() => {
        async function loadSyncEnabled() {
            if (!user) return;
            const cfg = await invoke<{ syncEnabled?: boolean }>("load_config");
            if (cfg.syncEnabled) {
                setSyncEnabled(cfg.syncEnabled);
            }
        }

        loadSyncEnabled();
    }, []);

    useEffect(() => {
        async function saveSyncEnabled() {
            await invoke("save_sync_enabled", { syncEnabled: syncEnabled });
        }

        saveSyncEnabled();
    }, [syncEnabled]);

    useEffect(() => {
        if (!activeFileId || !syncEnabled) {
            setCurrentNote(null);
            return;
        }

        getCurrentNote();
    }, [activeFileId, syncEnabled]);

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
        const timestamp = await invoke<number>("load_sync_timestamp");
        setLastSyncTimestamp(new Date(timestamp).getTime());

        if (!timestamp) {
            try {
                const progress = await invoke<RequestSyncProgress | null>("load_sync_progress");
                if (progress) {
                    await triggerFullSync(progress);
                    await replayOfflineQueue();
                }
            }
            catch (e) {
                await triggerFullSync();
                await replayOfflineQueue();
            }
        }
        else {
            await fetchUpdates();
            await replayOfflineQueue();
        }
    }

    const triggerFullSync = async (progress?: RequestSyncProgress) => {
        if (!user) return;

        setStatus("syncing");

        if (!progress) {
            progress = { completed_note_ids: [], started_at: Date.now().toString() }
        }

        try {
            const db_notes = await invoke<RequestNote[]>("get_all_notes");

            const children = await invoke<FsNode[]>("scan_dir", {
                path: root?.id,
                recursive: true,
            });

            setRoot({
                id: root!.id,
                name: root!.name,
                kind: "dir",
                children,
                last_modified: root!.last_modified
            });

            const nodes = collectAllNodes(children);
            const nodes_with_paths = await Promise.all(
                nodes.map(async (node) => ({
                    node,
                    relativePath: await toRelativePath(node.id),
                }))
            );

            await Promise.all(db_notes.map(async (note) => {
                if (progress.completed_note_ids.includes(note.id!)) return;

                const matchedNode = nodes_with_paths.find(
                    ({ relativePath }) => relativePath === note.path
                );
                const fullPath = await getNoteFullPath(note.path);

                // If the local note is newer
                if (matchedNode && (new Date(matchedNode.node.last_modified) > new Date(note.last_updated))) {
                    // Create the note in DB
                    const text = await getNoteText(note.path);
                    await invoke("create_note", { request: { id: note.id, text: text, path: note.path, created_at: note.created_at, last_updated: new Date(matchedNode.node.last_modified).toISOString() } });

                    // Push the local summary, if exists
                    const summary = await invoke<ResponseSummary | null>("get_local_summary", { fileId: matchedNode.node.id });
                    if (summary !== null) {
                        await invoke("create_summary", { request: { id: summary.id, summary: summary.summary, note_id: note.id } });
                        // Ensure local summary points to correct note id
                        if (summary.note_id !== note.id) {
                            summary.note_id = note.id;
                            await invoke("save_summary", { summary: summary });
                        }

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
                    const flashcards = await invoke<ResponseFlashcard[] | null>("load_local_flashcards", { noteId: note.id });
                    if (flashcards !== null && flashcards.length !== 0) {
                        try {
                            await invoke("delete_flashcards_except", { ids: flashcards.map((f) => f.id) });
                            await Promise.all(flashcards.map(async (f) => {
                                await invoke("create_flashcard", { request: { ...f, id: null, note_id: note.id } });
                            }));
                        }
                        catch (e) {
                            // If flashcards do not exist in DB, delete all
                            await invoke("delete_all_flashcards_by_note_id", { noteId: note.id });
                            await Promise.all(flashcards.map(async (f) => {
                                await invoke("create_flashcard", { request: { ...f, note_id: note.id } });
                            }));
                        }
                    }
                    else {
                        await invoke("delete_all_flashcards_by_note_id", { noteId: note.id });
                    }
                }
                // If the database note is newer
                else {
                    await invoke("create_file", { path: await getNoteFullPath(note.path), contents: note.text });

                    const summary = await invoke<ResponseSummary>("get_summary_by_note_id", { noteId: note.id });
                    await invoke("save_summary", { summary: summary });

                    const highlights = await invoke<ResponseHighlight[]>("get_explanations_by_note_id", { noteId: note.id });
                    await invoke("remove_local_highlights", { fileId: fullPath });
                    await invoke("save_highlights", { fileId: fullPath, highlights });

                    const flashcards = await invoke<ResponseFlashcard[]>("get_flashcards_by_note_id", { noteId: note.id });
                    await invoke("remove_local_flashcards", { noteId: note.id });
                    await invoke("save_local_flashcards", { noteId: note.id, flashcards: flashcards });
                }

                progress.completed_note_ids.push(note.id!);
                await invoke("save_sync_progress", { progress });
            }));

            // Add any local files not existing in the database
            await Promise.all(nodes_with_paths.map(async (node_with_path) => {
                const db_exists = db_notes.some(file => file.path === node_with_path.relativePath);

                if (!db_exists) {
                    const text = await getNoteText(node_with_path.relativePath!);
                    const createdNote = await invoke<RequestNote>("create_note",
                        { request: { id: null, text: text, path: node_with_path.relativePath, created_at: new Date().toISOString(), last_updated: new Date(node_with_path.node.last_modified).toISOString() } });

                    // Push the local summary, if exists
                    const summary = await invoke<ResponseSummary | null>("get_local_summary", { fileId: node_with_path.node.id });
                    if (summary !== null)
                        await invoke("create_summary", { request: { id: summary.id, summary: summary.summary, note_id: createdNote.id! } });

                    // Push local highlights, if exist
                    const highlights = await invoke<ResponseHighlight[] | null>("read_highlights", { fileId: node_with_path.node.id });
                    if (highlights !== null && highlights.length !== 0) {
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

                    // Push local flashcards, if exist
                    const flashcards = await invoke<ResponseFlashcard[] | null>("load_local_flashcards", { noteId: createdNote.id! });
                    if (flashcards !== null && flashcards.length !== 0) {
                        await Promise.all(flashcards.map(async (f) => {
                            await invoke("create_flashcard", { request: { ...f, id: null, note_id: createdNote.id! } });
                        }));
                    }

                    progress.completed_note_ids.push(createdNote.id!);
                }

                await invoke("save_sync_progress", { progress });
            }));

            setLastSyncTimestamp(Date.now());
            await invoke("clear_sync_progress");
            setStatus("idle");
        } catch (e) {
            setStatus("error");
            console.error("Full sync failed:", e);
        }
    };

    const fetchUpdates = async () => {
        if (!user) return;
        if (!lastSyncTimestamp || lastSyncTimestamp === null || lastSyncTimestamp === 0) return;
        setStatus("syncing");

        try {
            const since = new Date(lastSyncTimestamp!).toISOString();
            const new_notes = await invoke<RequestNote[]>("get_notes_since", { since: since });

            await Promise.all(new_notes.map(async (note) => {
                const fullPath = await getNoteFullPath(note.path);

                await invoke("create_file", { path: fullPath, contents: note.text });
                await invoke("save_note_metadata", { path: note.path, note: note });

                const summary = await invoke<ResponseSummary>("get_summary_by_note_id", { noteId: note.id });
                await invoke("save_summary", { summary: summary });

                const highlights = await invoke<ResponseHighlight[]>("get_explanations_by_note_id", { noteId: note.id });
                await invoke("remove_local_highlights", { fileId: fullPath });
                await invoke("save_highlights", { fileId: fullPath, highlights });
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
        return await invoke("read_file", { path: await getNoteFullPath(path) });
    }

    const getNoteFullPath = async (relativePath: string) => {
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
