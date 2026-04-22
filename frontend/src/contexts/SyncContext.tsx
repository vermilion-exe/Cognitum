import { createContext, useContext, useEffect, useState } from "react";
import { SyncStatus } from "../types/SyncStatus";
import { RequestNote } from "../types/RequestNote";
import { useActiveFile } from "./ActiveFileContext";
import { collectAllNodes, toRelativePath } from "../utils/fsUtils";
import { invoke } from "@tauri-apps/api/core";
import { useUser } from "./UserContext";
import { ResponseSummary } from "../types/SyncTypes";
import { ResponseHighlight } from "../types/ResponseHighlight";
import { RequestSyncProgress } from "../types/RequestSyncProgress";
import { useSyncManager } from "../hooks/useSyncManager";
import { join } from "@tauri-apps/api/path";
import { useToast } from "../hooks/useToast";
import { FsNode } from "../types/FsNode";
import { useVault } from "./VaultContext";

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
                    const text = await getNoteText(note.path);
                    await invoke("create_note", { request: { id: note.id, text: text, path: note.path, created_at: note.created_at, last_updated: note.last_updated } });

                    const summary = await invoke<ResponseSummary>("get_local_summary", { noteId: note.id });
                    await invoke("create_summary", { request: { id: summary.id, summary: summary.summary, note_id: summary.note_id } });

                    const highlights = await invoke<ResponseHighlight[]>("read_highlights", { fileId: fullPath });
                    await Promise.all(highlights.map(async (h) => {
                        await invoke("create_explanation", { request: { id: h.id, from: h.from, to: h.to, selected_text: h.selected_text, explanation: h.explanation, note_id: h.note_id } });
                    }));
                }
                // If the database note is newer
                else {
                    await invoke("create_file", { path: await getNoteFullPath(note.path), contents: note.text });
                    await invoke("save_note_metadata", { path: note.path, note: note });

                    const summary = await invoke<ResponseSummary>("get_summary_by_note_id", { noteId: note.id });
                    await invoke("save_summary", { summary: summary });

                    const highlights = await invoke<ResponseHighlight[]>("get_explanations_by_note_id", { noteId: note.id });
                    await invoke("remove_local_highlights", { fileId: fullPath });
                    await invoke("save_highlights", { fileId: fullPath, highlights });
                }

                progress.completed_note_ids.push(note.id!);
                await invoke("save_sync_progress", { progress });
            }));

            // Add any local files not existing in the database
            await Promise.all(nodes_with_paths.map(async (node_with_path) => {
                const db_exists = db_notes.some(file => file.path === node_with_path.relativePath);

                if (!db_exists) {
                    const text = await getNoteText(node_with_path.relativePath!);
                    const createdNote = await invoke<RequestNote>("create_note", { request: { id: null, text: text, path: node_with_path.relativePath, created_at: new Date().toISOString(), last_updated: new Date().toISOString() } });

                    const summary = await invoke<string>("get_local_summary", { fileId: node_with_path.node.id });
                    await invoke("create_summary", { request: { id: null, summary: summary, note_id: createdNote.id } });

                    const highlights = await invoke<ResponseHighlight[]>("read_highlights", { fileId: node_with_path.node.id });
                    await Promise.all(highlights.map(async (h) => {
                        await invoke("create_explanation", { request: { id: h.id, from: h.from, to: h.to, selected_text: h.selected_text, explanation: h.explanation, note_id: h.note_id } });
                    }));
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
        setStatus("syncing");

        try {
            const since = lastSyncTimestamp === 0
                ? new Date().toISOString()
                : new Date(lastSyncTimestamp!).toISOString();
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
            setSyncEnabled,
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
