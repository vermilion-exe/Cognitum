import { invoke } from "@tauri-apps/api/core";
import { useCallback, useRef } from "react";

const DEBOUNCE_MS = 2000;

export function useSyncManager() {
    const queue = useRef<Map<string, SyncOperation>>(new Map());
    const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    const scheduleSync = useCallback(
        (key: string, operation: Omit<SyncOperation, "timestamp">) => {
            queue.current.set(key, { ...operation, timestamp: Date.now() });

            if (timers.current.has(key)) {
                clearTimeout(timers.current.get(key)!);
            }

            timers.current.set(
                key,
                setTimeout(async () => {
                    const op = queue.current.get(key);
                    if (!op) return;

                    try {
                        await invoke(`create_${op.type}`, { request: op.payload });
                        queue.current.delete(key);
                    } catch (e) {
                        console.error(`Backup failed for ${key}`, e);
                    }

                    timers.current.delete(key);
                }, DEBOUNCE_MS)
            );
        }, []
    );

    return { scheduleSync };
}
