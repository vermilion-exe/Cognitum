use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ResponseAttachment {
    pub id: u64,
    pub path: String,
    pub content_type: String,
    #[ts(type = "string")]
    pub created_at: DateTime<Utc>,
    #[ts(type = "string")]
    pub last_updated: DateTime<Utc>,
    pub bytes: Vec<u8>,
}
