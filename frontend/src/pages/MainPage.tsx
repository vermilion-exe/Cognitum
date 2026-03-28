import { useEffect, useRef, useState } from "react";
import { SummaryAccordion, TextEditor } from "../components";
import { invoke } from "@tauri-apps/api/core";
import { RequestSummary } from "../types/RequestSummary";
import { ResponseSummary } from "../types/ResponseSummary";
import { renderMarkdownWithLatex } from "../utils/markdownUtils";

function MainPage() {
    const [isSummaryOpen, setIsSummaryOpen] = useState(false);
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    const [displayedText, setDisplayedText] = useState("");
    const [fullText, setFullText] = useState("");
    const markdownRef = useRef("");

    useEffect(() => {
        if (!fullText || displayedText.length >= fullText.length) return;

        const timeout = setTimeout(() => {
            setDisplayedText(fullText.slice(0, displayedText.length + 1));
        }, 15);

        return () => clearTimeout(timeout);
    }, [fullText, displayedText]);

    const renderedHtml = renderMarkdownWithLatex(displayedText);

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

    const handleExit = async () => {
        await invoke("clear_user");
    }

    return (
        <div className="flex flex-1 h-full overflow-hidden">
            <div className="grow bg-background-primary min-h-0 overflow-hidden relative">
                <div className="flex justify-end w-full">
                    <button className="rounded-md border border-button-primary bg-button-secondary text-white text-xl px-8 mt-3 mr-2"
                        onClick={handleSummarize} disabled={isSummaryLoading}>{isSummaryLoading ? "Summarizing..." : "Summarize"}</button>
                </div>
                {
                    isSummaryOpen && (
                        <SummaryAccordion isLoading={isSummaryLoading} text={renderedHtml} onClose={() => {
                            setIsSummaryOpen(false);
                            setIsSummaryLoading(false);
                            setDisplayedText("");
                            setFullText("");
                        }} />
                    )
                }
                <TextEditor onMarkdownChange={(md) => { markdownRef.current = md }} />
            </div>
        </div>
    );
}

export default MainPage
