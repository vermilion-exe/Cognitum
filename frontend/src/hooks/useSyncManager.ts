import { invoke } from "@tauri-apps/api/core";
import { useCallback, useRef } from "react";
import { useSyncStatus } from "../contexts/SyncContext";
import { SyncOperation } from "../types/SyncOperation";

const DEBOUNCE_MS = 2000;

export function useSyncManager() {
    const { setStatus } = useSyncStatus();
    const queue = useRef<Map<string, SyncOperation>>(new Map());
    const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    const scheduleSync = useCallback(
        (key: string, operation: Omit<SyncOperation, "timestamp">) => {
            setStatus("syncing");

            // Add the sync operation to the queue
            queue.current.set(key, { ...operation, timestamp: Date.now() });

            // Save the sync queue for error resistence
            invoke("save_sync_queue", { queue: Object.fromEntries(queue.current) });

            // If a sync timer for the key already exists, remove it
            if (timers.current.has(key)) {
                clearTimeout(timers.current.get(key)!);
            }

            // Schedule the sync operation
            timers.current.set(
                key,
                setTimeout(async () => {
                    const op = queue.current.get(key);
                    if (!op) return;

                    try {
                        await invoke(`${op.operation}_${op.type}`, { request: op.payload });
                        queue.current.delete(key);

                        invoke("save_sync_queue", { queue: Object.fromEntries(queue.current) });
                        setStatus("idle");
                    } catch (e) {
                        setStatus("error");
                        console.error(`Backup failed for ${key}`, e);
                    }

                    timers.current.delete(key);
                }, DEBOUNCE_MS)
            );
        }, []
    );

    // Function to save local sync timestamp
    const saveLocalTimestamp = useCallback(async (timestamp: number) => {
        await invoke("save_sync_timestamp", { timestamp });
    }, []);

    return { scheduleSync, saveLocalTimestamp };
}
