import { useState } from 'react';
import addFileIcon from '../assets/add_file.svg';
import helpIcon from '../assets/help.svg';
import FileCreationModal from './FileCreationModal';

function EditorOptionScreen() {
    const [isFileCreation, setIsFileCreation] = useState(false);

    return (
        <div className="flex flex-col justify-center h-full items-center gap-10">
            <h1 className="text-5xl">Welcome to Cognitum</h1>
            <div className="flex items-start justify-between w-100">
                <button className="bg-button-secondary border border-gray-400 rounded-md px-5 py-8 flex flex-col items-center gap-1 hover:bg-button-secondary/50" onClick={() => setIsFileCreation(true)}>
                    <img src={addFileIcon} className='w-12 h-12' />
                    Create new file
                </button>
                <button className="bg-button-secondary border border-gray-400 rounded-md px-5 py-8 flex flex-col items-center gap-1 hover:bg-button-secondary/50">
                    <img src={helpIcon} className='w-12 h-12' />
                    Check the guide
                </button>
            </div>
            {isFileCreation && (
                <FileCreationModal setIsModalActive={setIsFileCreation} />
            )}
        </div>
    );
}

export default EditorOptionScreen
