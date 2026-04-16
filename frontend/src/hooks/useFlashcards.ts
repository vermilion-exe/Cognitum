import { useCallback, useEffect, useRef, useState } from "react";
import { ResponseFlashcard } from "../types/ResponseFlashcard";
import { CardReview } from "../types/CardReview";
import { invoke } from "@tauri-apps/api/core";
import { useActiveFile } from "../contexts/ActiveFileContext";
import { useSyncStatus } from "../contexts/SyncContext";
import { calculate } from "../utils/sm2";

const DEBOUNCE_MS = 2000;
const POLL_INTERVAL_MS = 30000;
const MIN_CHARS = 300;

export function useFlashcards() {
    const [flashcards, setFlashcards] = useState<ResponseFlashcard[]>([]);
    const flashcardsRef = useRef(flashcards);
    const [isFlashcardOverlayOpen, setIsFlashcardOverlayOpen] = useState(false);
    const reviewQueue = useRef<Map<bigint, CardReview>>(new Map());
    const timers = useRef<Map<bigint, ReturnType<typeof setTimeout>>>(new Map());
    const textDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { activeFileId } = useActiveFile();
    const { syncEnabled, currentNote } = useSyncStatus();
    const currentNoteRef = useRef(currentNote);

    useEffect(() => {
        currentNoteRef.current = currentNote;
    }, [currentNote]);

    useEffect(() => {
        flashcardsRef.current = flashcards;
    }, [flashcards]);

    const createFlashcards = async (noteId: bigint) => {
        return await invoke<ResponseFlashcard[]>("generate_flashcards", { noteId: noteId, count: 10 });
    }

    // Checks if sync is enabled, in which case it generates flashcards for the current note
    useEffect(() => {
        if (!activeFileId || !syncEnabled || !currentNote) return;

        if (textDebounceRef.current) clearTimeout(textDebounceRef.current);

        const delay = flashcards.length === 0 && currentNote.text.length < MIN_CHARS ? 0 : 5000;

        textDebounceRef.current = setTimeout(async () => {
            if (flashcards.length === 0) {
                const local_flashcards = await invoke<ResponseFlashcard[]>("load_local_flashcards", { noteId: currentNote.id! });

                if (local_flashcards?.length) { setFlashcards(local_flashcards); return; }
                if (currentNote.text.length < MIN_CHARS) return;

                const generated_flashcards = await createFlashcards(currentNote.id!);

                if (!generated_flashcards) {
                    console.error("Could not generate flashcards.");
                    return;
                }

                await invoke("save_local_flashcards", { noteId: currentNote.id!, flashcards: generated_flashcards });
                setFlashcards(generated_flashcards);
            }
            else {
                if (currentNote.text.length < MIN_CHARS) return;
                await checkForRelevance();
            }
        }, delay);

        return () => {
            if (textDebounceRef.current) clearTimeout(textDebounceRef.current);
        }
    }, [currentNote?.text, activeFileId, syncEnabled]);

    const checkForRelevance = async () => {
        const irrelevantIds = await invoke<bigint[]>("check_flashcard_relevance", { noteId: currentNote?.id! });

        setFlashcards((prev) =>
            prev.map((f) => irrelevantIds.includes(f.id) ? { ...f, is_stale: true } : f));

        await invoke("update_stale_flashcards", { noteId: currentNote?.id!, flashcardIds: irrelevantIds });
    }

    const flushPersistedQueue = useCallback(async () => {
        const saved = await invoke<Record<string, CardReview>>("load_review_queue");

        if (!saved || Object.keys(saved).length === 0) return;

        const failed: Record<string, CardReview> = {};

        for (const [key, review] of Object.entries(saved)) {
            try {
                await invoke("submit_review", {
                    flashcardId: review.flashcard.id,
                    quality: review.quality,
                });
            }
            catch {
                failed[key] = review;
            }
        }

        await invoke("save_review_queue", { queue: failed });
    }, []);

    useEffect(() => {
        if (!syncEnabled) return;

        const interval = setInterval(flushPersistedQueue, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [syncEnabled, flushPersistedQueue]);

    const reviewCard = useCallback((key: bigint, review: CardReview) => {
        reviewQueue.current.set(key, review);

        invoke("save_review_queue", { queue: Object.fromEntries(Array.from(reviewQueue.current.entries()).map(([k, v]) => [k.toString(), v])) });

        if (timers.current.has(key)) {
            clearTimeout(timers.current.get(key)!);
        }

        timers.current.set(key,
            setTimeout(async () => {
                const review = reviewQueue.current.get(key);
                if (!review) return;

                try {
                    const reviewedFlashcard = calculate(review.flashcard, review.quality);

                    await invoke("submit_review", { review: reviewedFlashcard });
                    reviewQueue.current.delete(key);

                    setFlashcards((prev) =>
                        prev.map((f) =>
                            f.id === reviewedFlashcard.id ? reviewedFlashcard : f)
                    );

                    const updatedFlashcards = flashcardsRef.current.map((f) =>
                        f.id === reviewedFlashcard.id ? reviewedFlashcard : f);
                    await invoke("save_local_flashcards", { noteId: currentNoteRef.current?.id!, flashcards: updatedFlashcards });

                    await invoke("save_review_queue", { queue: Object.fromEntries(Array.from(reviewQueue.current.entries()).map(([k, v]) => [k.toString(), v])) });
                }
                catch (e) {
                    console.log("Could not submit review for card:", e);
                }
            }, DEBOUNCE_MS));
    }, [])

    return { flashcards, setFlashcards, reviewCard, isFlashcardOverlayOpen, setIsFlashcardOverlayOpen };
}
