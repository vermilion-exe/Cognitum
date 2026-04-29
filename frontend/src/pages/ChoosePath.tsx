import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useNavigate } from "react-router-dom";
import openDirectoryIcon from "../assets/directory_open.svg";
import { useState } from "react";
import { appDataDir, join } from "@tauri-apps/api/path";

function ChoosePath() {
    const [path, setPath] = useState("");
    const navigate = useNavigate();
    const isTestMode = import.meta.env.MODE === 'test';

    function handleReturn() {
        navigate('/');
    }

    const onChoose = async () => {
        console.log(isTestMode);
        if (isTestMode) {
            const baseDir = await appDataDir();
            const filePath = await join(baseDir, 'notes');
            await invoke("save_vault_path", { vaultPath: filePath });
            setPath(filePath);
            return;
        }

        const selected = await open({
            directory: true,
            multiple: false,
            title: "Select a vault folder for your notes",
        });

        if (typeof selected === "string") {
            await invoke("save_vault_path", { vaultPath: selected });
            setPath(selected);
        }
    }

    function onSubmit() {
        if (path) {
            navigate("/mainPage");
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
            <div className='absolute left-5 top-10 text-white text-2xl' onClick={handleReturn}>{'< Back'}</div>
            <h1 className="text-2xl">Choose a folder for your vault:</h1>
            <div className="flex h-8 w-120 items-center cursor-pointer">
                <img aria-label="Browse" src={openDirectoryIcon} className="border border-background-secondary rounded-l-md h-full" onClick={onChoose} />
                <label htmlFor="Directory">
                    <input id="Directory" value={path} placeholder="Choose a directory..." className="flex-1 h-8 w-120 bg-background-primary border border-background-secondary rounded-r-md" disabled />
                </label>
            </div>
            <button aria-label="ChoosePath" className="rounded-md border border-button-secondary bg-button-secondary text-white text-xl px-8" onClick={onSubmit}>Submit</button>
        </div >
    );
}

export default ChoosePath
