import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';

function SummaryModal({ isLoading, text, onClose, onRegenerate, hasEnoughChars }: { isLoading: boolean; text: string; onClose: () => void; onRegenerate: () => void; hasEnoughChars: boolean; }) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={onClose}>
            <div
                className="relative mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-background-secondary shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-background-primary p-6 pb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Summary</h2>
                    </div>
                    <button aria-label='CloseSummary'
                        className="ml-4 text-gray-400 transition hover:text-white"
                        onClick={onClose}
                    >
                        ✕
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="prose prose-invert wrap-break-word max-w-none">
                        {hasEnoughChars ? (
                            isLoading ? (
                                <div className='flex items-center gap-2'>
                                    <span className="animate-spin">⏳</span>
                                    <span>Generating the summary..</span>
                                </div>
                            ) : (
                                <div aria-label='SummaryContent'>
                                    <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex, rehypeRaw]}>
                                        {text}
                                    </Markdown>
                                </div>
                            )
                        ) : "Nothing to summarize..."}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-end gap-3 border-t border-background-primary p-6 pt-4">
                    <button
                        className="rounded-lg bg-button-primary px-4 py-2 text-sm text-white transition hover:bg-button-primary/50"
                        onClick={onRegenerate}
                    >
                        Regenerate
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SummaryModal
