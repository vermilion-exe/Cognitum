import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";

export function useDirectoryWatcher(path: string | null, onChanged: (changedPaths: string[]) => void) {
    const unlistenRef = useRef<UnlistenFn | null>(null);
    const onChangedRef = useRef(onChanged);

    useEffect(() => {
        onChangedRef.current = onChanged;
    }, [onChanged]);

    useEffect(() => {
        if (!path) return;

        invoke("watch_dir", { path });

        listen<string[]>("fs-change", (event) => {
            onChangedRef.current(event.payload);
        }).then((unlisten) => {
            unlistenRef.current = unlisten;
        });

        return () => {
            unlistenRef.current?.();
            invoke("unwatch_dir");
        };
    }, [path]);
}
