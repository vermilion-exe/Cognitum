use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ResponseFlashcard {
    pub id: u64,
    pub question: String,
    pub answer: String,
    pub r#type: String,
    pub is_retired: bool,
    pub is_stale: bool,
    pub easiness_factor: f64,
    pub interval: u32,
    pub repetitions: u32,
    #[ts(type = "string")]
    pub next_review: NaiveDate,
    #[ts(type = "string")]
    pub last_reviewed: Option<DateTime<Utc>>,
    pub note_id: u64,
}
