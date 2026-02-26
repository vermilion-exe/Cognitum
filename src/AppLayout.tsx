import { Outlet } from "react-router-dom";
import { SideBar, TitleBar, Explorer } from "./components";
import { useState } from "react";

export default function AppLayout() {
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
                    <TitleBar />
                </header>

                {/* Page content starts under the titlebar */}
                <main className="flex-1 overflow-hidden min-h-0">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
