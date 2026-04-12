use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct ResponseOperation {
    pub success: bool,
}
