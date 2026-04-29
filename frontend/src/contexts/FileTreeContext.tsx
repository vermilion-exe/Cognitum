import { createContext, useContext, useMemo, useRef, useState } from "react";
import type { FsNode } from "../types/FsNode";
import { collectAllNodes, findFilesInDir, findNode, getFileNodes, toRelativePath } from "../utils/fsUtils";
import { useActiveFile } from "./ActiveFileContext";
import { invoke } from "@tauri-apps/api/core";
import { useSyncStatus } from "./SyncContext";
import { useSyncManager } from "../hooks/useSyncManager";
import { join } from "@tauri-apps/api/path";
import { RequestNote } from "../types/RequestNote";
import { CardReview } from "../types/CardReview";
import { useVault } from "./VaultContext";
import { useDirectoryWatcher } from "../hooks/useDirectoryWatcher";
import { ResponseHighlight } from "../types/ResponseHighlight";
import { ResponseFlashcard } from "../types/ResponseFlashcard";

interface FileTreeContextType {
    root: FsNode | undefined;
    setRoot: (root: FsNode) => void;
    openIds: Set<string>;
    openFileNodes: FsNode[];
    toggleOpen: (e: React.MouseEvent, node: FsNode, isNodeCreation: boolean) => void;
    closeFile: (id: string) => void;
    createNode: (targetId: string, nodeName: string, isDirectory: boolean) => void;
    deleteNode: (nodeId: string) => void;
    renameNode: (nodeId: string, newName: string) => void;
}

const FileTreeContext = createContext<FileTreeContextType | undefined>(undefined);

