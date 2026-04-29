import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { Crepe } from "@milkdown/crepe";

import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import { listenerCtx } from "@milkdown/plugin-listener";
import { $prose, getMarkdown, replaceAll } from "@milkdown/kit/utils";
import "katex/dist/katex.min.css";
import { useActiveFile } from "../contexts/ActiveFileContext";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { selectionTooltipPlugin } from "../plugins/selectionTooltipPlugin";
import { ResponseHighlight } from "../types/ResponseHighlight";
import { editorViewCtx } from "@milkdown/core";
import { createHighlightPlugin, setFullReplaceMeta, setHighlightsMeta, setLoadingMeta } from "../plugins/highlightPlugin";
import { useSyncManager } from "../hooks/useSyncManager";
import { useSyncStatus } from "../contexts/SyncContext";
import { RequestNote } from "../types/RequestNote";
import { findNodeShallow, toRelativePath } from "../utils/fsUtils";
import { useFileTree } from "../contexts/FileTreeContext";
import { join } from "@tauri-apps/api/path";

const AUTOSAVE_DELAY_MS = 300;

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

        const scheduleAutosave = useCallback(
            (content: string) => {
                cancelAutosave(); // timer reset
                autosaveTimerRef.current = setTimeout(async () => {
                    const fileId = activeFileIdRef.current;
                    if (!fileId) return;
                    try {
                        await invoke("create_file", { path: fileId, contents: content });
                    }
                    catch (e) {
                        console.error("Autosave failed: ", e);
                    }
                }, AUTOSAVE_DELAY_MS);
            },
            [cancelAutosave]
        );

        const flushAutosave = useCallback(async (fileId?: string) => {
            cancelAutosave();
            const targetId = fileId;
            if (!targetId || !crepeRef.current) return;

            try {
                const view = crepeRef.current.editor.action((ctx) => ctx.get(editorViewCtx));
                if (!view || view.isDestroyed) return;

                const content = crepeRef.current.editor.action(getMarkdown());
                await invoke("create_file", { path: targetId, contents: content });
            }
            catch (e) {
                console.error("Flush save failed: ", e);
            }
        }, [cancelAutosave]);

        useEffect(() => {
            if (!hostRef.current) return;

            const crepe = new Crepe({
                root: hostRef.current,
                defaultValue: "",
                featureConfigs: {
                    [Crepe.Feature.ImageBlock]: {
                        onUpload: async (file: File) => {
                            const buffer = await file.arrayBuffer();
                            const node_path = await join(rootRef.current?.id!, file.name);
                            const node = findNodeShallow(rootRef.current, node_path);
                            if (node) {
                                return convertFileSrc(node_path);
                            }
                            const path = await invoke<string>("upload_image", { fileName: file.name, bytes: Array.from(new Uint8Array(buffer)) });

                            const url = convertFileSrc(path);

                            if (syncEnabled) {
                                const id = crypto.randomUUID();
                                scheduleSync(`attachment-${id}`, {
                                    type: "attachment", operation: "create", id: String(id), payload: path
                                });
                            }

                            return url;
                        }
                    }
                }
            });

            crepe.editor.config((ctx => {
                ctx.get(listenerCtx).markdownUpdated(async (_ctx, markdown) => {
                    scheduleAutosave(markdown);
                    cbRef.current.onMarkdownChange?.(markdown);

                    if (!syncEnabled) return;

                    console.log("The markdown changed");
                    if (!currentNoteRef.current && !isCreatingNoteRef.current && !isNoteLoadingRef.current) {
                        isCreatingNoteRef.current = true;
                        try {
                            const path = await toRelativePath(activeFileIdRef.current!);

                            const createdNote = await invoke<RequestNote>("create_note", { request: { id: null, text: markdown, path: path } });
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

                    console.log("Syncing the note changes");
                    isCreatingNoteRef.current = true;
                    scheduleSync(`create-note-${currentNoteRef.current?.id}`,
                        {
                            type: "note", operation: "create", id: String(currentNoteRef.current?.id),
                            payload: { id: currentNoteRef.current?.id, text: markdown, path: currentNoteRef.current?.path, created_at: currentNoteRef.current?.created_at, last_updated: currentNoteRef.current?.last_updated }
                        });
                    setCurrentNote({ ...currentNoteRef.current, text: markdown });
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

            return () => {
                cancelAutosave();
                crepe.destroy();
                crepeRef.current = null;
            };
        }, [cancelAutosave]);

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
