import { useCallback, useEffect, useRef } from "react";
import { Crepe } from "@milkdown/crepe";

import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import { listenerCtx } from "@milkdown/plugin-listener";
import { getMarkdown, replaceAll } from "@milkdown/kit/utils";
import "katex/dist/katex.min.css";
import { useActiveFile } from "../contexts/ActiveFileContext";
import { invoke } from "@tauri-apps/api/core";

const AUTOSAVE_DELAY_MS = 300;

export default function TextEditor({ onMarkdownChange, }: { onMarkdownChange: (markdown: string) => void; }) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const crepeRef = useRef<Crepe | null>(null);
    const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeFileIdRef = useRef<string | null>(null);

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
            ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
                scheduleAutosave(markdown);
                onMarkdownChange(markdown);
            })
        }))

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

        flushAutosave().then(() => {
            activeFileIdRef.current = activeFileId;

            invoke("read_file", { path: activeFileId })
                .then((content) => {
                    crepeRef.current?.editor.action(replaceAll(String(content)));
                })
                .catch((e) => {
                    console.error("Failed to read file: ", e);
                })
        })
    }, [activeFileId, cancelAutosave, flushAutosave]);

    return <div className="h-full w-full min-h-0 nodrag overflow-x-hidden overflow-y-auto" ref={hostRef} />;
}
