import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { Crepe } from "@milkdown/crepe";

import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import { listenerCtx } from "@milkdown/plugin-listener";
import { $prose, getMarkdown, replaceAll } from "@milkdown/kit/utils";
import "katex/dist/katex.min.css";
import { useActiveFile } from "../contexts/ActiveFileContext";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { basename } from "@tauri-apps/api/path";
import { selectionTooltipPlugin } from "../plugins/selectionTooltipPlugin";
import { ResponseHighlight } from "../types/ResponseHighlight";
import { editorViewCtx } from "@milkdown/core";
import { createHighlightPlugin, setFullReplaceMeta, setHighlightsMeta, setLoadingMeta } from "../plugins/highlightPlugin";
import { useSyncManager } from "../hooks/useSyncManager";
import { useSyncStatus } from "../contexts/SyncContext";
import { RequestNote } from "../types/RequestNote";
import { collectAllNodes, isImageNode, toRelativePath } from "../utils/fsUtils";
import { useFileTree } from "../contexts/FileTreeContext";

const AUTOSAVE_DELAY_MS = 300;
const IMAGE_EXTENSIONS = ["apng", "png", "avif", "gif", "jpg", "jpeg", "jfif", "pjpeg", "pjp", "svg", "webp"];

type FileWithPath = File & { path?: string };

const normalizePath = (path: string) => path.replace(/\\/g, "/").toLowerCase();

// Check if a path is inside a given directory
const isPathInsideDir = (path: string, dir: string) => {
    const normalizedPath = normalizePath(path);
    const normalizedDir = normalizePath(dir).replace(/\/+$/, "");

    return normalizedPath === normalizedDir || normalizedPath.startsWith(`${normalizedDir}/`);
};

// Get the original path of a file
const getOriginalFilePath = (file: File) => {
    const path = (file as FileWithPath).path;
    if (!path || path.includes("fakepath")) return undefined;

    return path;
};

// Update Milkdown's link input
const setNativeInputValue = (input: HTMLInputElement, value: string) => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(input, value);
};

export interface TextEditorHandle {
    pushHighlights: (highlights: ResponseHighlight[]) => void;
}

interface TextEditorProps {
    onMarkdownChange?: (markdown: string) => void;
    onExplainText?: (text: string, from: number, to: number) => void;
    onFileLoad?: (fileId: String) => Promise<ResponseHighlight[] | undefined>;
    onHighlightsChange: (highlights: ResponseHighlight[]) => void;
    onHighlightClick: (id: string) => void;
    initialHighlights: ResponseHighlight[];
    isExplanationLoading: boolean;
}

