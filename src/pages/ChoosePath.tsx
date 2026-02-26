import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useNavigate } from "react-router-dom";

function ChoosePath() {
    const navigate = useNavigate();

    const onChoose = async () => {
        const selected = await open({
            directory: true,
            multiple: false,
            title: "Select a vault folder for your notes",
        });

        if (typeof selected === "string") {
            await invoke("save_vault_path", { vaultPath: selected });
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center">
            <h1>Choose a folder for your vault:</h1>
        </div>
    );
}

export default ChoosePath
