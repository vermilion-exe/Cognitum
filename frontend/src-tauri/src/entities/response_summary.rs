use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ResponseSummary {
    pub id: Option<String>,
    pub summary: String,
    pub note_id: Option<u64>,
}
