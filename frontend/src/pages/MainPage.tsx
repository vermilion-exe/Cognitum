import { useRef, useState } from "react";
import { EditorOptionScreen, ExplanationModal, FileView, SummaryModal, FlashardModal, TextEditor } from "../components";
import { TextEditorHandle } from "../components/TextEditor";
import { useHighlights } from "../hooks/useHighlights";
import { useSummary } from "../hooks/useSummary";
import { useFlashcards } from "../hooks/useFlashcards";
import { useActiveFile } from "../contexts/ActiveFileContext";
import { findNode } from "../utils/fsUtils";
import { useFileTree } from "../contexts/FileTreeContext";

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
    const { root } = useFileTree();
    const activeFile = findNode(root, activeFileId!);

    return (
        <div className="flex flex-1 h-full overflow-hidden">
            <div className="grow bg-background-primary min-h-0 overflow-hidden flex flex-col">
                <div className="flex justify-end w-full sticky z-10 shrink-0">
                    <button aria-label="ReviseButton" className="rounded-md border border-button-secondary bg-button-secondary text-white text-xl px-8 mt-3 mr-2 hover:bg-button-secondary/50"
                        onClick={() => { if (activeFile?.extension === "md") setIsFlashcardOverlayOpen(true) }} disabled={!flashcards}>Revise</button>
                    <button aria-label="SummarizeButton" className="rounded-md border border-button-secondary bg-button-secondary text-white text-xl px-8 mt-3 mr-2 hover:bg-button-secondary/50"
                        onClick={() => { if (activeFile?.extension === "md") setIsSummaryOpen(true) }} disabled={isSummaryLoading}>{isSummaryLoading ? "Summarizing..." : "Summarize"}</button>
                </div>
                {activeFileId ? (activeFile?.extension === "md" ? (
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
                ) : <FileView />) : (
                    <EditorOptionScreen />
                )}
            </div>

            {isSummaryOpen && (
                <SummaryModal isLoading={isSummaryLoading} text={renderedHtml} onClose={() => {
                    setIsSummaryOpen(false);
                }} onRegenerate={handleSummarize} hasEnoughChars={hasEnoughChars} />
            )}
            {activeHighlight && activeHighlightId &&
                (<ExplanationModal
                    activeHighlight={activeHighlight}
                    setActiveHighlightId={setActiveHighlightId}
                    onRegenerate={handleRegenerate}
                    onDelete={handleDelete} />)}
            {flashcards && isFlashcardOverlayOpen &&
                (<FlashardModal flashcards={flashcards}
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