export const FileTreeProvider = ({ children }: { children: React.ReactNode }) => {
    const { activeFileId, setActiveFileId } = useActiveFile();
    const { root, setRoot } = useVault();
    const isAppChangeRef = useRef(false);
    const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
    const { syncEnabled } = useSyncStatus();
    const { scheduleSync } = useSyncManager();

    const openFileNodes = useMemo(
        () => getFileNodes(root, openIds),
        [root, openIds, activeFileId]
    );

    useDirectoryWatcher(root?.id ?? null, async () => {
        if (!root) return;
        if (isAppChangeRef.current) {
            isAppChangeRef.current = false;
            return;
        }
        console.log("Found changes");

        const children = await invoke<FsNode[]>("scan_dir", { path: root.id, recursive: true });

        const newNodes = collectAllNodes(children);
        const oldNodes = new Map(collectAllNodes(root.children!).map((n) => [n.id, n]));

        const newMap = new Map(newNodes.map((n) => [n.id, n]));

        const created = newNodes.filter((n) => !oldNodes.has(n.id));

        const deleted = [...oldNodes.values()].filter((n) => !newMap.has(n.id));

        if (created.length > 0 && syncEnabled) {
            created.forEach((node) => {
                if (node.kind === "file") {
                    const id = crypto.randomUUID();
                    const relativePath = toRelativePath(node.id);
                    scheduleSync(`create-note-${id}`,
                        { type: "note", operation: "create", id: String(id), payload: { id: null, text: "", path: relativePath } });
                }
            });
        }

        if (deleted.length > 0) {
            await Promise.all(deleted.map(async (node) => {
                if (node.kind === "file") {
                    await invoke("remove_local_highlights", { fileId: node.id }).catch(console.error);
                    await invoke("remove_local_summary", { fileId: node.id }).catch(console.error);
                    await invoke("remove_local_flashcards", { fileId: node.id }).catch(console.error);

                    if (syncEnabled) {
                        try {
                            const note = await invoke<RequestNote>("get_note_by_path", { path: node.id });
                            const queue = await invoke<Record<string, CardReview>>("load_review_queue");
                            const filtered = Object.fromEntries(
                                Object.entries(queue).filter(
                                    ([, review]) => review.flashcard.note_id !== note.id
                                )
                            );
                            await invoke("save_review_queue", { queue: filtered });
                        } catch (_) { }
                        const relativePath = await toRelativePath(node.id);
                        const id = crypto.randomUUID();
                        scheduleSync(`delete-note-${id}`,
                            { type: "note", operation: "delete", id: String(id), payload: { path: relativePath } });
                    }
                }
            }));
        }

        setRoot({
            id: root!.id,
            name: root!.name,
            kind: "dir",
            children,
            lastModified: root!.lastModified
        });
    });

    const toggleOpen = (e: React.MouseEvent, node: FsNode, isNodeCreation: boolean) => {
        if (node.kind === "dir") {
            setOpenIds(prev => {
                const next = new Set(prev);
                if (next.has(node.id) && !isNodeCreation) next.delete(node.id);
                else next.add(node.id);
                return next;
            });
        } else {
            setOpenIds(prev => {
                const next = new Set(prev);
                if (
                    !e.shiftKey &&
                    activeFileId &&
                    activeFileId !== node.id &&
                    !next.has(node.id)
                )
                    next.delete(activeFileId);
                next.add(node.id);
                return next;
            });
            setActiveFileId(node.id);
        }
    };

    const closeFile = (id: string) => {
        setOpenIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        console.log(activeFileId === id);
        if (activeFileId === id) setActiveFileId(undefined);
    };

    const createNode = async (targetId: string, nodeName: string, isDirectory: boolean) => {
        isAppChangeRef.current = true;
        const newPath = `${targetId}\\${nodeName}${!isDirectory ? ".md" : ""}`;
        await invoke(`create_${isDirectory ? "directory" : "file"}`, { path: newPath, ...(!isDirectory && { contents: "" }) });

        if (syncEnabled && !isDirectory) {
            const relativePath = await toRelativePath(newPath);
            const id = crypto.randomUUID();
            scheduleSync(`create-note-${id}`,
                { type: "note", operation: "create", id: String(id), payload: { id: null, text: "", path: relativePath } });
        }

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
    }

    const deleteNode = async (nodeId: string) => {
        const node = findNode(root, nodeId);
        if (!node) return;

        isAppChangeRef.current = true;

        if (node.kind === "file") {
            await invoke("remove_local_highlights", { fileId: nodeId }).catch(console.error);
            await invoke("remove_local_summary", { fileId: nodeId }).catch(console.error);
            await invoke("remove_local_flashcards", { fileId: node.id }).catch(console.error);
        }
        await invoke(`delete_${node?.kind === "dir" ? "directory" : "file"}`, { path: nodeId });

        if (syncEnabled) {
            if (node?.kind === "file") {
                const relativePath = await toRelativePath(nodeId);
                const id = crypto.randomUUID();
                scheduleSync(`delete-note-${id}`,
                    { type: "note", operation: "delete", id: String(id), payload: { path: relativePath } });
                try {
                    const note = await invoke<RequestNote>("get_note_by_path", { path: node.id });
                    const queue = await invoke<Record<string, CardReview>>("load_review_queue");
                    const filtered = Object.fromEntries(
                        Object.entries(queue).filter(
                            ([, review]) => review.flashcard.note_id !== note.id
                        )
                    );
                    await invoke("save_review_queue", { queue: filtered });
                } catch (_) { }
            }
            else {
                const files = findFilesInDir(root, node.id);
                Promise.all(files.map(async (file) => {
                    const relativePath = await toRelativePath(file.id);
                    const id = crypto.randomUUID();
                    scheduleSync(`delete-note-${id}`,
                        { type: "note", operation: "delete", id: String(id), payload: { path: relativePath } });
                }));
            }
        }

        if (node.id === activeFileId) {
            setActiveFileId(undefined);
        }

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
    }

    const renameNode = async (nodeId: string, newName: string) => {
        const node = findNode(root, nodeId);
        if (!node) return;

        isAppChangeRef.current = true;

        if (node.id === activeFileId) {
            setActiveFileId(undefined);
        }

        const base = node.kind === "file"
            ? node.id.slice(0, -(`${node.name}.md`.length))
            : node.id.slice(0, -(node.name.length));

        const newPath = await join(base, (newName + (node.kind === "file" ? ".md" : "")));
        await invoke("rename", { from: node.id, to: newPath });

        if (node.kind === "file") {
            const summary = await invoke("get_local_summary", { fileId: node.id });
            // move summary if exists.
            if (summary && summary !== null) {
                await invoke("remove_local_summary", { fileId: node.id }).catch(console.error);
                await invoke("save_summary", { summary: summary, fileId: newPath }).catch(console.error);
            }

            // move highlights if exist.
            const highlights = await invoke<ResponseHighlight[]>("read_highlights", { fileId: node.id });
            if (highlights && highlights !== null && highlights.length !== 0) {
                await invoke("remove_local_highlights", { fileId: node.id }).catch(console.error);
                await invoke("save_highlights"), { fileId: newPath, highlights: highlights };
            }

            // move flashcards if exist.
            const flashcards = await invoke<ResponseFlashcard[]>("load_local_flashcards", { fileId: node.id });
            if (flashcards && flashcards !== null && flashcards.length !== 0) {
                await invoke("remove_local_flashcards", { fileId: node.id }).catch(console.error);
                await invoke("save_local_flashcards", { fileId: newPath, flashcards: flashcards }).catch(console.error);
            }
        }

        if (syncEnabled && node.kind === "file") {
            const oldRelativePath = await toRelativePath(node.id);
            const newRelativePath = await toRelativePath(newPath);
            const id = crypto.randomUUID();
            scheduleSync(`move-note-${id}`,
                { type: "note", operation: "move", id: String(id), payload: { old_path: oldRelativePath, new_path: newRelativePath } });
        }

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
    }

    return (
        <FileTreeContext.Provider
            value={{ root, setRoot, openIds, openFileNodes, toggleOpen, closeFile, createNode, deleteNode, renameNode }}
        >
            {children}
        </FileTreeContext.Provider>
    );
};

export const useFileTree = () => {
    const context = useContext(FileTreeContext);
    if (!context) throw new Error("useFileTree must be used within a FileTreeProvider");
    return context;
};
