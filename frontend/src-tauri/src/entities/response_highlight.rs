use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ResponseHighlight {
    pub id: String,
    pub from: i32,
    pub to: i32,
    pub selected_text: String,
    pub explanation: String,
    #[ts(type = "string")]
    pub created_at: DateTime<Utc>,
    pub note_id: u64,
}
