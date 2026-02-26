import { Outlet } from "react-router-dom";
import SideBar from "./components/SideBar";

export default function SidebarLayout() {
    return (
        <div className="flex h-full min-h-0">
            <aside className="w-12 shrink-0 border-r">
                <SideBar />
            </aside>

            <main className="flex-1 min-w-0 min-h-0 overflow-hidden bg-background-primary">
                <Outlet />
            </main>
        </div>
    );
}
