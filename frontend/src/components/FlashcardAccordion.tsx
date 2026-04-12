import { ResponseFlashcard } from "../types/ResponseFlashcard";
import { CardReview } from '../types/CardReview';
import { useState } from 'react';

function FlashcardAccordion({ flashcards, reviewCard, setIsFlashcardOverlayOpen }: { flashcards: ResponseFlashcard[]; reviewCard: (key: bigint, review: CardReview) => void; setIsFlashcardOverlayOpen: (isOpen: boolean) => void; }) {
    const today = new Date().toISOString().split("T")[0];
    const [flashcardCounter, setFlashcardCounter] = useState(0);
    const [isAnswerShown, setIsAnswerShown] = useState(false);

    const [queue, setQueue] = useState<ResponseFlashcard[]>(() => flashcards.filter((f) => f.next_review <= today));

    const card = queue[flashcardCounter];

    const isFinished = flashcardCounter >= queue.length;

    const submitReview = (quality: number) => {
        reviewCard(card.id, { flashcard: card, quality: quality });
        setFlashcardCounter((prev) => prev + 1);
        setIsAnswerShown(false);
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setIsFlashcardOverlayOpen(false)}
        >
            <div
                className="relative mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-background-secondary shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-background-primary p-6 pb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Flashcard Revision</h2>
                    </div>
                    <button
                        className="ml-4 text-gray-400 transition hover:text-white"
                        onClick={() => setIsFlashcardOverlayOpen(false)}
                    >
                        ✕
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {!isFinished ?
                        (<><div>
                            {card.question}
                        </div>
                            {isAnswerShown && (
                                <div>
                                    {card.answer}
                                </div>
                            )}
                            <br />
                            {isAnswerShown ? (
                                <div className="w-full flex justify-evenly">
                                    {[
                                        [1, "Very Hard"],
                                        [2, "Hard"],
                                        [3, "Normal"],
                                        [4, "Easy"],
                                        [5, "Very Easy"],
                                    ].map(([q, label]) => (
                                        <button key={q} className="rounded-md border border-gray-400 bg-gray-400 px-2 py-1 hover:bg-gray-600" onClick={() => submitReview(q as number)}>{label}</button>
                                    ))}
                                </div>
                            ) :
                                (<div className='flex justify-center w-full'>
                                    <button onClick={() => setIsAnswerShown(true)} className='rounded-md border border-gray-400 bg-gray-400 hover:bg-gray-600 px-2 py-1'>Reveal Answer</button>
                                </div>)}</>)
                        : (<div>Revision for this note is complete!</div>)}
                </div>

                {/* Footer Actions */}
                <div className="flex justify-end gap-3 border-t border-background-primary p-6 pt-4">
                    <button
                        className="rounded-lg bg-button-primary px-4 py-2 text-sm text-white transition hover:bg-button-primary/50"
                    //onClick={() => onRegenerate(activeHighlight.id)}
                    >
                        Regenerate
                    </button>
                    <button
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition hover:bg-red-700"
                    //onClick={() => onDelete(activeHighlight.id)}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div >
    );
}

export default FlashcardAccordion
