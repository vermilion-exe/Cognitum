import { invoke } from "@tauri-apps/api/core";

// Types for the sync update objects
export interface NoteUpdate {
  note: RequestNote;
  timestamp: number;
}

export interface HighlightUpdate {
  highlight: ResponseHighlight;
  timestamp: number;
}

export interface SummaryUpdate {
  summary: ResponseSummary;
  timestamp: number;
}

// Sync update types
export type SyncUpdate = {
  type: "note" | "highlight" | "summary";
  id: string;
  payload: any;
  timestamp: number;
};

export type RequestNote = {
  id: number;
  text: string;
  path: string;
};

export type ResponseHighlight = {
  id: string;
  from: number;
  to: number;
  selected_text: string;
  explanation: string;
  created_at: string;
};

export type ResponseSummary = {
  id: number;
  summary: string;
  note_id: number;
};