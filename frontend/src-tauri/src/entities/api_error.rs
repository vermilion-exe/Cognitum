use std::fmt;

#[derive(Debug, serde::Serialize)]
pub struct ApiError {
    pub status: u16,
    pub message: String,
}

impl ApiError {
    pub fn new(status: u16, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }
}

impl From<String> for ApiError {
    fn from(message: String) -> Self {
        Self::new(0, message)
    }
}

impl From<&str> for ApiError {
    fn from(message: &str) -> Self {
        Self::new(0, message)
    }
}

impl fmt::Display for ApiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.status == 0 {
            write!(f, "{}", self.message)
        } else {
            write!(
                f,
                "Request failed with status {}: {}",
                self.status, self.message
            )
        }
    }
}
