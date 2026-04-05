import { useEffect, useRef, useState } from "react";
import { ExplanationAccordion, SummaryAccordion, TextEditor } from "../components";
import { invoke } from "@tauri-apps/api/core";
import { RequestSummary } from "../types/RequestSummary";
import { ResponseSummary } from "../types/ResponseSummary";
import { renderMarkdownWithLatex } from "../utils/markdownUtils";
import { ResponseExplanation } from "../types/ResponseExplanation";
import { ResponseHighlight } from "../types/ResponseHighlight";
import { useActiveFile } from "../contexts/ActiveFileContext";
import { TextEditorHandle } from "../components/TextEditor";

function MainPage() {
    const [highlights, setHighlights] = useState<ResponseHighlight[]>([]);
    const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
    const [activeHighlight, setActiveHighlight] = useState<ResponseHighlight | undefined>();
    const [isSummaryOpen, setIsSummaryOpen] = useState(false);
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    const [isExplanationLoading, setIsExplanationLoading] = useState(false);
    const [displayedText, setDisplayedText] = useState("");
    const [fullText, setFullText] = useState("");
    const editorRef = useRef<TextEditorHandle>(null);
    const markdownRef = useRef("");
    const { activeFileId } = useActiveFile();

    useEffect(() => {
        if (!activeFileId) return;

        invoke<ResponseHighlight[] | null>("read_highlights", { fileId: activeFileId })
            .then((h) => {
                const loaded = h ?? [];
                setHighlights(loaded);
                editorRef.current?.pushHighlights(loaded);
            })
    }, [activeFileId]);

    const onFileLoad = async (fileId: String) => {
        const loaded = (await invoke<ResponseHighlight[] | null>("read_highlights", { fileId })) ?? [];
        setHighlights(loaded);
        setActiveHighlightId(null);
        return loaded;
    }

    useEffect(() => {
        if (activeFileId) {
            invoke("save_highlights", { fileId: activeFileId, highlights });
            if (highlights.length === 0 || !highlights.find((x) => x.id === activeHighlightId)) {
                setActiveHighlightId(null);
            }
        }
    }, [highlights]);

    useEffect(() => {
        setActiveHighlight(highlights.find((h) => h.id === activeHighlightId));
    }, [activeHighlightId]);

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

    const handleExplanation = async (text: string, from: number, to: number) => {
        setIsExplanationLoading(true);
        const explanation: ResponseExplanation = await invoke<ResponseExplanation>("request_explanation", { text });

        const entry: ResponseHighlight = {
            id: crypto.randomUUID(),
            from,
            to,
            selected_text: text,
            explanation: explanation.choices[0].message.content,
            created_at: new Date().toISOString(),
        };

        setHighlights((prev) => {
            const next = [...prev, entry];
            editorRef.current?.pushHighlights(next);
            return next;
        });
        setIsExplanationLoading(false);
    }

    const handleDelete = (id: string) => {
        setHighlights((prev) => {
            const next = prev.filter((h) => h.id !== id);
            editorRef.current?.pushHighlights(next);
            setActiveHighlightId(null);
            invoke("remove_highlight", { fileId: activeFileId, highlightId: id });
            return next;
        });
    }

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
                <TextEditor
                    onMarkdownChange={(md) => { markdownRef.current = md }}
                    ref={editorRef}
                    initialHighlights={highlights}
                    isExplanationLoading={isExplanationLoading}
                    onExplainText={handleExplanation}
                    onFileLoad={onFileLoad}
                    onHighlightsChange={setHighlights}
                    onHighlightClick={setActiveHighlightId} />
            </div>

            {activeHighlight && activeHighlightId && 
                (<ExplanationAccordion 
                    activeHighlight={activeHighlight} 
                    setActiveHighlightId={setActiveHighlightId} 
                    onRegenerate={handleRegenerate} 
                    onDelete={handleDelete} />)}
        </div>
    );
}

export default MainPage
