use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::entities::response_choice::ResponseChoice;

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ResponseExplanation {
    pub choices: Vec<ResponseChoice>,
}
