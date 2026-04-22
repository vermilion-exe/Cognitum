import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { ResponseFlashcard } from "../types/ResponseFlashcard";
import { CardReview } from "../types/CardReview";
import { invoke } from "@tauri-apps/api/core";
import { useActiveFile } from "../contexts/ActiveFileContext";
import { useSyncStatus } from "../contexts/SyncContext";
import { calculate } from "../utils/sm2";

const DEBOUNCE_MS = 2000;
const POLL_INTERVAL_MS = 30000;
const MIN_CHARS = 300;

export function useFlashcards({ markdownRef, markdown }: { markdownRef: RefObject<string>; markdown: string; }) {
    const [flashcards, setFlashcards] = useState<ResponseFlashcard[]>([]);
    const [flashcardsLoading, setFlashcardsLoading] = useState(false);
    const flashcardsRef = useRef(flashcards);
    const [isFlashcardOverlayOpen, setIsFlashcardOverlayOpen] = useState(false);
    const reviewQueue = useRef<Map<bigint, CardReview>>(new Map());
    const timers = useRef<Map<bigint, ReturnType<typeof setTimeout>>>(new Map());
    const textDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { activeFileId } = useActiveFile();
    const activeFileIdRef = useRef(activeFileId);
    const prevFileIdRef = useRef(activeFileId);
    const { syncEnabled, currentNote } = useSyncStatus();
    const currentNoteRef = useRef(currentNote);

    useEffect(() => {
        currentNoteRef.current = currentNote;
    }, [currentNote]);

    useEffect(() => {
        activeFileIdRef.current = activeFileId;
    }, [activeFileId]);

    useEffect(() => {
        flashcardsRef.current = flashcards;
    }, [flashcards]);

    //useEffect(() => console.log(markdownRef.current), [markdownRef.current]);

    const createFlashcards = async (noteId: bigint) => {
        console.log(noteId);
        return await invoke<ResponseFlashcard[]>("generate_flashcards", { noteId: noteId, count: 10 });
    }

    // Checks if sync is enabled, in which case it generates flashcards for the current note
    useEffect(() => {
        if (!activeFileId || !syncEnabled || !currentNote || !markdown) return;

        if (prevFileIdRef.current !== activeFileIdRef.current) setFlashcards([]);
        prevFileIdRef.current = activeFileIdRef.current;

        if (textDebounceRef.current) clearTimeout(textDebounceRef.current);

        const delay = flashcards.length === 0 && markdownRef.current.length < MIN_CHARS ? 0 : 5000;

        setFlashcardsLoading(true);
        textDebounceRef.current = setTimeout(async () => {
            if (flashcards.length === 0) {
                console.log("Loading local flashcards");
                const local_flashcards = await invoke<ResponseFlashcard[]>("load_local_flashcards", { noteId: currentNoteRef.current?.id! });

                if (local_flashcards?.length) {
                    console.log("local flashcards found:", local_flashcards);
                    setFlashcards(local_flashcards);
                    setFlashcardsLoading(false);
                    await checkForRelevance();
                    return;
                }
                if (markdownRef.current.length < MIN_CHARS) { setFlashcardsLoading(false); return; };

                console.log("Generating flashcards");
                const generated_flashcards = await createFlashcards(currentNoteRef.current?.id!);

                if (!generated_flashcards) {
                    console.error("Could not generate flashcards.");
                    setFlashcardsLoading(false);
                    return;
                }

                console.log("saving flashcards after generation");
                await invoke("save_local_flashcards", { noteId: currentNoteRef.current?.id!, flashcards: generated_flashcards });
                setFlashcards(generated_flashcards);
            }
            else {
                if (markdownRef.current.length < MIN_CHARS) { setFlashcardsLoading(false); return; }
                await checkForRelevance();
            }
            setFlashcardsLoading(false);
        }, delay);

        return () => {
            if (textDebounceRef.current) clearTimeout(textDebounceRef.current);
        }
    }, [markdown, activeFileId, currentNote, syncEnabled]);

    const checkForRelevance = async () => {
        console.log("Checking flashcards for relevance");
        const irrelevantIds = await invoke<bigint[]>("check_flashcard_relevance", { noteId: currentNote?.id! });
        if (irrelevantIds.length !== 0) {
            console.log("Irrelevant flashcards found", irrelevantIds);
            setFlashcards((prev) =>
                prev.map((f) => irrelevantIds.includes(f.id) ? { ...f, is_stale: true } : f));

            const updatedFlashcards = flashcardsRef.current.map((f) => irrelevantIds.includes(f.id) ? { ...f, is_stale: true } : f);

            await invoke("save_local_flashcards", { noteId: currentNoteRef.current?.id!, flashcards: updatedFlashcards });

            await invoke("update_stale_flashcards", { noteId: currentNote?.id!, flashcardIds: irrelevantIds });
            return;
        }
        console.log("No irrelevant flashcards found", irrelevantIds);
    }

    const replaceStaleFlashcards = async () => {
        if (!flashcards) return;

        const noteId = currentNoteRef.current?.id!;
        const currentFlashcards = flashcardsRef.current;
        let staleCount = flashcards.filter((f) => f.is_stale).length;
        staleCount = staleCount > 10 ? 10 : staleCount;
        console.log("number of stale flashcards:", staleCount);

        console.log("Deleting stale flashcards");
        await invoke("delete_stale_flashcards", { noteId: noteId });

        if (noteId === currentNoteRef.current?.id!) {
            console.log("Removing stale flashcards from state");
            setFlashcards((prev) => prev.filter((f) => !f.is_stale));
        }

        let updatedFlashcards = currentFlashcards.filter((f) => !f.is_stale);

        try {
            setFlashcardsLoading(true);
            console.log("Generating new flashcards");
            const newFlashcards = await invoke<ResponseFlashcard[]>("generate_flashcards", { noteId: noteId, count: staleCount });

            if (noteId === currentNoteRef.current?.id!) {
                console.log("Adding newly generated flashcards to state");
                setFlashcards((prev) => [...prev, ...newFlashcards]);
            }

            updatedFlashcards = [...updatedFlashcards, ...newFlashcards];

            setFlashcardsLoading(false);
        }
        catch (e) {
            console.error("Could not generate new flashcards:", e);
        }
        finally {
            console.log("Saving updated flashcards locally:", updatedFlashcards);
            await invoke("save_local_flashcards", { noteId: noteId, flashcards: updatedFlashcards });
        }
    }

    const deleteFlashcard = async (flashcardId: bigint) => {
        if (!flashcards.find((f) => f.id === flashcardId)) return;

        const noteId = currentNoteRef.current?.id!;
        const currentFlashcards = flashcardsRef.current;

        if (noteId === currentNoteRef.current?.id!) {
            setFlashcards((prev) => prev.filter((f) => f.id !== flashcardId));
        }

        let updatedFlashcards = currentFlashcards.filter((f) => f.id !== flashcardId);
        await invoke("save_local_flashcards", { noteId: noteId, flashcards: updatedFlashcards });

        await invoke("delete_flashcard", { flashcardId: flashcardId });
    }

    const replaceFlashcard = async (flashcardId: bigint) => {
        if (!flashcards.find((f) => f.id === flashcardId)) return;
        const noteId = currentNoteRef.current?.id!;
        const currentFlashcards = flashcardsRef.current;

        deleteFlashcard(flashcardId);

        const newFlashcards = await invoke<ResponseFlashcard[]>("generate_flashcards", { noteId: noteId, count: 1 });

        if (noteId === currentNoteRef.current?.id!) {
            setFlashcards((prev) => [...prev, ...newFlashcards]);
        }

        let updatedFlashcards = currentFlashcards.filter((f) => f.id !== flashcardId);
        updatedFlashcards = [...updatedFlashcards, ...newFlashcards];
        await invoke("save_local_flashcards", { noteId: noteId, flashcards: updatedFlashcards });
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

    return { flashcards, setFlashcards, reviewCard, isFlashcardOverlayOpen, setIsFlashcardOverlayOpen, flashcardsLoading, replaceStaleFlashcards, deleteFlashcard, replaceFlashcard };
}
