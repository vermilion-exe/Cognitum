import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { ResponseHighlight } from "../types/ResponseHighlight";

function ExplanationModal({ activeHighlight, setActiveHighlightId, onRegenerate, onDelete }:
    { activeHighlight: ResponseHighlight; setActiveHighlightId: (id: string | null) => void; onRegenerate: (id: string) => Promise<void>; onDelete: (id: string) => void }) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setActiveHighlightId(null)}
        >
            <div
                className="relative mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-background-secondary shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-background-primary p-6 pb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Explanation</h2>
                        <p className="mt-1 text-sm italic text-gray-400">
                            "{activeHighlight.selected_text}"
                        </p>
                    </div>
                    <button aria-label='CloseExplanation'
                        className="ml-4 text-gray-400 transition hover:text-white"
                        onClick={() => setActiveHighlightId(null)}
                    >
                        ✕
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="prose prose-invert wrap-break-word max-w-none">
                        <div aria-label='ExplanationContent'>
                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex, rehypeRaw]}>
                                {activeHighlight.explanation}
                            </Markdown>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-end gap-3 border-t border-background-primary p-6 pt-4">
                    <button
                        className="rounded-lg bg-button-secondary px-4 py-2 text-sm text-white transition hover:bg-button-secondary/50"
                        onClick={() => setActiveHighlightId(null)}
                    >
                        Close
                    </button>
                    <button
                        className="rounded-lg bg-button-primary px-4 py-2 text-sm text-white transition hover:bg-button-primary/50"
                        onClick={() => onRegenerate(activeHighlight.id)}
                    >
                        Regenerate
                    </button>
                    <button
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition hover:bg-red-700"
                        onClick={() => onDelete(activeHighlight.id)}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ExplanationModal
