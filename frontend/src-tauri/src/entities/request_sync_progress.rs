use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RequestSyncProgress {
    pub completed_note_ids: Vec<u64>,
    #[ts(type = "string")]
    pub started_at: DateTime<Utc>,
}
