import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useNavigate } from "react-router-dom";
import openDirectoryIcon from "../assets/directory_open.svg";
import { useState } from "react";

function ChoosePath() {
    const [path, setPath] = useState("");
    const navigate = useNavigate();

    function handleReturn() {
        navigate('/');
    }

    const onChoose = async () => {
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
            <div className="flex h-8 w-120 items-center cursor-pointer" onClick={onChoose}>
                <img src={openDirectoryIcon} className="border border-background-secondary rounded-l-md h-full" />
                <input value={path} placeholder="Choose a directory..." className="flex-1 bg-background-primary border border-background-secondary rounded-r-md h-full" disabled />
            </div>
            <button className="rounded-md border border-button-secondary bg-button-secondary text-white text-xl px-8" onClick={onSubmit}>Submit</button>
        </div >
    );
}

export default ChoosePath
