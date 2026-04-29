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

export function findNode(root: FsNode | undefined, nodeId: string): FsNode | undefined {
    return collectAllNodes(root?.children ?? []).filter(node => node.id === nodeId)[0];
}

export function findNodeInDir(root: FsNode | undefined, targetId: string, newNodeId: string): FsNode | undefined {
    const allNodes = collectAllNodes(root?.children ?? []);
    const targetNode = allNodes.find((node) => node.id === targetId);

    if (!targetNode?.children || targetNode?.children.length === 0) return undefined;

    return targetNode.children.find((node) => node.id === newNodeId);
}

export function findFilesInDir(root: FsNode | undefined, targetId: string): FsNode[] {
    const allNodes = collectAllNodes(root?.children ?? []);
    const targetNode = allNodes.find((node) => node.id === targetId);

    if (!targetNode?.children || targetNode?.children.length === 0) return [];

    const targetChildren = collectAllNodes(targetNode.children);
    return targetChildren.filter((node) => node.kind === "file");
}

export function findNodeShallow(root: FsNode | undefined, nodeId: string): FsNode | undefined {
    return root?.children!.filter(node => node.id === nodeId)[0];
}

export async function toRelativePath(fullPath?: string) {
    if (!fullPath) return;

    const normalised = fullPath.replace(/\\/g, "/");

    const cfg = await invoke<{ vaultPath?: string }>("load_config");
    if (!cfg.vaultPath) return;
    const base = cfg.vaultPath.replace(/\\/g, "/");

    return normalised?.startsWith(base) ? normalised.slice(base.length).replace(/^\//, "").toString() : fullPath;
}

export function isImage(root: FsNode | undefined, path: string) {
    const node = findNode(root, path);
    if (!node?.extension) return;

    const imageExtensions = ["apng", "png", "avif", "gif", "jpg", "jpeg", "jfif", "pjpeg", "pjp", "svg", "webp"];

    return imageExtensions.includes(node?.extension);
}

export function isImageNode(node: FsNode) {
    if (!node?.extension) return;

    const imageExtensions = ["apng", "png", "avif", "gif", "jpg", "jpeg", "jfif", "pjpeg", "pjp", "svg", "webp"];

    return imageExtensions.includes(node?.extension);
}
