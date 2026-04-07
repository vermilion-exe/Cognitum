use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ResponseSummary {
    pub id: String,
    pub summary: String,
    pub note_id: u64,
}
