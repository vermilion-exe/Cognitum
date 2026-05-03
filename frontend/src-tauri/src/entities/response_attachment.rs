use base64::{engine::general_purpose, Engine};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Deserializer, Serialize};
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
    #[serde(deserialize_with = "deserialize_base64_vec")]
    pub bytes: Vec<u8>,
}

fn deserialize_base64_vec<'de, D>(deserializer: D) -> Result<Vec<u8>, D::Error>
where
    D: Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;

    general_purpose::STANDARD
        .decode(s)
        .map_err(serde::de::Error::custom)
}
