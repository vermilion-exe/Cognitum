import { Outlet } from "react-router-dom";
import { useState } from "react";
import { SideBar, TitleBar, Explorer } from "./components";
import { FileTreeProvider } from "./contexts/FileTreeContext";
import { ActiveFileProvider } from "./contexts/ActiveFileContext";
import { UserProvider } from "./contexts/UserContext";
import { SyncProvider } from "./contexts/SyncContext";
import { useAuthErrorListener } from "./hooks/useAuthErrorListener";
import { useSyncPoller } from "./hooks/useSyncPoller";
import { ToastProvider } from "./contexts/ToastContext";
import { ToastContainer } from "react-toastify";

function AppLayoutInner() {
    useAuthErrorListener();
    useSyncPoller();
    const [explorerHidden, setExplorerHidden] = useState(false);

    return (
        <div className="flex h-screen w-screen min-h-0 overflow-hidden text-white">
            <aside className="w-12 shrink-0 ">
                <SideBar explorerHidden={explorerHidden} setExplorerHidden={setExplorerHidden} />
            </aside>
            <div className="outline outline-white/40"></div>
            <aside className={`resize-x overflow-x-auto min-w-50 max-w-200 ${explorerHidden ? "hidden" : ""}`}>
                <Explorer />
            </aside>
            {/* Always on top */}
            <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
                <header className="h-">
                    <TitleBar isAuth={false} />
                </header>

                {/* Page content starts under the titlebar */}
                <main className="flex-1 overflow-hidden min-h-0">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}

export default function AppLayout() {
    return (
        <ToastProvider>
            <UserProvider>
                <ActiveFileProvider>
                    <SyncProvider>
                        <FileTreeProvider>
                            <AppLayoutInner />
                        </FileTreeProvider>
                    </SyncProvider>
                </ActiveFileProvider>
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
