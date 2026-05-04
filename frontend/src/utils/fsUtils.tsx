import { invoke } from "@tauri-apps/api/core";
import type { FsNode } from "../types/FsNode";

export function normalizePath(path: string) {
    const withForwardSlashes = path.replace(/\\/g, "/");
    const rootPrefix = withForwardSlashes.startsWith("//") ? "//" : withForwardSlashes.startsWith("/") ? "/" : "";
    const normalized = `${rootPrefix}${withForwardSlashes.slice(rootPrefix.length).replace(/\/+/g, "/")}`;
    return normalized.length > rootPrefix.length ? normalized.replace(/\/+$/, "") : normalized;
}

export function normalizePathForComparison(path: string) {
    const normalized = normalizePath(path);
    return /^[a-z]:\//i.test(normalized) ? normalized.toLowerCase() : normalized;
}

export function areSamePath(a: string | undefined, b: string | undefined) {
    if (!a || !b) return false;
    return normalizePathForComparison(a) === normalizePathForComparison(b);
}

export function isPathInsideDir(path: string, dir: string) {
    const normalizedPath = normalizePathForComparison(path);
    const normalizedDir = normalizePathForComparison(dir);

    return normalizedPath === normalizedDir || normalizedPath.startsWith(`${normalizedDir}/`);
}

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
    return collectAllNodes(root?.children ?? []).find(node => areSamePath(node.id, nodeId));
}

export function findNodeInDir(root: FsNode | undefined, targetId: string, newNodeId: string): FsNode | undefined {
    const allNodes = collectAllNodes(root?.children ?? []);
    const targetNode = allNodes.find((node) => areSamePath(node.id, targetId));

    if (!targetNode?.children || targetNode?.children.length === 0) return undefined;

    return targetNode.children.find((node) => areSamePath(node.id, newNodeId));
}

export function findFilesInDir(root: FsNode | undefined, targetId: string): FsNode[] {
    const allNodes = collectAllNodes(root?.children ?? []);
    const targetNode = allNodes.find((node) => areSamePath(node.id, targetId));

    if (!targetNode?.children || targetNode?.children.length === 0) return [];

    const targetChildren = collectAllNodes(targetNode.children);
    return targetChildren.filter((node) => node.kind === "file");
}

export function findNodeShallow(root: FsNode | undefined, nodeId: string): FsNode | undefined {
    return root?.children?.find(node => areSamePath(node.id, nodeId));
}

export async function toRelativePath(fullPath?: string) {
    if (!fullPath) return;

    const normalised = normalizePath(fullPath);

    const cfg = await invoke<{ vaultPath?: string }>("load_config");
    if (!cfg.vaultPath) return;
    const base = normalizePath(cfg.vaultPath);

    return isPathInsideDir(normalised, base) ? normalised.slice(base.length).replace(/^\//, "").toString() : fullPath;
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

export async function updateNoteTimestamp(fileId: string | undefined) {
    if (!fileId) return;
    await invoke("save_note_timestamp", { path: fileId, timestamp: new Date().toISOString() });
}
