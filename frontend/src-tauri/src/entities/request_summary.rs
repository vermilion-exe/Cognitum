use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RequestSummary {
    pub markdown: String,
    pub max_new_tokens: u32,
    pub recursive: bool,
}
