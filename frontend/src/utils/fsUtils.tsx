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
