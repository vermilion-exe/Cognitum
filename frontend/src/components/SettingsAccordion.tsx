import { useUser } from "../contexts/UserContext";
import userIcon from "../assets/user.svg";
import lockIcon from "../assets/lock.svg";
import deleteIcon from "../assets/delete.svg";
import openDirectoryIcon from "../assets/directory_open.svg";
import logoutIcon from "../assets/log_out.svg";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import Switch from "@mui/material/Switch";
import { useSyncStatus } from "../contexts/SyncContext";

function SettingsAccordion({ setSettingsHidden }: { setSettingsHidden: (hidden: boolean) => void; }) {
    const { user } = useUser();
    const [noteDirectory, setNoteDirectory] = useState("");
    const { syncEnabled, setSyncEnabled } = useSyncStatus();
    const [isDeletionConfirmation, setIsDeletionConfirmation] = useState(false);
    const [isPasswordChange, setIsPasswordChange] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const getNoteDirectory = async () => {
            const cfg = await invoke<{ vaultPath?: string }>("load_config");
            if (cfg.vaultPath) setNoteDirectory(cfg.vaultPath!);
        }

        getNoteDirectory();
    }, []);

    useEffect(() => {
        if (!isPasswordChange) {
            setNewPassword("");
            setConfirmPassword("");
        }
    }, [isPasswordChange]);

    const handleLogout = async () => {
        try {
            await invoke("logout");
            await invoke("clear_user");
            await invoke("clear_token", { isRefreshToken: false });
            await invoke("clear_token", { isRefreshToken: true });
            await invoke("delete_local_summaries");
            await invoke("delete_local_highlight_data");
            await invoke("delete_local_flashcards");
            await invoke("delete_app_data");
            await invoke("delete_note_metadata");
        }
        catch (e) {
            console.error("Could not log out:", e);
        }
        finally {
            navigate("/");
        }
    }

    const handleDeleteAccount = async () => {
        try {
            await invoke("delete_user");
            await invoke("clear_user");
            await invoke("clear_token", { isRefreshToken: false });
            await invoke("clear_token", { isRefreshToken: true });
            await invoke("delete_local_summaries");
            await invoke("delete_local_highlight_data");
            await invoke("delete_local_flashcards");
            await invoke("delete_app_data");
            await invoke("delete_note_metadata");
        }
        catch (e) {
            console.error("Could not delete account:", e);
        }
        finally {
            navigate("/");
        }
    }

    const handleChangePassword = async () => {
        try {
            await invoke("email_send_code", { email: user?.email, isChangePassword: true });
            navigate("/emailConfirmation", {
                state: {
                    isPasswordChange: true,
                    newPassword: newPassword,
                    confirmPassword: confirmPassword,
                }
            });
        }
        catch (e) {
            console.log("Could not change password:", e);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setSettingsHidden(true)}
        >
            {isDeletionConfirmation && (
                <div
                    className="fixed inset-0 z-60 flex items-center justify-center
                        bg-black/80 backdrop-blur-sm"
                    onClick={() => setIsDeletionConfirmation(false)}
                >
                    <div
                        className="relative rounded-xl bg-background-primary shadow-2xl
                        p-6 max-w-sm mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-semibold text-white mb-2">
                            Delete Account
                        </h2>
                        <p className="text-gray-300 mb-6">
                            Are you sure you want to delete your account? This action cannot
                            be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                className="rounded-lg bg-button-secondary px-4 py-2 text-sm
                            text-white transition hover:bg-button-secondary/50"
                                onClick={() => setIsDeletionConfirmation(false)}
                            >
                                Cancel
                            </button>
                            <button aria-label="ConfirmAccountDeletion"
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white
                            transition hover:bg-red-700"
                                onClick={handleDeleteAccount}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {
                isPasswordChange && (
                    <div
                        className="fixed inset-0 z-60 flex items-center justify-center
                        bg-black/80 backdrop-blur-sm"
                        onClick={() => setIsPasswordChange(false)}>
                        <div
                            className="relative rounded-xl bg-background-primary shadow-2xl
                        p-6 max-w-sm mx-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-xl font-semibold text-white mb-2">
                                Change Password
                            </h2>
                            <div className="">
                                <label htmlFor='Password' className='relative'>
                                    <input type='password' id='NewPassword' placeholder='' value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                                        className='peer mt-0.5 w-full rounded shadow-sm sm:text-sm border-gray-600 bg-gray-900 text-white mb-3' />

                                    <span className='absolute inset-y-0 start-3 -translate-y-4.5 px-0.5 text-sm font-medium transition-transform peer-placeholder-shown:translate-y-0 peer-focus:-translate-y-4.5 text-white'>
                                        New Password
                                    </span>
                                </label>
                                <label htmlFor='Password' className='relative'>
                                    <input type='password' id='ConfirmPassword' placeholder='' value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                        className='peer mt-0.5 w-full rounded shadow-sm sm:text-sm border-gray-600 bg-gray-900 text-white mb-3' />

                                    <span className='absolute inset-y-0 start-3 -translate-y-4.5 px-0.5 text-sm font-medium transition-transform peer-placeholder-shown:translate-y-0 peer-focus:-translate-y-4.5 text-white'>
                                        Confirm Password
                                    </span>
                                </label>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    className="rounded-lg bg-button-secondary px-4 py-2 text-sm
                            text-white transition hover:bg-button-secondary/50"
                                    onClick={() => setIsPasswordChange(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="rounded-lg bg-button-primary px-4 py-2 text-sm text-white
                            transition hover:bg-button-primary/50"
                                    onClick={handleChangePassword}
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
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
                    <div>
                        <h1 className="text-xl">Cloud Synchronisation</h1>
                        <Switch className="-mx-2" checked={syncEnabled} onChange={(_, checked) => setSyncEnabled(checked)} />
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-center gap-3 border-t border-background-primary p-6 pt-4">
                    <button
                        className="flex gap-1 rounded-lg bg-button-primary px-4 py-2 text-sm text-white transition hover:bg-button-primary/50 w-45 items-center"
                        onClick={() => setIsPasswordChange(true)}
                    >
                        <img src={lockIcon} />
                        Change Password
                    </button>
                    <button aria-label="DeleteAccount"
                        className="flex gap-1 rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition hover:bg-red-700 w-45 items-center"
                        onClick={() => setIsDeletionConfirmation(true)}
                    >
                        <img src={deleteIcon} />
                        Delete Account
                    </button>
                    <button aria-label="Logout" className="flex gap-1 rounded-lg bg-button-secondary px-4 py-2 text-sm text-white transition hover:bg-button-secondary/50 w-45 items-center" onClick={handleLogout}>
                        <img src={logoutIcon} className="w-4 h-4" />
                        Logout
                    </button>
                </div>
            </div>
        </div >
    );
}

export default SettingsAccordion
