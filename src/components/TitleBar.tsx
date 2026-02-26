import { getCurrentWindow } from '@tauri-apps/api/window';
import minimizeIcon from '../assets/minimize.svg';
import maximizeIcon from '../assets/maximize.svg';
import closeIcon from '../assets/close.svg';

function TitleBar() {
    const appWindow = getCurrentWindow();

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
            <div className="tabs flex gap-2 overflow-hidden">
                <button className="active-tab">new_summaries <img src={closeIcon} className='w-4 h-4' /></button>
                <button className="group tab">new_summaries_2 <img src={closeIcon} className='w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity' /></button>
                <div className='outline outline-white/40 mt-4 mb-2.5'></div>
                <button className="nodrag mt-2 mb-1">+</button>
            </div>

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
