import { createContext, useContext, useMemo, useState } from "react";
import type { FsNode } from "../types/FsNode";
import { getFileNodes } from "../utils/fsUtils";
import { useActiveFile } from "./ActiveFileContext";
import { useVaultLoader } from "../hooks/useVaultLoader";

interface FileTreeContextType {
    root: FsNode | undefined;
    setRoot: (root: FsNode) => void;
    openIds: Set<string>;
    openFileNodes: FsNode[];
    toggleOpen: (e: React.MouseEvent, node: FsNode) => void;
    closeFile: (id: string) => void;
}

const FileTreeContext = createContext<FileTreeContextType | undefined>(undefined);

export const FileTreeProvider = ({ children }: { children: React.ReactNode }) => {
    const { activeFileId, setActiveFileId } = useActiveFile();
    const [root, setRoot] = useState<FsNode>();
    const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

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

    return (
        <FileTreeContext.Provider
            value={{ root, setRoot, openIds, openFileNodes, toggleOpen, closeFile }}
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
