import { createContext, useContext, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import type { FsNode } from "../types/FsNode";
import type { RequestNote } from "../types/RequestNote";
import type { CardReview } from "../types/CardReview";
import type { ResponseHighlight } from "../types/ResponseHighlight";
import type { ResponseFlashcard } from "../types/ResponseFlashcard";
import {
    collectAllNodes,
    findFilesInDir,
    findNode,
    getFileNodes,
    isImageNode,
    toRelativePath,
} from "../utils/fsUtils";
import { useActiveFile } from "./ActiveFileContext";
import { useSyncStatus } from "./SyncContext";
import { useSyncManager } from "../hooks/useSyncManager";
import { useVault } from "./VaultContext";
import { useDirectoryWatcher } from "../hooks/useDirectoryWatcher";

interface FileTreeContextType {
    root: FsNode | undefined;
    setRoot: (root: FsNode) => void;
    openIds: Set<string>;
    openFileNodes: FsNode[];
    toggleOpen: (e: React.MouseEvent, node: FsNode, isNodeCreation: boolean) => void;
    closeFile: (id: string) => void;
    createNode: (targetId: string, nodeName: string, isDirectory: boolean) => Promise<void>;
    deleteNode: (nodeId: string) => Promise<void>;
    renameNode: (nodeId: string, newName: string) => Promise<void>;
    markAppFileWrite: (path: string) => void;
}

const FileTreeContext = createContext<FileTreeContextType | undefined>(undefined);

const makeRoot = (root: FsNode, children: FsNode[]): FsNode => ({
    id: root.id,
    name: root.name,
    kind: "dir",
    children,
    lastModified: root.lastModified,
});

const getFileNameWithExtension = (node: FsNode, newName: string) => {
    if (node.kind !== "file") return newName;

    const hasExtension = /\.[^./\\]+$/.test(newName);
    return hasExtension ? newName : `${newName}.${node.extension}`;
};

const getParentPath = (path: string, childName: string) => {
    const suffix = childName;
    return path.endsWith(suffix) ? path.slice(0, -suffix.length) : path.replace(/[\\/][^\\/]*$/, "");
};

export const FileTreeProvider = ({ children }: { children: React.ReactNode }) => {
    const { activeFileId, setActiveFileId } = useActiveFile();
    const { root, setRoot, ignoredFileWritesRef, markAppFileWrite } = useVault();
    const isAppChangeRef = useRef(false);
    const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
    const { syncEnabled } = useSyncStatus();
    const { scheduleSync } = useSyncManager();

    const openFileNodes = useMemo(
        () => getFileNodes(root, openIds),
        [root, openIds]
    );

    const refreshRoot = async () => {
        if (!root) return;

        const children = await invoke<FsNode[]>("scan_dir", {
            path: root.id,
            recursive: true,
        });

        setRoot(makeRoot(root, children));
    };

    useDirectoryWatcher(root?.id ?? null, async () => {
        if (!root) return;

        if (isAppChangeRef.current) {
            isAppChangeRef.current = false;
            return;
        }

        console.log("Found changes");

        const children = await invoke<FsNode[]>("scan_dir", {
            path: root.id,
            recursive: true,
        });

        const newNodes = collectAllNodes(children);
        const oldNodes = new Map(collectAllNodes(root.children ?? []).map((node) => [node.id, node]));
        const newMap = new Map(newNodes.map((node) => [node.id, node]));

        const created = newNodes.filter((node) => {
            if (oldNodes.has(node.id)) return false;

            const ignoreUntil = ignoredFileWritesRef.current.get(node.id);
            if (ignoreUntil && Date.now() < ignoreUntil) {
                ignoredFileWritesRef.current.delete(node.id);
                return false;
            }

            return true;
        });
        const deleted = [...oldNodes.values()].filter((node) => !newMap.has(node.id));
        const modified = newNodes.filter((node) => {
            const oldNode = oldNodes.get(node.id);
            if (!oldNode || oldNode.lastModified === node.lastModified) return false;

            const ignoreUntil = ignoredFileWritesRef.current.get(node.id);
            if (ignoreUntil && Date.now() < ignoreUntil) {
                ignoredFileWritesRef.current.delete(node.id);
                return false;
            }

            return true;
        });

        if (created.length > 0) {
            await Promise.all(created.map(async (node) => {
                if (node.kind !== "file") return;

                const id = crypto.randomUUID();
                const relativePath = await toRelativePath(node.id);

                if (node.extension === "md") {
                    let lastUpdated = await invoke<string | null>("get_local_note_timestamp", { path: node.id });

                    if (!lastUpdated) {
                        lastUpdated = node.lastModified
                            ? new Date(node.lastModified).toISOString()
                            : new Date().toISOString();
                    }

                    await invoke("save_note_timestamp", { path: node.id, timestamp: lastUpdated });

                    if (syncEnabled) {
                        const text = await invoke<string>("read_file", { path: node.id });

                        scheduleSync(`create-note-${id}`, {
                            type: "note",
                            operation: "create",
                            id: String(id),
                            payload: {
                                id: null,
                                text,
                                path: relativePath,
                                created_at: lastUpdated,
                                last_updated: lastUpdated,
                            },
                        });
                    }
                }

                if (syncEnabled && isImageNode(node)) {
                    const lastUpdated = node.lastModified
                        ? new Date(node.lastModified).toISOString()
                        : null;

                    scheduleSync(`create-attachment-${id}`, {
                        type: "attachment",
                        operation: "create",
                        id: String(id),
                        payload: {
                            file_path: node.id,
                            relative_path: relativePath,
                            last_updated: lastUpdated,
                        },
                    });
                }
            }));
        }

        if (deleted.length > 0) {
            await Promise.all(deleted.map(async (node) => {
                if (node.kind !== "file") return;

                const id = crypto.randomUUID();
                const relativePath = await toRelativePath(node.id);

                if (node.extension === "md") {
                    await invoke("remove_local_highlights", { fileId: node.id }).catch(console.error);
                    await invoke("remove_local_summary", { fileId: node.id }).catch(console.error);
                    await invoke("remove_local_flashcards", { fileId: node.id }).catch(console.error);
                    await invoke("remove_local_note_timestamp", { path: node.id }).catch(console.error);

                    if (syncEnabled) {
                        try {
                            const note = await invoke<RequestNote>("get_note_by_path", { path: node.id });
                            const queue = await invoke<Record<string, CardReview>>("load_review_queue");
                            const filtered = Object.fromEntries(
                                Object.entries(queue).filter(([, review]) => review.flashcard.note_id !== note.id)
                            );
                            await invoke("save_review_queue", { queue: filtered });
                        } catch (error) {
                            console.error(error);
                        }

                        scheduleSync(`delete-note-${id}`, {
                            type: "note",
                            operation: "delete",
                            id: String(id),
                            payload: { path: relativePath },
                        });
                    }
                }

                if (syncEnabled && isImageNode(node)) {
                    scheduleSync(`delete-attachment-${id}`, {
                        type: "attachment",
                        operation: "delete",
                        id: String(id),
                        payload: relativePath,
                    });
                }
            }));
        }

        if (modified.length > 0 && syncEnabled) {
            await Promise.all(modified.map(async (node) => {
                if (node.kind !== "file" || node.extension !== "md") return;

                const relativePath = await toRelativePath(node.id);
                const text = await invoke<string>("read_file", { path: node.id });
                const lastUpdated = new Date().toISOString();

                await invoke("save_note_timestamp", { path: node.id, timestamp: lastUpdated });

                let note: RequestNote | null = null;
                try {
                    note = await invoke<RequestNote>("get_note_by_path", { path: relativePath });
                } catch {
                    note = null;
                }

                const id = note?.id ?? crypto.randomUUID();

                scheduleSync(`create-note-${id}`, {
                    type: "note",
                    operation: "create",
                    id: String(id),
                    payload: {
                        id: note?.id ?? null,
                        text,
                        path: relativePath,
                        created_at: note?.created_at ?? lastUpdated,
                        last_updated: lastUpdated,
                    },
                });
            }));
        }

        setRoot(makeRoot(root, children));
    });

    const toggleOpen = (e: React.MouseEvent, node: FsNode, isNodeCreation: boolean) => {
        if (node.kind === "dir") {
            setOpenIds((prev) => {
                const next = new Set(prev);

                if (next.has(node.id) && !isNodeCreation) next.delete(node.id);
                else next.add(node.id);

                return next;
            });

            return;
        }

        setOpenIds((prev) => {
            const next = new Set(prev);

            if (!e.shiftKey && activeFileId && activeFileId !== node.id && !next.has(node.id)) {
                next.delete(activeFileId);
            }

            next.add(node.id);
            return next;
        });

        setActiveFileId(node.id);
    };

    const closeFile = (id: string) => {
        setOpenIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });

        if (activeFileId === id) {
            setActiveFileId(undefined);
        }
    };

    const createNode = async (targetId: string, nodeName: string, isDirectory: boolean) => {
        if (!root) return;

        isAppChangeRef.current = true;

        const fileName = isDirectory ? nodeName : `${nodeName}.md`;
        const newPath = await join(targetId, fileName);

        await invoke(`create_${isDirectory ? "directory" : "file"}`, {
            path: newPath,
            ...(!isDirectory && { contents: "" }),
        });

        if (!isDirectory) {
            const now = new Date().toISOString();
            await invoke("save_note_timestamp", { path: newPath, timestamp: now });

            if (syncEnabled) {
                const relativePath = await toRelativePath(newPath);
                const id = crypto.randomUUID();

                scheduleSync(`create-note-${id}`, {
                    type: "note",
                    operation: "create",
                    id: String(id),
                    payload: {
                        id: null,
                        text: "",
                        path: relativePath,
                        created_at: now,
                        last_updated: now,
                    },
                });
            }
        }

        await refreshRoot();
    };

    const deleteNode = async (nodeId: string) => {
        if (!root) return;

        const node = findNode(root, nodeId);
        if (!node) return;

        if (node.id === activeFileId) {
            setActiveFileId(undefined);
        }

        isAppChangeRef.current = true;

        if (node.kind === "file" && node.extension === "md") {
            await invoke("remove_local_highlights", { fileId: nodeId }).catch(console.error);
            await invoke("remove_local_summary", { fileId: nodeId }).catch(console.error);
            await invoke("remove_local_flashcards", { fileId: node.id }).catch(console.error);
            await invoke("remove_local_note_timestamp", { path: node.id }).catch(console.error);
        }

        if (syncEnabled) {
            if (node.kind === "file") {
                const relativePath = await toRelativePath(nodeId);
                const id = crypto.randomUUID();

                if (node.extension === "md") {
                    scheduleSync(`delete-note-${id}`, {
                        type: "note",
                        operation: "delete",
                        id: String(id),
                        payload: { path: relativePath },
                    });

                    try {
                        const note = await invoke<RequestNote>("get_note_by_path", { path: node.id });
                        const queue = await invoke<Record<string, CardReview>>("load_review_queue");
                        const filtered = Object.fromEntries(
                            Object.entries(queue).filter(([, review]) => review.flashcard.note_id !== note.id)
                        );
                        await invoke("save_review_queue", { queue: filtered });
                    } catch (error) {
                        console.error(error);
                    }
                } else if (isImageNode(node)) {
                    scheduleSync(`delete-attachment-${id}`, {
                        type: "attachment",
                        operation: "delete",
                        id: String(id),
                        payload: relativePath,
                    });
                }
            } else {
                const files = findFilesInDir(root, node.id);

                await Promise.all(files.map(async (file) => {
                    const relativePath = await toRelativePath(file.id);
                    const id = crypto.randomUUID();

                    if (file.extension === "md") {
                        scheduleSync(`delete-note-${id}`, {
                            type: "note",
                            operation: "delete",
                            id: String(id),
                            payload: { path: relativePath },
                        });
                    } else if (isImageNode(file)) {
                        scheduleSync(`delete-attachment-${id}`, {
                            type: "attachment",
                            operation: "delete",
                            id: String(id),
                            payload: relativePath,
                        });
                    }
                }));
            }
        }

        await invoke(`delete_${node.kind === "dir" ? "directory" : "file"}`, { path: nodeId });
        await refreshRoot();
    };

    const renameNode = async (nodeId: string, newName: string) => {
        if (!root) return;

        const node = findNode(root, nodeId);
        if (!node) return;

        isAppChangeRef.current = true;

        if (node.id === activeFileId) {
            setActiveFileId(undefined);
        }

        const currentFileName = node.kind === "file" ? `${node.name}.${node.extension}` : node.name;
        const base = getParentPath(node.id, currentFileName);
        const name = getFileNameWithExtension(node, newName);
        const newPath = await join(base, name);

        await invoke("rename", { from: node.id, to: newPath });

        if (node.kind === "file" && node.extension === "md") {
            const lastTimestamp = await invoke<string | null>("get_local_note_timestamp", { path: node.id });
            await invoke("remove_local_note_timestamp", { path: node.id }).catch(console.error);
            await invoke("save_note_timestamp", {
                path: newPath,
                timestamp: lastTimestamp ?? new Date().toISOString(),
            });

            const summary = await invoke("get_local_summary", { fileId: node.id }).catch(() => null);
            if (summary) {
                await invoke("remove_local_summary", { fileId: node.id }).catch(console.error);
                await invoke("save_summary", { summary, fileId: newPath }).catch(console.error);
            }

            const highlights = await invoke<ResponseHighlight[]>("read_highlights", { fileId: node.id }).catch(() => []);
            if (highlights.length > 0) {
                await invoke("remove_local_highlights", { fileId: node.id }).catch(console.error);
                await invoke("save_highlights", { fileId: newPath, highlights });
            }

            const flashcards = await invoke<ResponseFlashcard[]>("load_local_flashcards", { fileId: node.id }).catch(() => []);
            if (flashcards.length > 0) {
                await invoke("remove_local_flashcards", { fileId: node.id }).catch(console.error);
                await invoke("save_local_flashcards", { fileId: newPath, flashcards }).catch(console.error);
            }
        }

        if (syncEnabled && node.kind === "file") {
            const oldRelativePath = await toRelativePath(node.id);
            const newRelativePath = await toRelativePath(newPath);
            const id = crypto.randomUUID();

            if (node.extension === "md") {
                scheduleSync(`move-note-${id}`, {
                    type: "note",
                    operation: "move",
                    id: String(id),
                    payload: { old_path: oldRelativePath, new_path: newRelativePath },
                });
            } else if (isImageNode(node)) {
                scheduleSync(`move-attachment-${id}`, {
                    type: "attachment",
                    operation: "move",
                    id: String(id),
                    payload: { old_path: oldRelativePath, new_path: newRelativePath },
                });
            }
        }

        await refreshRoot();
    };

    return (
        <FileTreeContext.Provider
            value={{ root, setRoot, openIds, openFileNodes, toggleOpen, closeFile, createNode, deleteNode, renameNode, markAppFileWrite }}
        >
            {children}
        </FileTreeContext.Provider>
    );
};

export const useFileTree = () => {
    const context = useContext(FileTreeContext);

    if (!context) {
        throw new Error("useFileTree must be used within a FileTreeProvider");
    }

    return context;
};
