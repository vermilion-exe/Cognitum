import { createContext, useContext, useState } from "react";
import { SyncStatus } from "../types/SyncStatus";

const SyncContext = createContext<{
    status: SyncStatus;
    setStatus: (s: SyncStatus) => void;
    syncEnabled: boolean;
    setSyncEnabled: (enabled: boolean) => void;
}>({ status: "idle", setStatus: () => { }, syncEnabled: true, setSyncEnabled: () => { } });

export function SyncProvider({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<SyncStatus>("idle");
    const [syncEnabled, setSyncEnabled] = useState(true);

    return (
        <SyncContext.Provider value={{ status, setStatus, syncEnabled, setSyncEnabled }}>
            {children}
        </SyncContext.Provider>
    );
}

export const useSyncStatus = () => {
    const context = useContext(SyncContext);
    if (!context) throw new Error("useSyncStatus must be used within an SyncProvider");
    return context;
}
