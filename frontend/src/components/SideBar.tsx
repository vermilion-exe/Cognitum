import explorerIcon from '../assets/explorer.svg';
import settingsIcon from '../assets/settings.svg';
import helpIcon from '../assets/help.svg';
import { useState } from 'react';
import SettingsAccordion from './SettingsAccordion';
import Manual from './Manual';

function SideBar({ explorerHidden, setExplorerHidden }: { explorerHidden: boolean, setExplorerHidden: any }) {
    const [settingsHidden, setSettingsHidden] = useState(true);
    const [manualHidden, setManualHidden] = useState(true);

    function handleExplorerToggle() {
        setExplorerHidden(!explorerHidden);
    }

    return (
        <div className='flex flex-col gap-6 px-2 py-2'>
            <button onClick={handleExplorerToggle}><img className="w-7 h-5 hover:bg-background-secondary rounded-sm" src={explorerIcon} /></button>
            <button aria-label='Settings' onClick={() => setSettingsHidden((prev) => !prev)}><img className="w-5 h-5 mx-1 hover:bg-background-secondary rounded-sm" src={settingsIcon} /></button>
            {/*<button><img className="w-5 h-5 mx-1 hover:bg-background-secondary rounded-sm" src={userIcon} /></button>*/}
            <button onClick={() => setManualHidden(false)}><img className="w-5 h-5 mx-1 hover:bg-background-secondary rounded-sm" src={helpIcon} /></button>
            {!settingsHidden && (
                <SettingsAccordion setSettingsHidden={setSettingsHidden} />
            )}
            {!manualHidden && (
                <Manual setIsManualHidden={setManualHidden} />
            )}
        </div>
    )
}

export default SideBar
