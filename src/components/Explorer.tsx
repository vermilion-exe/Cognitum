import ExplorerTree from './ExplorerTree';
import addFileIcon from "../assets/add_file.svg";
import addDirectoryIcon from "../assets/add_directory.svg";
import uploadIcon from "../assets/upload.svg";
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

export type FsNode = {
    id: string;                 // stable unique id (full path is fine)
    name: string;               // display name
    kind: "dir" | "file";
    children?: FsNode[];        // only for dirs (when loaded/expanded)
};

function Explorer({ openIds, toggleOpen, rootChildren }: { openIds: Set<String>; toggleOpen: (id: string) => void; rootChildren: FsNode[]; }) {
    const navigate = useNavigate();
    const [root, setRoot] = useState<FsNode>();
    useEffect(() => {
        let cancelled = false;

        (async () => {
            const cfg = await invoke<{ vaultPath?: string }>("load_config");

            if (!cfg?.vaultPath) {
                navigate("choosePath");
                return;
            }

            const children = await invoke<FsNode[]>("scan_dir", {
                path: cfg.vaultPath,
                recursive: true,
            });

            if (cancelled) return;

            const root: FsNode = {
                id: cfg.vaultPath,
                name: cfg.vaultPath.split(/[\\/]/).filter(Boolean).pop() ?? cfg.vaultPath,
                kind: "dir",
                children: children,
            };

            setRoot(root);
        })();

        return () => {
            cancelled = true;
        };
    }, [navigate]);

    return (
        <div>
            <div className='h-9 bg-background-secondary' data-tauri-drag-region />
            <div className="flex justify-center py-2 gap-3">
                <button><img src={addFileIcon} className='w-7 h-7' /></button>
                <button><img src={addDirectoryIcon} className='w-7 h-7' /></button>
                <button><img src={uploadIcon} className='w-7 h-7' /></button>
            </div>
            <ExplorerTree nodes={rootChildren} isRoot={true} openIds={openIds} toggleOpen={toggleOpen} />
        </div>
    );
}

export default Explorer
