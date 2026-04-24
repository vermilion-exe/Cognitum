use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct RequestDeleteFlashcard {
    pub flashcard_id: String,
}
