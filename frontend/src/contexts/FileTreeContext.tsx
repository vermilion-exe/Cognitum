import { createContext, useContext, useMemo, useState } from "react";
import type { FsNode } from "../types/FsNode";
import { getFileNodes, toRelativePath } from "../utils/fsUtils";
import { useActiveFile } from "./ActiveFileContext";
import { useVaultLoader } from "../hooks/useVaultLoader";
import { invoke } from "@tauri-apps/api/core";
import { useSyncStatus } from "./SyncContext";
import { useSyncManager } from "../hooks/useSyncManager";

interface FileTreeContextType {
    root: FsNode | undefined;
    setRoot: (root: FsNode) => void;
    openIds: Set<string>;
    openFileNodes: FsNode[];
    toggleOpen: (e: React.MouseEvent, node: FsNode) => void;
    closeFile: (id: string) => void;
    createNode: (targetId: string, nodeName: string, isDirectory: boolean) => void;
}

const FileTreeContext = createContext<FileTreeContextType | undefined>(undefined);

export const FileTreeProvider = ({ children }: { children: React.ReactNode }) => {
    const { activeFileId, setActiveFileId } = useActiveFile();
    const [root, setRoot] = useState<FsNode>();
    const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
    const { syncEnabled, setStatus } = useSyncStatus();
    const { scheduleSync } = useSyncManager();

    useVaultLoader(setRoot);

    const openFileNodes = useMemo(
        () => getFileNodes(root, openIds),
        [root, openIds, activeFileId]
    );

    const toggleOpen = (e: React.MouseEvent, node: FsNode) => {
        if (node.kind === "dir") {
            setOpenIds(prev => {
                const next = new Set(prev);
                if (next.has(node.id)) next.delete(node.id);
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
        if (activeFileId === id) setActiveFileId(undefined);
    };

    const createNode = async (targetId: string, nodeName: string, isDirectory: boolean) => {
        const newPath = `${targetId}\\${nodeName}${!isDirectory ? ".md" : ""}`;
        await invoke(`create_${isDirectory ? "directory" : "file"}`, { path: newPath, ...(!isDirectory && { contents: "" }) });

        if (syncEnabled && !isDirectory) {
            const relativePath = await toRelativePath(newPath);
            const id = crypto.randomUUID();
            setStatus("syncing");
            scheduleSync(`note-${id}`,
                { type: "note", id: String(id), payload: { id: null, text: "", path: relativePath } });
            setStatus("idle");
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
        });
    }

    const deleteNode = async (nodeId: string) {

    }

    return (
        <FileTreeContext.Provider
            value={{ root, setRoot, openIds, openFileNodes, toggleOpen, closeFile, createNode }}
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