const TextEditor = forwardRef<TextEditorHandle, TextEditorProps>(
    ({ onMarkdownChange, onExplainText, onFileLoad, onHighlightsChange, onHighlightClick, initialHighlights, isExplanationLoading }, ref) => {
        const hostRef = useRef<HTMLDivElement | null>(null);
        const crepeRef = useRef<Crepe | null>(null);
        const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
        const activeFileIdRef = useRef<string | undefined>(null);
        const { activeFileId } = useActiveFile();
        const { markAppFileWrite } = useFileTree();
        const highlightsRef = useRef<ResponseHighlight[]>(initialHighlights);
        const explanationLoadingRef = useRef<boolean>(isExplanationLoading);
        const { scheduleSync } = useSyncManager();
        const { syncEnabled, currentNote, setCurrentNote, isNoteLoading } = useSyncStatus();
        const { root } = useFileTree();
        const rootRef = useRef(root);
        const syncEnabledRef = useRef(syncEnabled);
        const currentNoteRef = useRef(currentNote);
        const isNoteLoadingRef = useRef(false);
        const isCreatingNoteRef = useRef(false);
        const isOpeningImageDialogRef = useRef(false);

        const cbRef = useRef({ onMarkdownChange, onExplainText, onFileLoad, onHighlightsChange, onHighlightClick });
        useEffect(() => { cbRef.current = { onMarkdownChange, onExplainText, onFileLoad, onHighlightsChange, onHighlightClick } });

        useEffect(() => { highlightsRef.current = initialHighlights; }, [initialHighlights]);
        useEffect(() => { explanationLoadingRef.current = isExplanationLoading; }, [isExplanationLoading]);

        useEffect(() => { isNoteLoadingRef.current = isNoteLoading }, [isNoteLoading]);

        useEffect(() => { syncEnabledRef.current = syncEnabled }, [syncEnabled]);
        useEffect(() => { currentNoteRef.current = currentNote }, [currentNote]);

        useEffect(() => { rootRef.current = root }, [root]);

        // useEffect(() => { activeFileIdRef.current = activeFileId }, [activeFileId]);

        useEffect(() => {
            const view = crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx));
            if (!view || view.isDestroyed) return;

            view.dispatch(view.state.tr.setMeta(setLoadingMeta, isExplanationLoading));
        }, [isExplanationLoading]);

        // Set highlight update method for highlight plugin
        useImperativeHandle(ref, () => ({
            pushHighlights: (highlights: ResponseHighlight[]) => {
                crepeRef.current?.editor.action((ctx) => {
                    const view = ctx.get(editorViewCtx);
                    if (view.isDestroyed) return;
                    view.dispatch(view.state.tr.setMeta(setHighlightsMeta, highlights));
                });
            },
        }));

        const cancelAutosave = useCallback(() => {
            if (autosaveTimerRef.current) {
                clearTimeout(autosaveTimerRef.current);
                autosaveTimerRef.current = null;
            }
        }, []);

        // Autosave to save file content when it changes
        const scheduleAutosave = useCallback(
            (content: string) => {
                cancelAutosave(); // timer reset
                autosaveTimerRef.current = setTimeout(async () => {
                    const fileId = activeFileIdRef.current;
                    if (!fileId) return;
                    try {
                        markAppFileWrite(fileId);
                        await invoke("create_file", { path: fileId, contents: content });
                    }
                    catch (e) {
                        console.error("Autosave failed: ", e);
                    }
                }, AUTOSAVE_DELAY_MS);
            },
            [cancelAutosave]
        );

        // Flush pending saves on file change
        const flushAutosave = useCallback(async (fileId?: string) => {
            cancelAutosave();
            const targetId = fileId;
            if (!targetId || !crepeRef.current) return;

            try {
                const view = crepeRef.current.editor.action((ctx) => ctx.get(editorViewCtx));
                if (!view || view.isDestroyed) return;

                const content = crepeRef.current.editor.action(getMarkdown());
                markAppFileWrite(targetId);
                await invoke("create_file", { path: targetId, contents: content });
            }
            catch (e) {
                console.error("Flush save failed: ", e);
            }
        }, [cancelAutosave]);

        // Schedule synchronisation of the uploaded attachment
        const scheduleAttachmentSync = useCallback((path: string, relativePath: string) => {
            if (!syncEnabledRef.current) return;

            const id = crypto.randomUUID();
            scheduleSync(`attachment-${id}`, {
                type: "attachment", operation: "create", id: String(id), payload: { file_path: path, relative_path: relativePath }
            });
        }, [scheduleSync]);

        // Get the image path, upload if not in vault
        const resolveImagePath = useCallback(async (path: string) => {
            const rootId = rootRef.current?.id;

            if (rootId && isPathInsideDir(path, rootId)) {
                return path;
            }

            const bytes = await invoke<number[]>("read_image", { path });
            const fileName = await basename(path);
            const uploadedPath = await invoke<string>("upload_image", { fileName, bytes });

            const relativePath = await toRelativePath(uploadedPath);

            scheduleAttachmentSync(uploadedPath, relativePath!);
            return uploadedPath;
        }, [scheduleAttachmentSync]);

        // Update Milkdown's image block source
        const setImageBlockSrc = useCallback((imageBlock: HTMLElement, url: string) => {
            const view = crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx));
            if (!view || view.isDestroyed) return false;

            const pos = view.posAtDOM(imageBlock, 0);
            const nodePos = [pos, pos - 1].find((candidate) =>
                candidate >= 0 && view.state.doc.nodeAt(candidate)?.type.name === "image-block"
            );
            if (nodePos === undefined) return false;

            view.dispatch(view.state.tr.setNodeAttribute(nodePos, "src", url));
            return true;
        }, []);

        // Fallback for when image block not found
        const setImageBlockInputSrc = useCallback((imageBlock: HTMLElement, url: string) => {
            const input = imageBlock.querySelector<HTMLInputElement>(".link-input-area");
            if (!input) return false;

            input.focus();
            setNativeInputValue(input, url);
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
            return true;
        }, []);

        // Open file dialog for choosing a file
        const handleImageDialogUpload = useCallback(async (imageBlock: HTMLElement) => {
            if (isOpeningImageDialogRef.current) return;

            isOpeningImageDialogRef.current = true;
            try {
                const selected = await open({
                    multiple: false,
                    filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }],
                });

                if (!selected || Array.isArray(selected)) return;

                const path = await resolveImagePath(selected);
                const url = convertFileSrc(path);
                if (!setImageBlockSrc(imageBlock, url)) {
                    setImageBlockInputSrc(imageBlock, url);
                }
            } catch (error) {
                console.error("Image selection failed: ", error);
            } finally {
                isOpeningImageDialogRef.current = false;
            }
        }, [resolveImagePath, setImageBlockInputSrc, setImageBlockSrc]);

        useEffect(() => {
            if (!hostRef.current) return;

            const crepe = new Crepe({
                root: hostRef.current,
                defaultValue: "",
                featureConfigs: {
                    [Crepe.Feature.ImageBlock]: {
                        onUpload: async (file: File) => {
                            // Handle file upload
                            const buffer = await file.arrayBuffer();
                            const originalPath = getOriginalFilePath(file);
                            const node = originalPath ? collectAllNodes(rootRef.current?.children ?? [])
                                .find((node) =>
                                    node.kind === "file" &&
                                    isImageNode(node) &&
                                    normalizePath(node.id) === normalizePath(originalPath)
                                ) : undefined;
                            if (node) {
                                return convertFileSrc(node.id);
                            }
                            const path = await invoke<string>("upload_image", { fileName: file.name, bytes: Array.from(new Uint8Array(buffer)) });

                            const url = convertFileSrc(path);

                            const relativePath = await toRelativePath(path);

                            scheduleAttachmentSync(path, relativePath!);

                            return url;
                        }
                    }
                }
            });

            crepe.editor.config((ctx => {
                ctx.get(listenerCtx).markdownUpdated(async (_ctx, markdown) => {
                    // The config used when the markdown is updated
                    scheduleAutosave(markdown);
                    cbRef.current.onMarkdownChange?.(markdown);
                    const lastUpdated = new Date().toISOString();
                    await invoke("save_note_timestamp", { path: activeFileIdRef.current, timestamp: lastUpdated });

                    if (!syncEnabledRef.current) return;

                    // If sync is enabled and the note does not exist yet, create one and set current note
                    console.log("The markdown changed");
                    if (!currentNoteRef.current && !isCreatingNoteRef.current && !isNoteLoadingRef.current) {
                        isCreatingNoteRef.current = true;
                        try {
                            const path = await toRelativePath(activeFileIdRef.current!);
                            const now = new Date().toISOString();

                            const createdNote = await invoke<RequestNote>("create_note", { request: { id: null, text: markdown, path: path, created_at: now, last_updated: now } });
                            setCurrentNote(createdNote);
                        }
                        catch (e) {
                            console.error("Error creating note: ", e);
                        }
                        finally {
                            isCreatingNoteRef.current = false;
                        }
                    }

                    if (isCreatingNoteRef.current || !currentNoteRef.current) return;

                    // Otherwise, update the existing note in DB
                    console.log("Syncing the note changes");
                    isCreatingNoteRef.current = true;
                    scheduleSync(`create-note-${currentNoteRef.current?.id}`,
                        {
                            type: "note", operation: "create", id: String(currentNoteRef.current?.id),
                            payload: { id: currentNoteRef.current?.id, text: markdown, path: currentNoteRef.current?.path, created_at: currentNoteRef.current?.created_at, last_updated: lastUpdated }
                        });
                    setCurrentNote({ ...currentNoteRef.current, text: markdown, last_updated: lastUpdated });
                    isCreatingNoteRef.current = false;
                })
            }))
                .use(
                    $prose(() =>
                        selectionTooltipPlugin((text, from, to) =>
                            cbRef.current.onExplainText?.(text, from, to)
                        )
                    )
                )
                .use(
                    $prose(() =>
                        createHighlightPlugin({
                            getHighlights: () => highlightsRef.current,
                            onHighlightsChange: (h) => cbRef.current.onHighlightsChange(h),
                            onHighlightClick: (id) => cbRef.current.onHighlightClick(id)
                        })
                    ));

            crepe.create();

            crepeRef.current = crepe;

            // Override the image upload logic
            const onImageUploadClick = (event: MouseEvent) => {
                const target = event.target;
                if (!(target instanceof Element)) return;

                const uploader = target.closest(".milkdown-image-block .uploader");
                const imageBlock = target.closest(".milkdown-image-block");
                if (!(uploader instanceof HTMLElement) || !(imageBlock instanceof HTMLElement)) return;

                event.preventDefault();
                event.stopPropagation();
                handleImageDialogUpload(imageBlock);
            };

            const host = hostRef.current;
            host.addEventListener("click", onImageUploadClick, true);

            return () => {
                cancelAutosave();
                host.removeEventListener("click", onImageUploadClick, true);
                crepe.destroy();
                crepeRef.current = null;
            };
        }, [cancelAutosave, handleImageDialogUpload, scheduleAttachmentSync]);

        useEffect(() => {
            if (!activeFileId) {
                activeFileIdRef.current = null;
                return;
            }

            const previousFileId = activeFileIdRef.current;
            activeFileIdRef.current = activeFileId;

            flushAutosave(previousFileId!).then(async () => {
                const highlights = await (cbRef.current.onFileLoad?.(activeFileIdRef.current!));
                highlightsRef.current = highlights!;

                const content = await invoke<string>("read_file", { path: activeFileIdRef.current });
                crepeRef.current?.editor.action(replaceAll(String(content)));

                const view = crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx));
                if (view && !view.isDestroyed) {
                    view.dispatch(view.state.tr.setMeta(setFullReplaceMeta, true));
                }
            })
        }, [activeFileId, cancelAutosave, flushAutosave]);

        return <div className="h-full w-full min-h-0 nodrag overflow-x-hidden overflow-y-auto" ref={hostRef} />;
    });

export default TextEditor;
