import { FsNode } from "../types/FsNode";
import directoryIcon from "../assets/directory.svg";
import openDirectoryIcon from "../assets/directory_open.svg";
import React, { useEffect, useRef, useState } from "react";
import { useActiveFile } from "../contexts/ActiveFileContext";
import { useFileTree } from "../contexts/FileTreeContext";
import { invoke } from "@tauri-apps/api/core";
import { areSamePath, findNode, findNodeInDir, isPathInsideDir, toRelativePath } from "../utils/fsUtils";
import { join } from "@tauri-apps/api/path";
import { createPortal } from "react-dom";
import { useToast } from "../hooks/useToast";
import { useSyncStatus } from "../contexts/SyncContext";
import { ContextMenuOption } from "../types/ContextMenuOption";
import { ExplorerContextMenu } from "./ExplorerContextMenu";
import { useSyncManager } from "../hooks/useSyncManager";

export let dragState: {
    nodeId: string;
    node: FsNode;
} | null = null;

function ExplorerTree({ nodes, depthPipes = [], isRoot, }:
    { nodes: FsNode[]; depthPipes?: boolean[]; isRoot: boolean; }) {
    const { activeFileId } = useActiveFile();
    const { openIds, toggleOpen } = useFileTree();

    return (
        <div className={`flex flex-col gap-2 ${!isRoot ? "ml-9" : ""}`}>
            {
                nodes.map((node, idx) => {
                    const isLast = idx === nodes.length - 1;
                    const nextPipes = [...depthPipes, !isLast];

                    return (
                        <div key={node.id}>
                            <TreeRow node={node} pipes={depthPipes} isLast={isLast} isOpen={openIds.has(node.id)} isActive={node.id === activeFileId} toggleOpen={toggleOpen} />

                            {node.kind === "dir" && openIds.has(node.id) && node.children?.length ? (
                                <div>
                                    <ExplorerTree nodes={node.children} depthPipes={nextPipes} isRoot={false} />
                                </div>
                            ) : null}
                        </div>
                    );
                })
            }
        </div>
    );
}

