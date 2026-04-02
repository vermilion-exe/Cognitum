use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ResponseMessage {
    pub role: String,
    pub content: String,
}
