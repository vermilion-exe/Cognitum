import ExplorerTree from './ExplorerTree';
import addFileIcon from "../assets/add_file.svg";
import addDirectoryIcon from "../assets/add_directory.svg";
import uploadIcon from "../assets/upload.svg";
import { invoke } from '@tauri-apps/api/core';
import { useState } from 'react';
import { useFileTree } from '../contexts/FileTreeContext';
import { FsNode } from '../types/FsNode';

function Explorer() {
    const [createType, setCreateType] = useState<String>();
    const [nodeName, setNodeName] = useState<string>("");
    const { root, setRoot } = useFileTree();

    const onCreateFile = () => {
        setCreateType("file");
    }

    const onCreateDirectory = () => {
        setCreateType("directory");
    }

    const handleNameSelection = async () => {
        if (createType === "directory") {
            await invoke("create_directory", { path: root?.id.concat("/" + nodeName) });
        }
        else {
            await invoke("create_file", { path: root?.id.concat("/" + nodeName + ".md") });
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


        setCreateType(undefined);
        setNodeName("");
    };

    return (
        <div>
            <div className='h-9 bg-background-secondary' data-tauri-drag-region />
            <div className="flex justify-center py-2 gap-3">
                <button><img src={addFileIcon} onClick={onCreateFile} className='w-7 h-7 hover:bg-background-secondary rounded-md' /></button>
                <button><img src={addDirectoryIcon} onClick={onCreateDirectory} className='w-7 h-7 hover:bg-background-secondary rounded-md' /></button>
                <button><img src={uploadIcon} className='w-7 h-7 hover:bg-background-secondary rounded-md' /></button>
            </div>
            {createType &&
                <div className='flex flex-col px-2 py-1 bg-background-primary mx-1 rounded-md'>
                    <span>Enter name for new {createType}:</span>
                    <input name="nodeName" value={nodeName} onChange={(e) => setNodeName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleNameSelection(); }}
                        className='h-7 rounded shadow-sm sm:text-sm border-gray-600 bg-gray-900 text-white' />
                </div>
            }
            <ExplorerTree nodes={root?.children ?? []} isRoot={true} />
        </div>
    );
}

export default Explorer
