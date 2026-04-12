use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RequestNote {
    pub id: Option<u64>,
    pub text: String,
    pub path: String,
    #[ts(type = "string")]
    pub created_at: Option<DateTime<Utc>>,
    #[ts(type = "string")]
    pub last_updated: Option<DateTime<Utc>>,
}
