import { useRef, useState } from "react";
import { EditorOptionScreen, ExplanationAccordion, SummaryAccordion, TextEditor } from "../components";
import { TextEditorHandle } from "../components/TextEditor";
import { useHighlights } from "../hooks/useHighlights";
import { useSummary } from "../hooks/useSummary";
import { useFlashcards } from "../hooks/useFlashcards";
import FlashcardAccordion from "../components/FlashcardAccordion";
import { useActiveFile } from "../contexts/ActiveFileContext";

function MainPage() {
    const editorRef = useRef<TextEditorHandle>(null);
    const { highlights,
        activeHighlight,
        activeHighlightId,
        isExplanationLoading,
        handleExplanation,
        onFileLoad,
        setHighlights,
        setActiveHighlightId,
        handleRegenerate,
        handleDelete } = useHighlights({ editorRef: editorRef });

    const [markdown, setMarkdown] = useState("");
    const markdownRef = useRef("");
    const { handleSummarize,
        isSummaryLoading,
        renderedHtml,
        isSummaryOpen,
        setIsSummaryOpen,
        hasEnoughChars } = useSummary({ markdownRef: markdownRef, markdown: markdown });

    const { flashcards, reviewCard, isFlashcardOverlayOpen, setIsFlashcardOverlayOpen, flashcardsLoading, replaceStaleFlashcards, deleteFlashcard, replaceFlashcard } = useFlashcards({ markdownRef: markdownRef, markdown: markdown });
    const { activeFileId } = useActiveFile();

    return (
        <div className="flex flex-1 h-full overflow-hidden">
            <div className="grow bg-background-primary min-h-0 overflow-hidden flex flex-col">
                <div className="flex justify-end w-full sticky z-10 shrink-0">
                    <button className="rounded-md border border-button-secondary bg-button-secondary text-white text-xl px-8 mt-3 mr-2 hover:bg-button-secondary/50"
                        onClick={() => setIsFlashcardOverlayOpen(true)} disabled={!flashcards}>Revise</button>
                    <button className="rounded-md border border-button-secondary bg-button-secondary text-white text-xl px-8 mt-3 mr-2 hover:bg-button-secondary/50"
                        onClick={() => setIsSummaryOpen(true)} disabled={isSummaryLoading}>{isSummaryLoading ? "Summarizing..." : "Summarize"}</button>
                </div>
                {activeFileId ? (
                    <TextEditor
                        onMarkdownChange={(md) => { markdownRef.current = md; setMarkdown(md); }}
                        ref={editorRef}
                        initialHighlights={highlights}
                        isExplanationLoading={isExplanationLoading}
                        onExplainText={handleExplanation}
                        onFileLoad={onFileLoad}
                        onHighlightsChange={setHighlights}
                        onHighlightClick={setActiveHighlightId}
                    />
                ) : (
                    <EditorOptionScreen />
                )}
            </div>

            {isSummaryOpen && (
                <SummaryAccordion isLoading={isSummaryLoading} text={renderedHtml} onClose={() => {
                    setIsSummaryOpen(false);
                }} onRegenerate={handleSummarize} hasEnoughChars={hasEnoughChars} />
            )}
            {activeHighlight && activeHighlightId &&
                (<ExplanationAccordion
                    activeHighlight={activeHighlight}
                    setActiveHighlightId={setActiveHighlightId}
                    onRegenerate={handleRegenerate}
                    onDelete={handleDelete} />)}
            {flashcards && isFlashcardOverlayOpen &&
                (<FlashcardAccordion flashcards={flashcards}
                    reviewCard={reviewCard}
                    setIsFlashcardOverlayOpen={setIsFlashcardOverlayOpen}
                    flashcardsLoading={flashcardsLoading}
                    replaceStaleFlashcards={replaceStaleFlashcards}
                    deleteFlashcard={deleteFlashcard}
                    replaceFlashcard={replaceFlashcard} />)}
        </div>
    );
}

export default MainPage
