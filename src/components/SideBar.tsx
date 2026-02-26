import explorerIcon from '../assets/explorer.svg';
import settingsIcon from '../assets/settings.svg';
import userIcon from '../assets/user.svg';
import helpIcon from '../assets/help.svg';

function SideBar({ explorerHidden, setExplorerHidden }: { explorerHidden: boolean, setExplorerHidden: any }) {
    function handleExplorerToggle() {
        setExplorerHidden(!explorerHidden);
    }

    return (
        <div className='flex flex-col gap-6 px-2 py-2'>
            <button onClick={handleExplorerToggle}><img className="w-7 h-5 hover:bg-background-secondary rounded-sm" src={explorerIcon} /></button>
            <button><img className="w-5 h-5 mx-1 hover:bg-background-secondary rounded-sm" src={settingsIcon} /></button>
            <button><img className="w-5 h-5 mx-1 hover:bg-background-secondary rounded-sm" src={userIcon} /></button>
            <button><img className="w-5 h-5 mx-1 hover:bg-background-secondary rounded-sm" src={helpIcon} /></button>
        </div>
    )
}

export default SideBar
