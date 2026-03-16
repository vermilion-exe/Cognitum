import { FsNode } from "../types/FsNode";
import directoryIcon from "../assets/directory.svg";
import openDirectoryIcon from "../assets/directory_open.svg";
import React, { useState } from "react";
import { useActiveFile } from "../contexts/ActiveFileContext";
import { useFileTree } from "../contexts/FileTreeContext";
import { invoke } from "@tauri-apps/api/core";

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
                                <div onDragOver={(e) => { e.preventDefault(); console.log("drag over tree"); }}>
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

function TreeRow({ node, pipes, isLast, isOpen, isActive, toggleOpen, }: { node: FsNode; pipes: boolean[]; isLast: boolean; isOpen: boolean; isActive: boolean; toggleOpen: (e: React.MouseEvent, node: FsNode) => void; }) {
    const { root, setRoot } = useFileTree();
    const [isDragOver, setIsDragOver] = useState(false);
    const [draggedNode, setDraggedNode] = useState<FsNode>();

    const handleDragStart = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("start dragging node: ", draggedNode?.id);
        setDraggedNode(node);
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("dragging node: ", draggedNode?.id);
        if (node.kind === "dir" && draggedNode?.id !== node.id) {
            setIsDragOver(true);
        }
    }

    const handleDragLeave = () => {
        setIsDragOver(false);
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        if (!draggedNode || node.kind !== "dir" || draggedNode.id === node.id) return;

        const newPath = `${node.id}/${draggedNode.name}`;

        await invoke("move_node", {
            from: draggedNode.id,
            to: newPath,
        });

        const children = await invoke<FsNode[]>("scan_dir", {
            path: root?.id,
            recursive: true,
        });

        console.log("dropped that bitch: ", draggedNode?.id);

        setRoot({
            id: root!.id,
            name: root!.name,
            kind: "dir",
            children,
        });
        setDraggedNode(undefined);
    }

    const handleDragEnd = () => {
        setDraggedNode(undefined);
        setIsDragOver(false);
    }

    return (
        <div
            className={`${isActive ? "active-" : ""}tree-row ${isDragOver ? "bg-white/10" : ""}`} onClick={(e) => toggleOpen(e, node)}
            draggable
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}>
            <div className={`flex items-center gap-2 min-w-0 bg-background-primary/20 text-white/20 absolute w-full px-2 py-1 rounded-md ${!draggedNode ? "hidden" : ""}`} react-cursor-follow>
                {node.kind === "dir" ? (isOpen ? (<img className="w-7 h-7" src={openDirectoryIcon} />) : (<img className="w-6 h-6" src={directoryIcon} />)) : null}
                <span className="tree-label truncate">{node.name}</span>
            </div>
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
                <span className="tree-label truncate">{node.name}</span>
            </div>
        </div>
    );
}

export default ExplorerTree
