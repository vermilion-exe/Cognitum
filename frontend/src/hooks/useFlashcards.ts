import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { ResponseFlashcard } from "../types/ResponseFlashcard";
import { CardReview } from "../types/CardReview";
import { invoke } from "@tauri-apps/api/core";
import { useActiveFile } from "../contexts/ActiveFileContext";
import { useSyncStatus } from "../contexts/SyncContext";
import { calculate } from "../utils/sm2";
import { useSyncManager } from "./useSyncManager";
import { useToast } from "./useToast";
import { updateNoteTimestamp } from "../utils/fsUtils";

const DEBOUNCE_MS = 2000;
const POLL_INTERVAL_MS = 30000;
const MIN_CHARS = 300;

export function useFlashcards({ markdownRef, markdown }: { markdownRef: RefObject<string>; markdown: string; }) {
    const [flashcards, setFlashcards] = useState<ResponseFlashcard[]>([]);
    const [flashcardsLoading, setFlashcardsLoading] = useState(false);
    const flashcardsRef = useRef(flashcards);
    const [isFlashcardOverlayOpen, setIsFlashcardOverlayOpen] = useState(false);
    const reviewQueue = useRef<Map<String, CardReview>>(new Map());
    const timers = useRef<Map<String, ReturnType<typeof setTimeout>>>(new Map());
    const textDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flashcardLoadRunRef = useRef(0);
    const { activeFileId } = useActiveFile();
    const activeFileIdRef = useRef(activeFileId);
    const prevFileIdRef = useRef(activeFileId);
    const { status, syncEnabled, currentNote } = useSyncStatus();
    const { scheduleSync } = useSyncManager();
    const currentNoteRef = useRef(currentNote);
    const toast = useToast();

    useEffect(() => {
        currentNoteRef.current = currentNote;
    }, [currentNote]);

    useEffect(() => {
        activeFileIdRef.current = activeFileId;
    }, [activeFileId]);

    useEffect(() => {
        flashcardsRef.current = flashcards;
    }, [flashcards]);


    // Generate flashcards for the given markdown and count
    const createFlashcards = async () => {
        try {
            return await invoke<ResponseFlashcard[]>("generate_flashcards", { markdown: markdownRef.current!, count: 10 });
        }
        catch (e) {
            toast.error("Could not generate flashcards");
            return [];
        }
    }

    // Handle flashcard loading
    useEffect(() => {
        // If no file is open, return
        if (!activeFileId || !markdown) {
            flashcardLoadRunRef.current++;
            setFlashcardsLoading(false);
            return;
        }

        const fileId = activeFileId;
        const isNewFile = prevFileIdRef.current !== fileId;

        // If file change occured, set current flashcards to empty array
        if (isNewFile) setFlashcards([]);
        else if (flashcardsLoading) return;
        prevFileIdRef.current = fileId;

        if (textDebounceRef.current) clearTimeout(textDebounceRef.current);

        const currentFlashcards = isNewFile ? [] : flashcards;
        const delay = isNewFile || currentFlashcards.length === 0 ? 0 : 25000;
        const runId = ++flashcardLoadRunRef.current;

        textDebounceRef.current = setTimeout(async () => {
            setFlashcardsLoading(true);

            try {
                if (runId !== flashcardLoadRunRef.current || activeFileIdRef.current !== fileId) return;

                if (currentFlashcards.length === 0) {
                    // If no flashcards loaded, try loading local ones
                    console.log("Loading local flashcards");
                    const local_flashcards = await invoke<ResponseFlashcard[]>("load_local_flashcards", { fileId: fileId });

                    if (runId !== flashcardLoadRunRef.current || activeFileIdRef.current !== fileId) return;

                    // If local flashcards exist, load and return
                    if (local_flashcards?.length) {
                        console.log("local flashcards found:", local_flashcards);
                        setFlashcards(local_flashcards);
                        flashcardsRef.current = local_flashcards;
                        await checkForRelevance(local_flashcards);
                        return;
                    }

                    // If a note does not have enough content, return
                    if (markdownRef.current.length < MIN_CHARS) return;

                    // If there is content, generate flashcards for the note
                    console.log("Generating flashcards");
                    let generated_flashcards = await createFlashcards();

                    if (runId !== flashcardLoadRunRef.current || activeFileIdRef.current !== fileId) return;

                    if (!generated_flashcards || generated_flashcards.length === 0) {
                        console.error("Could not generate flashcards.");
                        return;
                    }

                    // Upload the created flashcards to DB if sync is enabled
                    if (syncEnabled && status !== "syncing") {
                        console.log("Syncing flashcards");
                        const id = crypto.randomUUID();
                        scheduleSync(`flashcard-${id}`,
                            { type: "flashcard", operation: "create", id: String(id), payload: [...generated_flashcards.map((f) => ({ ...f, note_id: currentNoteRef.current?.id! }))] });
                        generated_flashcards = generated_flashcards.map((f) => ({ ...f, note_id: currentNoteRef.current?.id! }));
                    }

                    console.log("saving flashcards after generation");

                    await invoke("save_local_flashcards", { fileId: fileId, flashcards: generated_flashcards });
                    await updateNoteTimestamp(fileId);

                    if (runId !== flashcardLoadRunRef.current || activeFileIdRef.current !== fileId) return;
                    setFlashcards(generated_flashcards);
                }
                else {
                    // If there are already flashcards, check their relevance
                    if (markdownRef.current.length < MIN_CHARS) return;
                    await checkForRelevance(currentFlashcards);
                }
            }
            finally {
                if (runId === flashcardLoadRunRef.current) {
                    setFlashcardsLoading(false);
                }
            }
        }, delay);

        return () => {
            if (textDebounceRef.current) clearTimeout(textDebounceRef.current);
        }
    }, [markdown, activeFileId]);

    // Check flashcards for relevance and update stale flashcards
    const checkForRelevance = async (cards = flashcardsRef.current) => {
        console.log("Checking flashcards for relevance");
        const irrelevantIds = await invoke<String[]>("check_flashcard_relevance", { markdown: markdownRef?.current!, flashcards: cards });
        if (irrelevantIds.length !== 0) {
            console.log("Irrelevant flashcards found", irrelevantIds);
            setFlashcards((prev) =>
                prev.map((f) => irrelevantIds.includes(f.id) ? { ...f, is_stale: true } : f));

            const updatedFlashcards = cards.map((f) => irrelevantIds.includes(f.id) ? { ...f, is_stale: true } : f);
            flashcardsRef.current = updatedFlashcards;

            await invoke("save_local_flashcards", { fileId: activeFileIdRef.current!, flashcards: updatedFlashcards });
            await updateNoteTimestamp(activeFileIdRef.current);

            if (syncEnabled)
                await invoke("update_stale_flashcards", { noteId: currentNote?.id!, flashcardIds: irrelevantIds });
            return;
        }
        console.log("No irrelevant flashcards found", irrelevantIds);
    }

    // Replace stale flashcards with new ones
    const replaceStaleFlashcards = async () => {
        if (!flashcards) return;

        const fileId = activeFileIdRef?.current!;
        const markdown = markdownRef?.current!;
        const noteId = currentNoteRef?.current?.id;
        const currentFlashcards = flashcardsRef.current;
        let staleCount = flashcards.filter((f) => f.is_stale).length;
        staleCount = staleCount > 10 ? 10 : staleCount;
        console.log("number of stale flashcards:", staleCount);

        console.log("Deleting stale flashcards");
        if (syncEnabled)
            await invoke("delete_stale_flashcards", { noteId: noteId });

        if (fileId === activeFileIdRef?.current!) {
            console.log("Removing stale flashcards from state");
            setFlashcards((prev) => prev.filter((f) => !f.is_stale));
        }

        let updatedFlashcards = currentFlashcards.filter((f) => !f.is_stale);

        try {
            setFlashcardsLoading(true);
            console.log("Generating new flashcards");
            const newFlashcards = await invoke<ResponseFlashcard[]>("generate_flashcards", { markdown: markdown, count: staleCount });

            if (fileId === activeFileIdRef?.current!) {
                console.log("Adding newly generated flashcards to state");
                setFlashcards((prev) => [...prev, ...newFlashcards]);
            }

            updatedFlashcards = [...updatedFlashcards, ...newFlashcards];

            if (syncEnabled) {
                const id = crypto.randomUUID();
                scheduleSync(`flashcard-${id}`,
                    { type: "flashcard", operation: "create", id: String(id), payload: [...updatedFlashcards.map((f) => ({ ...f, note_id: currentNoteRef.current?.id! }))] });
            }

            setFlashcardsLoading(false);
        }
        catch (e) {
            console.error("Could not generate new flashcards:", e);
        }
        finally {
            console.log("Saving updated flashcards locally:", updatedFlashcards);
            await invoke("save_local_flashcards", { fileId: fileId, flashcards: updatedFlashcards });
            await updateNoteTimestamp(activeFileIdRef.current);
        }
    }

    // Delete the given flashcard
    const deleteFlashcard = async (flashcardId: String) => {
        if (!flashcards.find((f) => f.id === flashcardId)) return;

        const fileId = activeFileIdRef.current!;
        const noteId = currentNoteRef.current?.id!;
        const currentFlashcards = flashcardsRef.current;

        if (noteId === currentNoteRef.current?.id!) {
            setFlashcards((prev) => prev.filter((f) => f.id !== flashcardId));
        }

        let updatedFlashcards = currentFlashcards.filter((f) => f.id !== flashcardId);
        await invoke("save_local_flashcards", { fileId: fileId, flashcards: updatedFlashcards });
        await updateNoteTimestamp(activeFileIdRef.current);

        if (syncEnabled) {
            const id = crypto.randomUUID();
            scheduleSync(`flashcard-${id}`,
                { type: "flashcard", operation: "delete", id: String(id), payload: { flashcard_id: flashcardId } });
        }
        await invoke("delete_flashcard", { flashcardId: flashcardId });
    }

    // Replace the given flashcard
    const replaceFlashcard = async (flashcardId: String) => {
        if (!flashcards.find((f) => f.id === flashcardId)) return;
        const fileId = activeFileIdRef.current!;
        const noteId = currentNoteRef.current?.id!;
        const currentFlashcards = flashcardsRef.current;

        deleteFlashcard(flashcardId);

        const newFlashcards = await invoke<ResponseFlashcard[]>("generate_flashcards", { noteId: noteId, count: 1 });

        if (noteId === currentNoteRef.current?.id!) {
            setFlashcards((prev) => [...prev, ...newFlashcards]);
        }

        let updatedFlashcards = currentFlashcards.filter((f) => f.id !== flashcardId);
        updatedFlashcards = [...updatedFlashcards, ...newFlashcards];
        if (syncEnabled) {
            const id = crypto.randomUUID();
            scheduleSync(`flashcard-${id}`,
                { type: "flashcard", operation: "create", id: String(id), payload: [...updatedFlashcards.map((f) => ({ ...f, note_id: currentNoteRef.current?.id! }))] });
        }
        await invoke("save_local_flashcards", { fileId: fileId, flashcards: updatedFlashcards });
        await updateNoteTimestamp(activeFileIdRef.current);
    }

    // Flush the current review queue based on an interval
    const flushPersistedQueue = useCallback(async () => {
        if (!syncEnabled) return;
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

    // If sync is enabled, uses the review queue to sync changes
    useEffect(() => {
        if (!syncEnabled) return;

        const interval = setInterval(flushPersistedQueue, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [syncEnabled, flushPersistedQueue]);

    // Review card and update its scheduling info
    const reviewCard = useCallback((key: String, review: CardReview) => {
        reviewQueue.current.set(key, review);

        if (syncEnabled)
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

                    if (syncEnabled)
                        await invoke("submit_review", { review: reviewedFlashcard });
                    reviewQueue.current.delete(key);

                    setFlashcards((prev) =>
                        prev.map((f) =>
                            f.id === reviewedFlashcard.id ? reviewedFlashcard : f)
                    );

                    const updatedFlashcards = flashcardsRef.current.map((f) =>
                        f.id === reviewedFlashcard.id ? reviewedFlashcard : f);
                    await invoke("save_local_flashcards", { fileId: activeFileIdRef?.current!, flashcards: updatedFlashcards });
                    await updateNoteTimestamp(activeFileIdRef.current);

                    if (syncEnabled)
                        await invoke("save_review_queue", { queue: Object.fromEntries(Array.from(reviewQueue.current.entries()).map(([k, v]) => [k.toString(), v])) });
                }
                catch (e) {
                    console.log("Could not submit review for card:", e);
                }
            }, DEBOUNCE_MS));
    }, [])

    return { flashcards, setFlashcards, reviewCard, isFlashcardOverlayOpen, setIsFlashcardOverlayOpen, flashcardsLoading, replaceStaleFlashcards, deleteFlashcard, replaceFlashcard };
}
