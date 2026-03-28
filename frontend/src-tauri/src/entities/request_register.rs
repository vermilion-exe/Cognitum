use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RequestRegister {
    pub username: String,
    pub email: String,
    pub password: String,
}
