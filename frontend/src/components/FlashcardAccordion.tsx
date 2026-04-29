import { ResponseFlashcard } from "../types/ResponseFlashcard";
import { CardReview } from '../types/CardReview';
import { useEffect, useState } from 'react';

function FlashcardAccordion({ flashcards, reviewCard, setIsFlashcardOverlayOpen, flashcardsLoading, replaceStaleFlashcards, deleteFlashcard, replaceFlashcard }:
    {
        flashcards: ResponseFlashcard[];
        reviewCard: (key: String, review: CardReview) => void;
        setIsFlashcardOverlayOpen: (isOpen: boolean) => void;
        flashcardsLoading: boolean;
        replaceStaleFlashcards: () => void;
        deleteFlashcard: (flashcardId: String) => void;
        replaceFlashcard: (flashcardId: String) => void;
    }) {
    const today = new Date().toISOString().split("T")[0];
    const [flashcardCounter, setFlashcardCounter] = useState(0);
    const [isAnswerShown, setIsAnswerShown] = useState(false);
    const [hasStaleFlashcards, setHasStaleFlashcards] = useState(false);

    const [queue, setQueue] = useState<ResponseFlashcard[]>(() => flashcards.filter((f) => f.next_review <= today).sort((a, b) => a.next_review.localeCompare(b.next_review)));

    useEffect(() => {
        if (!flashcards) return;
        if (flashcards.find((flashcard) => flashcard.is_stale)) {
            setHasStaleFlashcards(true);
        }
        setQueue((prevQueue) => {
            const queueIds = new Set(prevQueue.map((f) => f.id));
            const newIds = new Set(flashcards.map((f) => f.id));
            const filteredQueue = prevQueue.filter((f) => newIds.has(f.id));
            const newCards = flashcards.filter(
                (f) => f.next_review <= today && !queueIds.has(f.id)
            );
            return [...filteredQueue, ...newCards];
        });
    }, [flashcards]);

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
                        {hasStaleFlashcards && (
                            <div aria-label="StaleWarning" className="bg-yellow-300/30 border border-yellow-300 p-1 rounded-md">
                                Your note has some stale flashcards due to content change.
                                <button aria-label="ReplaceStaleFlashcards"
                                    className="text-blue-600 underline hover:text-blue-600/50 cursor-pointer"
                                    onClick={() => { setHasStaleFlashcards(false); replaceStaleFlashcards(); }}>
                                    Press here to replace them.
                                </button>
                            </div>
                        )}
                    </div>
                    <button aria-label="CloseFlashcards"
                        className="ml-4 text-gray-400 transition hover:text-white"
                        onClick={() => setIsFlashcardOverlayOpen(false)}
                    >
                        ✕
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {!isFinished ?
                        (<div aria-label="FlashcardContent"><div aria-label="FlashcardQuestion">
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
                                        <button aria-label={label.toString()} key={q} className="rounded-md border border-gray-400 bg-gray-400 px-2 py-1 hover:bg-gray-600" onClick={() => submitReview(q as number)}>{label}</button>
                                    ))}
                                </div>
                            ) :
                                (<div className='flex justify-center w-full'>
                                    <button aria-label="RevealAnswer" onClick={() => setIsAnswerShown(true)} className='rounded-md border border-gray-400 bg-gray-400 hover:bg-gray-600 px-2 py-1'>Reveal Answer</button>
                                </div>)}</div>)
                        : (<div>{flashcardsLoading ? (
                            <div className='flex items-center gap-2'>
                                <span className="animate-spin">⏳</span>
                                <span>Flashcards are loading..</span>
                            </div>
                        ) : "Revision for this note is complete!"}</div>)}
                </div>

                {/* Footer Actions */}
                <div className="flex justify-end gap-3 border-t border-background-primary p-6 pt-4">
                    <button
                        className="rounded-lg bg-button-primary px-4 py-2 text-sm text-white transition hover:bg-button-primary/50"
                        onClick={() => replaceFlashcard(card.id)}
                    >
                        Regenerate
                    </button>
                    <button
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition hover:bg-red-700"
                        onClick={() => deleteFlashcard(card.id)}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div >
    );
}

export default FlashcardAccordion
