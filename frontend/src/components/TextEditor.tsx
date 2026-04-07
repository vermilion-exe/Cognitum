import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Crepe } from "@milkdown/crepe";

import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import { listenerCtx } from "@milkdown/plugin-listener";
import { $prose, getMarkdown, replaceAll } from "@milkdown/kit/utils";
import "katex/dist/katex.min.css";
import { useActiveFile } from "../contexts/ActiveFileContext";
import { invoke } from "@tauri-apps/api/core";
import { selectionTooltipPlugin } from "../plugins/selectionTooltipPlugin";
import { ResponseHighlight } from "../types/ResponseHighlight";
import { editorViewCtx } from "@milkdown/core";
import { createHighlightPlugin, highlightPluginKey, setHighlightsMeta, setLoadingMeta } from "../plugins/highlightPlugin";
import { useSyncManager } from "../hooks/useSyncManager";
import { useSyncStatus } from "../contexts/SyncContext";
import { RequestNote } from "../types/RequestNote";
import { appDataDir } from "@tauri-apps/api/path";

const AUTOSAVE_DELAY_MS = 300;
const appDataDirPath = await appDataDir();

export interface TextEditorHandle {
    pushHighlights: (highlights: ResponseHighlight[]) => void;
}

interface TextEditorProps {
    onMarkdownChange?: (markdown: string) => void;
    onExplainText?: (text: string, from: number, to: number) => void;
    onFileLoad?: (fileId: String) => Promise<ResponseHighlight[]>;
    onHighlightsChange: (highlights: ResponseHighlight[]) => void;
    onHighlightClick: (id: string) => void;
    initialHighlights: ResponseHighlight[];
    isExplanationLoading: boolean;
}

const TextEditor = forwardRef<TextEditorHandle, TextEditorProps>(({ onMarkdownChange, onExplainText, onFileLoad, onHighlightsChange, onHighlightClick, initialHighlights, isExplanationLoading }, ref) => {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const crepeRef = useRef<Crepe | null>(null);
    const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeFileIdRef = useRef<string | null>(null);
    const highlightsRef = useRef<ResponseHighlight[]>(initialHighlights);
    const explanationLoadingRef = useRef<boolean>(isExplanationLoading);
    const { scheduleSync } = useSyncManager();
    const { syncEnabled, setStatus } = useSyncStatus();
    const [currentNote, setCurrentNote] = useState<RequestNote>();
    const isCreatingNoteRef = useRef(false);

    useEffect(() => {
        if (!activeFileIdRef.current || !syncEnabled) return;

        const relativePath
    })

    const cbRef = useRef({ onMarkdownChange, onExplainText, onFileLoad, onHighlightsChange, onHighlightClick });
    useEffect(() => { cbRef.current = { onMarkdownChange, onExplainText, onFileLoad, onHighlightsChange, onHighlightClick } });

    useEffect(() => { highlightsRef.current = initialHighlights; }, [initialHighlights]);
    useEffect(() => { explanationLoadingRef.current = isExplanationLoading; }, [isExplanationLoading]);

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

    const { activeFileId } = useActiveFile();

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

    const flushAutosave = useCallback(async () => {
        cancelAutosave();
        const fileId = activeFileIdRef.current;
        if (!fileId || !crepeRef.current) return;

        try {
            const content = crepeRef.current.editor.action(getMarkdown());
            await invoke("create_file", { path: fileId, contents: content });
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
        });

        crepe.editor.config((ctx => {
            ctx.get(listenerCtx).markdownUpdated(async (_ctx, markdown) => {
                scheduleAutosave(markdown);
                cbRef.current.onMarkdownChange?.(markdown);
                if (!syncEnabled) return;
                const note = await invoke<RequestNote>("get_notes");
                if (!note) {
                    const normalised = activeFileIdRef.current?.replace(/\\/g, "/");
                    const base = appDataDirPath.replace(/\\/g, "/");
                    const path = normalised?.startsWith(base) ? normalised.slice(base.length).replace(/^\//, "") : activeFileIdRef.current;

                    await invoke("create_note", { request: { text: markdown, path: path } });
                    return;
                }
                setStatus("pending");
                scheduleSync(`note-${note.id}`, { type: "note", id: String(note.id), payload: { id: note.id, text: markdown, path: note.path } });
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
        if (!activeFileId) return;

        flushAutosave().then(async () => {
            activeFileIdRef.current = activeFileId;

            const [content, highlights] = await Promise.all([
                invoke<string>("read_file", { path: activeFileId }),
                cbRef.current.onFileLoad?.(activeFileId) ?? Promise.resolve([]),
            ]);

            crepeRef.current?.editor.action(replaceAll(String(content)));

            const view = crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx));
            if (view && !view.isDestroyed) {
                view.dispatch(view.state.tr.setMeta(highlightPluginKey, highlights));
            }
        })
    }, [activeFileId, cancelAutosave, flushAutosave]);

    return <div className="h-full w-full min-h-0 nodrag overflow-x-hidden overflow-y-auto" ref={hostRef} />;
});

export default TextEditor;
