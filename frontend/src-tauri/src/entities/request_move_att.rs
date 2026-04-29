use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct RequestMoveAttachment {
    pub old_path: String,
    pub new_path: String,
}
