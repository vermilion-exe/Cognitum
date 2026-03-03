import ExplorerTree from './ExplorerTree';
import addFileIcon from "../assets/add_file.svg";
import addDirectoryIcon from "../assets/add_directory.svg";
import uploadIcon from "../assets/upload.svg";
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export type FsNode = {
    id: string;                 // stable unique id (full path is fine)
    name: string;               // display name
    kind: "dir" | "file";
    children?: FsNode[];        // only for dirs (when loaded/expanded)
    isOpen?: boolean;           // UI state (expanded/collapsed)
};

function Explorer() {
    // const children = await invoke<FsNode[]>("scan_dir", {
    //     path: rootPath,
    //     recursive: true,
    // });
    const navigate = useNavigate();
    const [root, setRoot] = useState<FsNode>();
    loadTree();

    const rootChildren: FsNode[] = [
        {
            id: "/Algorithms and Data Structures",
            name: "Algorithms and Data Structures",
            kind: "dir",
            isOpen: true,
            children: [
                { id: "/Algorithms and Data Structures/Sorting Algorithms", name: "Sorting Algorithms", kind: "file" },
                { id: "/Algorithms and Data Structures/Search Algorithms", name: "Search Algorithms", kind: "file" }
            ]
        },
        {
            id: "/Object Oriented Programming",
            name: "Object Oriented Programming",
            kind: "dir",
            isOpen: true,
            children: [
                {
                    id: "/Object Oriented Programming/SOLID Principles",
                    name: "SOLID Principles",
                    kind: "dir",
                    isOpen: true,
                    children: [
                        { id: "/Object Oriented Programming/SOLID Principles/Abstraction", name: "Abstraction", kind: "file" },
                        { id: "/Object Oriented Programming/SOLID Principles/Polymorphism", name: "Polymorphism", kind: "file" }
                    ]
                }
            ]
        },
        {
            "id": "/Software Engineering",
            "name": "Software Engineering",
            "kind": "dir",
            "isOpen": false,
            "children": []
        }
    ];

    async function loadTree() {
        const cfg = await invoke<{ vaultPath?: string }>("load_config");

        if (!cfg || !cfg.vaultPath) {
            navigate("choosePath");
        }
        else {
            const children = await invoke<FsNode[]>("scan_dir", {
                path: cfg.vaultPath,
                recursive: true,
            });

            const root: FsNode = {
                id: cfg.vaultPath,
                name: cfg.vaultPath.split(/[\\/]/).filter(Boolean).pop() ?? cfg.vaultPath,
                kind: "dir",
                isOpen: true,
                children: children,
            };

            setRoot(root);
        }
    }

    {/* return (
        <div>
            <div className="flex justify-center w-50 py-2 gap-3">
                <button><img src={addFileIcon} className='w-7 h-7' /></button>
                <button><img src={addDirectoryIcon} className='w-7 h-7' /></button>
                <button><img src={uploadIcon} className='w-7 h-7' /></button>
            </div>
            <div className='flex flex-col gap-2'>
                <div className='flex px-2 overflow-hidden items-center gap-1'>
                    <img src={directoryOpenIcon} className='w-7 h-7' /> Algorithms and Data Structures
                </div>
                <div className='px-12 mx-2 rounded-md bg-background-secondary/60'>
                    Sorting Algorithms
                </div>
                <div className='px-12 mx-2 rounded-md hover:bg-background-secondary/60'>
                    Search Algorithms
                </div>
                <div className='flex px-2 overflow-hidden items-center gap-1'>
                    <img src={directoryOpenIcon} className='w-7 h-7' /> Object Oriented Programming
                </div>
                <div className='flex px-12 overflow-hidden items-center gap-1'>
                    <img src={directoryOpenIcon} className='w-7 h-7' /> SOLID Principles
                </div>
                <div className='px-20 mx-2 rounded-md hover:bg-background-secondary'>
                    Abstraction
                </div>
                <div className='px-20 mx-2 rounded-md hover:bg-background-secondary'>
                    Polymorphism
                </div>
                <div className='flex px-2 overflow-hidden items-center gap-2'>
                    <img src={directoryIcon} className='w-6 h-6' /> Software Engineering
                </div>
            </div>
        </div>
    ); */}

    return (
        <div>
            <div className='h-9 bg-background-secondary' data-tauri-drag-region />
            <div className="flex justify-center py-2 gap-3">
                <button><img src={addFileIcon} className='w-7 h-7' /></button>
                <button><img src={addDirectoryIcon} className='w-7 h-7' /></button>
                <button><img src={uploadIcon} className='w-7 h-7' /></button>
            </div>
            <ExplorerTree nodes={root?.children ?? []} isRoot={true} />
        </div>
    );
}

export default Explorer
