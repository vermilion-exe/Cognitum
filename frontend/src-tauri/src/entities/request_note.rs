use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RequestNote {
    pub id: u64,
    pub text: String,
    pub path: String,
}
