import { Outlet, useNavigate } from "react-router-dom";
import { SideBar, TitleBar, Explorer } from "./components";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type FsNode = {
    id: string;                 // stable unique id (full path is fine)
    name: string;               // display name
    kind: "dir" | "file";
    children?: FsNode[];        // only for dirs (when loaded/expanded)
};

export default function AppLayout() {
    const [explorerHidden, setExplorerHidden] = useState(false);
    const [root, setRoot] = useState<FsNode>();
    const [openIds, setOpenIds] = useState<Set<String>>(() => new Set());
    const [activeFileId, setActiveFileId] = useState<String>();
    const navigate = useNavigate();

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const cfg = await invoke<{ vaultPath?: string }>("load_config");

            if (!cfg?.vaultPath) {
                navigate("choosePath");
                return;
            }

            const children = await invoke<FsNode[]>("scan_dir", {
                path: cfg.vaultPath,
                recursive: true,
            });

            if (cancelled) return;

            const root: FsNode = {
                id: cfg.vaultPath,
                name: cfg.vaultPath.split(/[\\/]/).filter(Boolean).pop() ?? cfg.vaultPath,
                kind: "dir",
                children: children,
            };

            setRoot(root);
        })();

        return () => {
            cancelled = true;
        };
    }, [navigate]);

    const toggleOpen = (e: React.MouseEvent, node: FsNode) => {
        if (node.kind === "dir") {
            setOpenIds(prev => {
                const next = new Set(prev);
                if (next.has(node.id)) next.delete(node.id);
                else next.add(node.id);
                return next;
            });
        }
        else {
            setOpenIds(prev => {
                const next = new Set(prev);
                if(!e.shiftKey && activeFileId && activeFileId !== node.id && !next.has(node.id)) next.delete(activeFileId);
                if (!next.has(node.id)) next.add(node.id);
                setActiveFileId(node.id);
                return next;
            });
        }
    };

    const closeFile = (id: String) => {
        openIds.delete(id);
        if (activeFileId === id) setActiveFileId(undefined);
    }

    function collectAllNodes(nodes: FsNode[]): FsNode[] {
        return nodes.flatMap(node => node.children ? [node, ...collectAllNodes(node.children)] : [node]);
    }

    const getFileNodes = () => {
        return collectAllNodes(root?.children ?? [])
            .filter(node => openIds.has(node.id) && node.kind === "file") ?? [];
    }

    return (
        <div className="flex h-screen w-screen min-h-0 overflow-hidden text-white">
            <aside className="w-12 shrink-0 ">
                <SideBar explorerHidden={explorerHidden} setExplorerHidden={setExplorerHidden} />
            </aside>
            <div className="outline outline-white/40"></div>
            <aside className={`resize-x overflow-x-auto min-w-50 max-w-200 ${explorerHidden ? "hidden" : ""}`}>
                <Explorer openIds={openIds} toggleOpen={toggleOpen} rootChildren={root?.children ?? []} />
            </aside>
            {/* Always on top */}
            <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
                <header className="h-">
                    <TitleBar activeFileId={activeFileId ?? ""} openFiles={getFileNodes()} closeFile={closeFile} />
                </header>

                {/* Page content starts under the titlebar */}
                <main className="flex-1 overflow-hidden min-h-0">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
