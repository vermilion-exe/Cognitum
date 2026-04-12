import { useEffect } from "react";
import { useSyncStatus } from "../contexts/SyncContext";

// Polling interval for sync updates (in milliseconds)
const POLL_INTERVAL_MS = 120000; // 2 minutes

export function useSyncPoller() {
    const { setStatus, fetchUpdates } = useSyncStatus();

    useEffect(() => {
        // Set up interval for periodic polling
        const interval = setInterval(fetchUpdates, POLL_INTERVAL_MS);

        // Cleanup interval on unmount
        return () => clearInterval(interval);
    }, [setStatus, fetchUpdates]);
}
