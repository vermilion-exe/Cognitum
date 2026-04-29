import { getCurrentWindow } from '@tauri-apps/api/window';
import minimizeIcon from '../assets/minimize.svg';
import maximizeIcon from '../assets/maximize.svg';
import closeIcon from '../assets/close.svg';
import { useActiveFile } from '../contexts/ActiveFileContext';
import { useFileTree } from '../contexts/FileTreeContext';

function TitleBar({ isAuth, }: { isAuth: boolean; }) {
    const appWindow = getCurrentWindow();
    const { activeFileId, setActiveFileId } = useActiveFile();
    const { openFileNodes, closeFile } = useFileTree();

    const onMinimize = async () => {
        try {
            await appWindow.minimize();
        }
        catch (e) {
            console.error(e);
        }
    }

    const onMaximize = async () => {
        try {
            const isMaximized = await appWindow.isMaximized();
            if (isMaximized) {
                await appWindow.unmaximize();
            }
            else {
                await appWindow.maximize();
            }
        }
        catch (e) {
            console.error(e);
        }
    }

    const onClose = async () => {
        try {
            await appWindow.close();
        }
        catch (e) {
            console.error(e);
        }
    }

    return (
        <div className="h-9 flex px-2 text-white bg-background-secondary">

            {/* Tabs area */}
            {
                !isAuth && (
                    <div className="tabs flex gap-2 overflow-hidden">
                        {
                            openFileNodes && openFileNodes.map((file, index) => {
                                if (file.id === activeFileId) {
                                    return (
                                        <button key={index} className="active-tab">
                                            <span className='truncate'>
                                                {file.name}
                                            </span>
                                            <img src={closeIcon}
                                                aria-label={file.name + "_close"}
                                                className='w-4 h-4'
                                                onClick={() => closeFile(file.id)} />
                                        </button>)
                                }
                                else {
                                    return (
                                        <button key={index} className="group tab" onClick={() => setActiveFileId(file.id)}>
                                            <span className='truncate'>
                                                {file.name}
                                            </span>
                                            <img src={closeIcon} onClick={(e) => { e.stopPropagation(); closeFile(file.id); }}
                                                className='w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity' />
                                        </button>)
                                }
                            })
                        }
                        {openFileNodes.length > 0 && (<>
                            <div className='outline outline-white/40 mt-4 mb-2.5' />
                            <button className="nodrag mt-2 mb-1 hover:bg-background-secondary">+</button>
                        </>)}
                    </div>
                )
            }

            <div className='flex-1' data-tauri-drag-region></div>

            {/* Window buttons */}
            <div className="ml-auto flex gap-2 nodrag">
                <button onClick={onMinimize}><img className='w-5 h-5' src={minimizeIcon} /></button>
                <button onClick={onMaximize}><img className='w-5 h-5' src={maximizeIcon} /></button>
                <button onClick={onClose}><img className='w-7 h-7' src={closeIcon} /></button>
            </div>
        </div>
    );
}

export default TitleBar
