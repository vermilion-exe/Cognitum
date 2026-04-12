import { invoke } from "@tauri-apps/api/core";
import type { FsNode } from "../types/FsNode";

export function collectAllNodes(nodes: FsNode[]): FsNode[] {
    return nodes.flatMap(node =>
        node.children ? [node, ...collectAllNodes(node.children)] : [node]
    );
}

export function getFileNodes(root: FsNode | undefined, openIds: Set<string>): FsNode[] {
    return collectAllNodes(root?.children ?? []).filter(
        node => openIds.has(node.id) && node.kind === "file"
    );
}


export async function toRelativePath(fullPath?: string) {
    if (!fullPath) return;

    const normalised = fullPath.replace(/\\/g, "/");

    const cfg = await invoke<{ vaultPath?: string }>("load_config");
    if (!cfg.vaultPath) return;
    const base = cfg.vaultPath.replace(/\\/g, "/");

    return normalised?.startsWith(base) ? normalised.slice(base.length).replace(/^\//, "").toString() : fullPath;
}
