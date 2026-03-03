import ExplorerTree from './ExplorerTree';
import addFileIcon from "../assets/add_file.svg";
import addDirectoryIcon from "../assets/add_directory.svg";
import uploadIcon from "../assets/upload.svg";
import { FsNode } from '../AppLayout';

function Explorer({ openIds, toggleOpen, rootChildren }: { openIds: Set<String>; toggleOpen: (e: React.MouseEvent, node: FsNode) => void; rootChildren: FsNode[]; }) {
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
