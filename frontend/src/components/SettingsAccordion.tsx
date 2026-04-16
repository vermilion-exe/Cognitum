import { useUser } from "../contexts/UserContext";
import userIcon from "../assets/user.svg";
import lockIcon from "../assets/lock.svg";
import deleteIcon from "../assets/delete.svg";
import openDirectoryIcon from "../assets/directory_open.svg";
import logoutIcon from "../assets/log_out.svg";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";

function SettingsAccordion({ setSettingsHidden }: { setSettingsHidden: (hidden: boolean) => void; }) {
    const { user } = useUser();
    const [noteDirectory, setNoteDirectory] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const getNoteDirectory = async () => {
            const cfg = await invoke<{ vaultPath?: string }>("load_config");
            if (cfg.vaultPath) setNoteDirectory(cfg.vaultPath!);
        }

        getNoteDirectory();
    }, []);

    const handleLogout = async () => {
        try {
            await invoke("logout");
            await invoke("clear_user");
            await invoke("clear_token", { isRefreshToken: false });
            await invoke("clear_token", { isRefreshToken: true });
        }
        catch (e) {
            console.error("Could not log out:", e);
        }
        finally {
            navigate("/");
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setSettingsHidden(true)}
        >
            <div
                className="relative mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-background-primary shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-background-secondary p-6 pb-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-white">Settings</h1>
                    </div>
                    <button
                        className="ml-4 text-gray-400 transition hover:text-white"
                        onClick={() => setSettingsHidden(true)}
                    >
                        ✕
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex flex-col p-6 gap-4">
                    <div className="flex items-center gap-4">
                        <img src={userIcon} className="w-14 h-14" />
                        <h1 className="text-xl">{user ? user.username : "Guest User"}</h1>
                    </div>
                    <div>
                        <h1 className="text-xl">Email</h1>
                        <p>{user ? user.email : "No email"}</p>
                    </div>
                    <div>
                        <h1 className="text-xl">Note Directory</h1>
                        <div className="flex h-6 w-120 items-center cursor-pointer">
                            <img src={openDirectoryIcon} className="border border-background-secondary rounded-l-md h-full" />
                            <p className="border border-background-secondary rounded-r-md">{noteDirectory ? noteDirectory : ""}</p>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-center gap-3 border-t border-background-primary p-6 pt-4">
                    <button
                        className="flex gap-1 rounded-lg bg-button-primary px-4 py-2 text-sm text-white transition hover:bg-button-primary/50 w-45 items-center"
                    //onClick={() => onRegenerate(activeHighlight.id)}
                    >
                        <img src={lockIcon} />
                        Change Password
                    </button>
                    <button
                        className="flex gap-1 rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition hover:bg-red-700 w-45 items-center"
                    //onClick={() => onDelete(activeHighlight.id)}
                    >
                        <img src={deleteIcon} />
                        Delete Account
                    </button>
                    <button className="flex gap-1 rounded-lg bg-button-secondary px-4 py-2 text-sm text-white transition hover:bg-button-secondary/50 w-45 items-center" onClick={handleLogout}>
                        <img src={logoutIcon} className="w-4 h-4" />
                        Logout
                    </button>
                </div>
            </div>
        </div >
    );
}

export default SettingsAccordion
