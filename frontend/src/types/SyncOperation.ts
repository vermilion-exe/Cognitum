export type SyncOperation = {
    type: "note" | "explanation" | "summary" | "flashcard";
    operation: "create" | "delete" | "move";
    id: string;
    payload: unknown;
    timestamp: number;
}
