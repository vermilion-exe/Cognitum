export type SyncOperation = {
    type: "note" | "attachment" | "explanation" | "summary" | "flashcard";
    operation: "create" | "delete" | "move";
    id: string;
    payload: unknown;
    timestamp: number;
}
