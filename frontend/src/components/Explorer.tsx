import ExplorerTree from './ExplorerTree';
import addFileIcon from "../assets/add_file.svg";
import addDirectoryIcon from "../assets/add_directory.svg";
import uploadIcon from "../assets/upload.svg";
import { useState } from 'react';
import { useFileTree } from '../contexts/FileTreeContext';
import { findNodeShallow } from '../utils/fsUtils';
import { useToast } from '../hooks/useToast';

function Explorer() {
    const [createType, setCreateType] = useState<String>();
    const [nodeName, setNodeName] = useState<string>("");
    const { root, createNode } = useFileTree();
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

    return (
        <div>
            <div className='h-9 bg-background-secondary' data-tauri-drag-region />
            <div className="flex justify-center py-2 gap-3">
                <button><img src={addFileIcon} onClick={onCreateFile} className='w-7 h-7 hover:bg-background-secondary rounded-md' /></button>
                <button><img src={addDirectoryIcon} onClick={onCreateDirectory} className='w-7 h-7 hover:bg-background-secondary rounded-md' /></button>
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
