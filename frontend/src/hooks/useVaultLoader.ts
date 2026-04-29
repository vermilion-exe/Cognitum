import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import type { FsNode } from "../types/FsNode";

export function useVaultLoader({ setRoot, redirectIfNoVault }: { setRoot: (root: FsNode) => void; redirectIfNoVault: boolean; }) {
    const navigate = useNavigate();

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const cfg = await invoke<{ vaultPath?: string }>("load_config");

            if (!cfg?.vaultPath) {
                if (redirectIfNoVault) navigate("choosePath");
                return;
            }

            const children = await invoke<FsNode[]>("scan_dir", {
                path: cfg.vaultPath,
                recursive: true,
            });

            if (cancelled) return;

            setRoot({
                id: cfg.vaultPath,
                name:
                    cfg.vaultPath.split(/[\\/]/).filter(Boolean).pop() ??
                    cfg.vaultPath,
                kind: "dir",
                children
            });
        })();

        return () => { cancelled = true; };
    }, [navigate, setRoot]);
}
