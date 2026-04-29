import ExplorerTree, { dragState } from './ExplorerTree';
import addFileIcon from "../assets/add_file.svg";
import addDirectoryIcon from "../assets/add_directory.svg";
import { useState } from 'react';
import { useFileTree } from '../contexts/FileTreeContext';
import { findNodeInDir, findNodeShallow, toRelativePath } from '../utils/fsUtils';
import { useToast } from '../hooks/useToast';
import { FsNode } from '../types/FsNode';
import { join } from "@tauri-apps/api/path";
import { useSyncManager } from '../hooks/useSyncManager';
import { invoke } from '@tauri-apps/api/core';
import { useSyncStatus } from '../contexts/SyncContext';
import { ExplorerContextMenu } from './ExplorerContextMenu';
import { ContextMenuOption } from '../types/ContextMenuOption';

function Explorer() {
    const [createType, setCreateType] = useState<String>();
    const [nodeName, setNodeName] = useState<string>("");
    const { root, setRoot, createNode } = useFileTree();
    const [isDragOver, setIsDragOver] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
    const { scheduleSync } = useSyncManager();
    const { syncEnabled } = useSyncStatus();
    const toast = useToast();

    const onCreateFile = () => {
        setCreateType("file");
    }

    const onCreateDirectory = () => {
        setCreateType("directory");
    }

    const handleNameSelection = async () => {
        if (createType === "directory") {
            const newPath = root?.id.concat("\\" + nodeName);
            if (findNodeShallow(root, newPath!)) {
                toast.warning("Directory with this name already exists");
                console.log("Directory already exists");
                return;
            }

            // await invoke("create_directory", { path: newPath });
            createNode(root?.id!, nodeName, true);
        }
        else {
            const newPath = root?.id.concat("\\" + nodeName + ".md");
            if (findNodeShallow(root, newPath!)) {
                toast.warning("File with this name already exists");
                console.log("File already exists");
                return;
            }

            createNode(root?.id!, nodeName, false);
        }

        setCreateType(undefined);
        setNodeName("");
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    }

    const handleNewFile = async () => {
        createNode(root?.id!, "Untitled", false);
    }

    const handleNewDir = async () => {
        createNode(root?.id!, "Untitled", true);
    }

    const contextOptions: ContextMenuOption[] = [
        {
            label: "New File",
            onClick: async () => (await handleNewFile()),
        },
        {
            label: "New Folder",
            onClick: async () => (await handleNewDir()),
        },
    ];

    const moveNotes = async (node: FsNode, parentPath: string) => {
        if (node.kind === "dir") {
            await Promise.all((node.children ?? []).map(async (child) => {
                const newPath = await join(parentPath, child.name);
                await moveNotes(child, newPath);
            }));
            return;
        }

        const oldPath = await toRelativePath(node.id);
        const newPath = await join(parentPath, node.name + ".md");
        const relativeNewPath = await toRelativePath(newPath);
        if (!relativeNewPath) return;

        const id = crypto.randomUUID();
        scheduleSync(`move-note-${id}`, {
            type: "note",
            operation: "move",
            id: String(id),
            payload: { old_path: oldPath, new_path: relativeNewPath },
        });
    };

    const handleSpacerPointerUp = async (_: React.PointerEvent) => {
        if (!dragState) return;

        const targetId = root?.id;
        if (!targetId) return;

        const draggedNode = dragState.node;

        // Already in root
        console.log(findNodeShallow(root, draggedNode.id));
        if (findNodeShallow(root, draggedNode.id)) {
            setIsDragOver(false);
            return;
        }

        const newPath = `${targetId}\\${draggedNode.name}${draggedNode.kind === "file" ? ".md" : ""}`;

        if (findNodeInDir(root, targetId, newPath)) {
            toast.warning("Node in given directory already exists");
            setIsDragOver(false);
            return;
        }

        if (syncEnabled) {
            try {
                await moveNotes(draggedNode, targetId);
            } catch (err) {
                console.error("Couldn't move notes", err);
                setIsDragOver(false);
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
            lastModified: root!.lastModified,
        });

        setIsDragOver(false);
    };

    return (
        <div className='flex flex-col h-full'>
            <div className='h-9 bg-background-secondary' data-tauri-drag-region />
            <div className="flex justify-center py-2 gap-3">
                <button aria-label='CreateFile'><img src={addFileIcon} onClick={onCreateFile} className='w-7 h-7 hover:bg-background-secondary rounded-md' /></button>
                <button aria-label='CreateDirectory'><img src={addDirectoryIcon} onClick={onCreateDirectory} className='w-7 h-7 hover:bg-background-secondary rounded-md' /></button>
                {/*<button><img src={uploadIcon} className='w-7 h-7 hover:bg-background-secondary rounded-md' /></button>*/}
            </div>
            {createType &&
                <div className='flex flex-col px-2 py-1 bg-background-primary mx-1 rounded-md'>
                    <div className='flex items-start justify-between'>
                        <span>Enter name for new {createType}:</span>
                        <button
                            className="ml-4 text-gray-400 transition hover:text-white"
                            onClick={() => setCreateType(undefined)}
                        >
                            ✕
                        </button>
                    </div>
                    <label>
                        <input aria-label="NodeName" value={nodeName} onChange={(e) => setNodeName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleNameSelection(); }}
                            className='w-full h-7 rounded shadow-sm sm:text-sm border-gray-600 bg-gray-900 text-white' />
                    </label>
                </div>
            }
            <ExplorerTree nodes={root?.children ?? []} isRoot={true} />
            <div className={`flex-1 rounded-md transition-colors ${isDragOver ? "bg-button-primary/40" : ""}`}
                data-drop-id={root?.id}
                data-drop-kind="dir"
                data-drag-over="false"
                onContextMenu={handleContextMenu}
                onPointerUp={handleSpacerPointerUp}
                onPointerEnter={() => { if (dragState) setIsDragOver(true); }}
                onPointerLeave={() => setIsDragOver(false)}>
            </div>
            {contextMenu && (
                <ExplorerContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    options={contextOptions}
                    onClose={() => setContextMenu(null)} />
            )}
        </div>
    );
}

export default Explorer
