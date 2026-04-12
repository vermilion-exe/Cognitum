import { invoke } from "@tauri-apps/api/core";
import { RefObject, useEffect, useState } from "react";
import { ResponseSummary } from "../types/SyncTypes";
import { useSyncStatus } from "../contexts/SyncContext";
import { useSyncManager } from "./useSyncManager";
import { renderMarkdownWithLatex } from "../utils/markdownUtils";
import { RequestSummary } from "../types/RequestSummary";

export function useSummary({ markdownRef }: { markdownRef: RefObject<string> }) {
    const [isSummaryOpen, setIsSummaryOpen] = useState(false);
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    const [displayedText, setDisplayedText] = useState("");
    const [fullText, setFullText] = useState("");
    const { syncEnabled, currentNote, setStatus } = useSyncStatus();
    const { scheduleSync } = useSyncManager();

    // Save summary function that is called if sync is enabled
    async function saveSummary() {
        const summary = await invoke<ResponseSummary | null>("get_summary_by_note_id", { noteId: currentNote?.id });

        const id = summary ? summary.id : null;

        setStatus("pending");
        scheduleSync(`summary-${id}`,
            { type: "summary", id: String(id), payload: { id: id, text: fullText, path: currentNote?.id } });
    }

    // Saves the summary if the summary text changes
    useEffect(() => {
        if (!fullText || !syncEnabled) return;
        saveSummary();
    }, [fullText])

    // Use a timer to slowly change displayed text
    useEffect(() => {
        if (!fullText || displayedText.length >= fullText.length) return;

        const timeout = setTimeout(() => {
            setDisplayedText(fullText.slice(0, displayedText.length + 1));
        }, 15);

        return () => clearTimeout(timeout);
    }, [fullText, displayedText]);

    const renderedHtml = renderMarkdownWithLatex(displayedText);

    // Call backend to summarize the note
    const handleSummarize = async () => {
        setIsSummaryOpen(true);
        setIsSummaryLoading(true);
        setDisplayedText("");
        setFullText("");

        const payload: RequestSummary = { markdown: markdownRef.current, max_new_tokens: 1024, recursive: true };
        await invoke<ResponseSummary>("request_summary", { request: payload })
            .then((result) => {
                setFullText(result.summary);
            })
            .catch((e) => {
                console.error("Command failed: ", e);
            })
            .finally(() => {
                setIsSummaryLoading(false);
            })
    }

    return { handleSummarize, isSummaryLoading, renderedHtml, isSummaryOpen, setIsSummaryOpen, setIsSummaryLoading, setDisplayedText, setFullText };
}
