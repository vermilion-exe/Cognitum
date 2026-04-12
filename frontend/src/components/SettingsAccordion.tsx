import { useUser } from "../contexts/UserContext";
import userIcon from "../assets/user.svg";
import lockIcon from "../assets/lock.svg";
import deleteIcon from "../assets/delete.svg";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

function SettingsAccordion({ setSettingsHidden }: { setSettingsHidden: (hidden: boolean) => void; }) {
    const { user } = useUser();
    const [noteDirectory, setNoteDirectory] = useState("");

    useEffect(() => {
        const getNoteDirectory = async () => {
            const cfg = await invoke<{ vaultPath?: string }>("load_config");
            if (cfg.vaultPath) setNoteDirectory(cfg.vaultPath!);
        }

        getNoteDirectory();
    }, []);

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
                        <p>{noteDirectory ? noteDirectory : ""}</p>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-center gap-3 border-t border-background-primary p-6 pt-4">
                    <button
                        className="flex gap-1 rounded-lg bg-button-primary px-4 py-2 text-sm text-white transition hover:bg-button-primary/50"
                    //onClick={() => onRegenerate(activeHighlight.id)}
                    >
                        <img src={lockIcon} />
                        Change Password
                    </button>
                    <button
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition hover:bg-red-700"
                    //onClick={() => onDelete(activeHighlight.id)}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SettingsAccordion
