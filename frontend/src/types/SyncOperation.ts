type SyncOperation = {
    type: "note" | "highlight" | "summary" | "question";
    id: string;
    payload: unknown;
    timestamp: number;
}
