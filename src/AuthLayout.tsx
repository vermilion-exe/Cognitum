import { Outlet } from "react-router-dom";
import TitleBar from ".//components/TitleBar";

export default function AuthLayout() {
    return (
        <div className="h-screen w-screen overflow-hidden text-white">
            {/* Always on top */}
            <div className="fixed top-0 left-0 right-0 h-10 z-50">
                <TitleBar />
            </div>

            {/* Page content starts under the titlebar */}
            <div className="pt-10 min-h-screen">
                <Outlet />
            </div>
        </div>
    );
}
