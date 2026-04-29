use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct RequestAttachment {
    pub file_path: String,
    pub relative_path: String,
    pub created_at: Option<DateTime<Utc>>,
    pub last_updated: Option<DateTime<Utc>>,
}
