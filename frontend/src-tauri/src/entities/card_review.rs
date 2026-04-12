use serde::{Deserialize, Serialize};

use crate::entities::response_flashcard::ResponseFlashcard;

#[derive(Serialize, Deserialize)]
pub struct CardReview {
    pub flashcard: ResponseFlashcard,
    pub quality: u32,
}
