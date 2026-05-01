import { invoke } from "@tauri-apps/api/core";
import { RefObject, useEffect, useRef, useState } from "react";
import { ResponseSummary } from "../types/ResponseSummary";
import { useSyncStatus } from "../contexts/SyncContext";
import { useSyncManager } from "./useSyncManager";
import { renderMarkdownWithLatex } from "../utils/markdownUtils";
import { RequestSummary } from "../types/RequestSummary";
import { useActiveFile } from "../contexts/ActiveFileContext";
import { updateNoteTimestamp } from "../utils/fsUtils";

const MIN_CHARS = 300;

export function useSummary({ markdownRef, markdown }: { markdownRef: RefObject<string>; markdown: string; }) {
    const [isSummaryOpen, setIsSummaryOpen] = useState(false);
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    const isLocalLoad = useRef(false);
    const [hasEnoughChars, setHasEnoughChars] = useState(false);
    const [displayedText, setDisplayedText] = useState("");
    const { activeFileId } = useActiveFile();
    const [fullText, setFullText] = useState("");
    const { syncEnabled, currentNote } = useSyncStatus();
    const { scheduleSync } = useSyncManager();

    // Save summary function that is called if sync is enabled
    async function saveSummary() {
        if (!currentNote) return;
        const noteId = currentNote?.id;
        try {
            const summary = await invoke<ResponseSummary | null>("get_summary_by_note_id", { noteId: noteId });

            const id = summary ? summary.id : null;
            scheduleSync(`summary-${id}`,
                { type: "summary", operation: "create", id: String(id), payload: { id: id, summary: fullText, note_id: noteId } });
        }
        catch (e) {
            const uuid = crypto.randomUUID();
            scheduleSync(`summary-${uuid}`,
                { type: "summary", operation: "create", id: String(uuid), payload: { id: null, summary: fullText, note_id: noteId } });
        }
    }

    // If the file changes, tries to load the local summary
    useEffect(() => {
        const getLocalSummary = async () => {
            if (!activeFileId) return;
            isLocalLoad.current = true;
            try {
                const summary = await invoke<string>("get_local_summary", { fileId: activeFileId });
                setFullText(summary);
                setDisplayedText(summary);
                if (!summary || summary === null || summary.length === 0) isLocalLoad.current = false;
            }
            catch (e) {
                setFullText("");
                setDisplayedText("");
                isLocalLoad.current = false;
            }
        }

        getLocalSummary();
    }, [activeFileId]);

    useEffect(() => {
        setHasEnoughChars(markdownRef.current.length >= MIN_CHARS);
    }, [markdown]);

    // Saves the summary if the summary text changes
    useEffect(() => {
        if (isLocalLoad.current) {
            isLocalLoad.current = false;
            return;
        }

        if (!syncEnabled || !fullText) return;

        saveSummary();
    }, [fullText, syncEnabled]);

    // If the summary accordion is opened, the summary request is made
    useEffect(() => {
        if (!isSummaryOpen || isLocalLoad.current || (fullText !== null && fullText !== "") || !hasEnoughChars) return;

        const handleGetSummary = async () => {
            await handleSummarize();
        }

        handleGetSummary();
    }, [isSummaryOpen, hasEnoughChars]);

    // Use a timer to slowly change displayed text
    useEffect(() => {
        if (!fullText || fullText === null || displayedText.length >= fullText.length) return;

        const timeout = setTimeout(() => {
            setDisplayedText(fullText.slice(0, displayedText.length + 1));
        }, 15);

        return () => clearTimeout(timeout);
    }, [fullText, displayedText]);

    const renderedHtml = renderMarkdownWithLatex(displayedText);

    // Call backend to summarize the note
    const handleSummarize = async () => {
        if (!hasEnoughChars) return;

        setIsSummaryLoading(true);
        setDisplayedText("");
        setFullText("");

        const payload: RequestSummary = { markdown: markdownRef.current, max_new_tokens: 1024, recursive: true };
        await invoke<ResponseSummary>("request_summary", { request: payload })
            .then(async (result) => {
                setFullText(result.summary);
                await invoke("save_summary", { summary: result.summary, fileId: activeFileId });
                await updateNoteTimestamp(activeFileId);
            })
            .catch((e) => {
                console.error("Command failed: ", e);
            })
            .finally(() => {
                setIsSummaryLoading(false);
            })
    }

    return { handleSummarize, isSummaryLoading, renderedHtml, isSummaryOpen, setIsSummaryOpen, setIsSummaryLoading, setDisplayedText, setFullText, hasEnoughChars };
}
