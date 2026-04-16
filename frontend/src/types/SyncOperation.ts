type SyncOperation = {
    type: "note" | "explanation" | "summary" | "question";
    id: string;
    payload: unknown;
    timestamp: number;
}
