use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct RequestChangePassword {
    pub email: String,
    pub email_confirm_code: u64,
    pub new_password: String,
    pub confirm_password: String,
}
