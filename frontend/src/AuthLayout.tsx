import { Outlet } from "react-router-dom";
import TitleBar from ".//components/TitleBar";
import { ActiveFileProvider } from "./contexts/ActiveFileContext";
import { FileTreeProvider } from "./contexts/FileTreeContext";
import { UserProvider } from "./contexts/UserContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ToastContainer } from "react-toastify";
import { VaultProvider } from "./contexts/VaultContext";

export default function AuthLayout() {
    return (
        <ToastProvider>
            <UserProvider>
                <VaultProvider redirectIfNoVault={false}>
                    <ActiveFileProvider>
                        <FileTreeProvider>
                            <div className="h-screen w-screen overflow-hidden text-white">
                                {/* Always on top */}
                                <div className="fixed top-0 left-0 right-0 h-10 z-50">
                                    <TitleBar isAuth={true} />
                                </div>

                                {/* Page content starts under the titlebar */}
                                <div className="pt-10 min-h-screen">
                                    <Outlet />
                                </div>
                            </div>
                        </FileTreeProvider>
                    </ActiveFileProvider>
                </VaultProvider>
            </UserProvider>
            <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                pauseOnHover
                draggable
                theme="dark"
            />
        </ToastProvider>
    );
}