function TreeRow({ node, pipes, isLast, isOpen, isActive, toggleOpen, }: { node: FsNode; pipes: boolean[]; isLast: boolean; isOpen: boolean; isActive: boolean; toggleOpen: (e: React.MouseEvent, node: FsNode, isNodeCreation: boolean) => void; }) {
    const { root, setRoot, createNode, deleteNode, renameNode } = useFileTree();
    const { syncEnabled } = useSyncStatus();
    const [isDragging, setIsDragging] = useState(false);
    const [newName, setNewName] = useState<string | null>(null);
    const [isRenaming, setIsRenaming] = useState(false);
    const rowRef = useRef<HTMLDivElement>(null);
    const dragStartPos = useRef<{ x: number, y: number } | null>(null);
    const didStartDrag = useRef(false);
    const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
    const toast = useToast();
    const { scheduleSync } = useSyncManager();
    const drag_threshold = 5;

    // Context Menu

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    }

    const handleNewFile = async () => {
        createNode(node.id, "Untitled", false);
        toggleOpen({} as React.MouseEvent, node, true);
    }

    const handleNewDir = async () => {
        createNode(node.id, "Untitled", true);
        toggleOpen({} as React.MouseEvent, node, true);
    }

    const handleDeleteNode = async () => {
        deleteNode(node.id);
    }

    const showRenameInput = () => {
        setIsRenaming(true);
    }

    const handleRenameNode = async () => {
        renameNode(node.id, newName!);
        setNewName(null);
        setIsRenaming(false);
    }

    const contextOptions: ContextMenuOption[] = [
        ...(node.kind === "dir"
            ? [
                {
                    label: "New File",
                    onClick: async () => (await handleNewFile()),
                },
                {
                    label: "New Folder",
                    onClick: async () => (await handleNewDir()),
                },
            ] : []),
        {
            label: "Delete",
            danger: true,
            onClick: async () => (await handleDeleteNode()),
        },
        {
            label: "Rename",
            onClick: () => (showRenameInput()),
        }
    ]

    // Node Drag

    useEffect(() => {
        if (!isDragging) return;

        const onDragOver = (e: PointerEvent) => {
            setDragPos({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener("pointermove", onDragOver);
        return () => window.removeEventListener("pointermove", onDragOver);
    }, [isDragging]);

    const moveNotes = async (node: FsNode, parentPath: string) => {
        if (node.kind === "dir") {
            const newDirPath = await join(parentPath, node.name);
            await Promise.all((node.children ?? []).map(async (child) => {
                await moveNotes(child, newDirPath);
            }));
            return;
        }

        const oldPath = await toRelativePath(node.id);
        const newPath = await join(parentPath, node.name + ".md");
        const relativeNewPath = await toRelativePath(newPath);
        if (!relativeNewPath) return;

        const id = crypto.randomUUID();
        scheduleSync(`move-note-${id}`,
            { type: "note", operation: "move", id: String(id), payload: { old_path: oldPath, new_path: relativeNewPath } });
    }

    const isDescendant = (parentId: string, childId: string): boolean => {
        return isPathInsideDir(childId, parentId) && !areSamePath(parentId, childId);
    }

    const performDrop = async (targetId: string) => {
        if (!dragState) return;

        const draggedNode = findNode(root, dragState.nodeId);
        const base = draggedNode?.kind === "file"
            ? draggedNode?.id.slice(0, -(`${draggedNode?.name}.md`.length))
            : draggedNode?.id.slice(0, -(draggedNode?.name.length));

        if (!draggedNode) return;
        else if (areSamePath(draggedNode.id, targetId)) return;
        else if (areSamePath(targetId, root?.id)) {
            if (areSamePath(targetId, base)) return;
        }
        else {
            if (isDescendant(targetId, draggedNode.id)) return;
        }

        const newPath = await join(targetId, `${draggedNode.name}${draggedNode.kind === "file" ? ".md" : ""}`);

        if (findNodeInDir(root, targetId, newPath)) {
            toast.warning("Node in given directory already exists");
            console.log("Node in directory already exists");
            dragStartPos.current = null;
            setIsDragging(false);
            dragState = null;
            return;
        }

        if (syncEnabled) {
            try {
                await moveNotes(draggedNode, targetId);
            }
            catch (e) {
                console.error("Couldn't move notes");
                dragStartPos.current = null;
                setIsDragging(false);
                dragState = null;
                return;
            }
        }

        await invoke("move_node", { from: draggedNode.id, to: newPath });

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

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.button !== 0) return;

        dragStartPos.current = { x: e.clientX, y: e.clientY };
        didStartDrag.current = false;
    }

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragStartPos.current) return;

        const dx = e.clientX - dragStartPos.current.x;
        const dy = e.clientY - dragStartPos.current.y;

        if (!didStartDrag.current) {
            if (Math.abs(dx) + Math.abs(dy) < drag_threshold) return;
            didStartDrag.current = true;
            setIsDragging(true);
            dragState = { nodeId: node.id, node };
            rowRef.current?.setPointerCapture(e.pointerId);
        }

        setDragPos({ x: e.clientX, y: e.clientY });

        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        document
            .querySelectorAll("[data-drag-over='true']")
            .forEach((el) => el.setAttribute("data-drag-over", "false"));

        const dropTarget = elements.find(
            (el) =>
                el.getAttribute("data-drop-id") !== null &&
                el.getAttribute("data-drop-kind") === "dir" &&
                el.getAttribute("data-drop-id") !== dragState?.nodeId
        );

        if (dropTarget) {
            dropTarget.setAttribute("data-drag-over", "true");
        }
    }

    const handlePointerUp = async (e: React.PointerEvent) => {
        if (rowRef.current?.hasPointerCapture(e.pointerId)) {
            rowRef.current.releasePointerCapture(e.pointerId);
        }

        if (!didStartDrag.current) {
            dragStartPos.current = null;
            if (e.button !== 0) return;
            toggleOpen(e as unknown as React.MouseEvent, node, false);
            return;
        }

        document
            .querySelectorAll("[data-drag-over='true']")
            .forEach((el) => el.setAttribute("data-drag-over", "false"));

        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const dropTarget = elements.find(
            (el) =>
                el.getAttribute("data-drop-id") !== null &&
                el.getAttribute("data-drop-kind") === "dir"
        );

        if (dropTarget && dragState) {
            const targetId = dropTarget.getAttribute("data-drop-id")!;
            await performDrop(targetId);
        }

        dragStartPos.current = null;
        setIsDragging(false);
        dragState = null;
    }

    return (
        <div
            ref={rowRef}
            className={`${isActive ? "active-" : ""}tree-row ${isDragging ? "bg-white/10" : ""}`}
            onContextMenu={handleContextMenu}
            data-drop-id={node.id}
            data-drop-kind={node.kind}
            data-drag-over="false"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{ touchAction: "none" }}
        >
            {contextMenu && (
                <ExplorerContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    options={contextOptions}
                    onClose={() => setContextMenu(null)} />
            )}
            {isDragging && createPortal(
                <div className="flex items-center gap-2 min-w-0 bg-background-primary/20 text-white/20 absolute px-2 py-1 rounded-md w-80" style={{ left: dragPos.x + 12, top: dragPos.y + 12 }}>
                    {node.kind === "dir" ? (isOpen ? (<img className="w-7 h-7" src={openDirectoryIcon} />) : (<img className="w-6 h-6" src={directoryIcon} />)) : null}
                    <span className="tree-label truncate">{node.name}</span>
                </div>, document.body
            )}
            <div className='flex items-stretch'>
                {pipes.map((on, i) => (
                    <div key={i} className="relative">
                        {on ? (<div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />) : null}
                    </div>
                ))}
            </div>

            <div className="relative">
                {!isLast ? (
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
                ) : null}
            </div>

            <div className="flex items-center gap-2 min-w-0">
                {node.kind === "dir" ? (isOpen ? (<img className="w-7 h-7" src={openDirectoryIcon} />) : (<img className="w-6 h-6" src={directoryIcon} />)) : null}
                {isRenaming ? (
                    <input value={newName ?? ""} className="h-7 rounded shadow-sm sm:text-sm border-gray-600 bg-gray-900 text-white"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerUp={(e) => e.stopPropagation()}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRenameNode(); }} />
                ) : (
                    <span aria-label={node.name + "_" + node.kind} className="tree-label truncate">{node.name}</span>
                )
                }
            </div>
        </div>
    );
}

export default ExplorerTree
