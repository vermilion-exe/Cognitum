type SyncOperation = {
    type: "note" | "explanation" | "summary" | "question";
    operation: "create" | "delete" | "move";
    id: string;
    payload: unknown;
    timestamp: number;
}
