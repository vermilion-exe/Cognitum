use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::entities::response_message::ResponseMessage;

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ResponseChoice {
    pub message: ResponseMessage,
}
