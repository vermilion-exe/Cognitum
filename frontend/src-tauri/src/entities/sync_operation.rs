use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct SyncOperation {
    pub r#type: String,
    pub operation: String,
    pub id: String,
    pub payload: serde_json::Value,
    pub timestamp: i64,
}
