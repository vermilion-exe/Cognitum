import { RefObject, useEffect, useRef, useState } from "react";
import { ResponseHighlight } from "../types/ResponseHighlight";
import { useSyncStatus } from "../contexts/SyncContext";
import { useSyncManager } from "./useSyncManager";
import { invoke } from "@tauri-apps/api/core";
import { useActiveFile } from "../contexts/ActiveFileContext";
import { ResponseExplanation } from "../types/ResponseExplanation";
import { TextEditorHandle } from "../components/TextEditor";

export function useHighlights({ editorRef }: { editorRef: RefObject<TextEditorHandle | null> }) {
    const [highlights, setHighlights] = useState<ResponseHighlight[]>([]);
    const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
    const [activeHighlight, setActiveHighlight] = useState<ResponseHighlight | undefined>();
    const [isExplanationLoading, setIsExplanationLoading] = useState(false);
    const isInitialHighlightLoad = useRef(false);
    const { activeFileId } = useActiveFile();
    const { syncEnabled, currentNote, setStatus } = useSyncStatus();
    const { scheduleSync } = useSyncManager();

    // Reads the highlights from local directory and saves them in a variable
    const onFileLoad = async (fileId: String) => {
        isInitialHighlightLoad.current = true;
        try {
            const loaded = (await invoke<ResponseHighlight[] | null>("read_highlights", { fileId: fileId })) ?? [];
            setHighlights(loaded);
            setActiveHighlightId(null);
            return loaded;
        }
        catch (e) {
            console.error("Could not read highlights:", e);
        }
        finally {
            isInitialHighlightLoad.current = false;
        }
    }

    // Save highlight to database if sync is enabled
    async function backupHighlight(highlight: ResponseHighlight) {
        setStatus("pending");
        scheduleSync(`highlight-${highlight.id}`,
            {
                type: "highlight",
                id: String(highlight.id),
                payload: { id: highlight.id, from: highlight?.from, to: highlight?.to, selected_text: highlight?.selected_text, created_at: highlight?.created_at, note_id: currentNote?.id }
            });
    }

    // Save the highlights locally if they change
    useEffect(() => {
        if (activeFileId && !isInitialHighlightLoad) {
            invoke("save_highlights", { fileId: activeFileId, highlights });
            const highlight = highlights.find((x) => x.id === activeHighlightId);
            if (highlights.length === 0 || !highlight) {
                setActiveHighlightId(null);
            }
            else if (syncEnabled) {
                backupHighlight(highlight);
            }
        }
    }, [highlights]);

    // Change active highlight if the active highlight id changes
    useEffect(() => {
        setActiveHighlight(highlights.find((h) => h.id === activeHighlightId));
    }, [activeHighlightId]);

    // Call backend to explain selected text
    const handleExplanation = async (text: string, from: number, to: number) => {
        if (!currentNote) return;

        setIsExplanationLoading(true);
        const explanation: ResponseExplanation = await invoke<ResponseExplanation>("request_explanation", { text });

        const entry: ResponseHighlight = {
            id: crypto.randomUUID(),
            from,
            to,
            selected_text: text,
            explanation: explanation.choices[0].message.content,
            created_at: new Date().toISOString(),
            note_id: currentNote.id!,
        };

        setHighlights((prev) => {
            const next = [...prev, entry];
            editorRef.current?.pushHighlights(next);
            return next;
        });
        setIsExplanationLoading(false);
    }

    // Handle highlight deletion
    const handleDelete = (id: string) => {
        setHighlights((prev) => {
            const next = prev.filter((h) => h.id !== id);
            editorRef.current?.pushHighlights(next);
            setActiveHighlightId(null);
            invoke("remove_highlight", { fileId: activeFileId, highlightId: id });
            return next;
        });
    }

    // Handle highlight regeneration
    const handleRegenerate = async (id: string) => {
        const target: ResponseHighlight | undefined = highlights.find((h) => h.id === id);
        if (!target) return;

        const selectedText = target.selected_text;
        const explanation: ResponseExplanation = await invoke<ResponseExplanation>("request_explanation", { selectedText });
        setHighlights((prev) => {
            const explanationText = explanation.choices[0].message.content;
            const next = prev.map((h) => (h.id === id ? { ...h, explanation: explanationText } : h));
            editorRef.current?.pushHighlights(next);
            return next;
        });
    }

    return { highlights, activeHighlight, activeHighlightId, isExplanationLoading, handleExplanation, onFileLoad, setHighlights, setActiveHighlightId, handleRegenerate, handleDelete };
}
