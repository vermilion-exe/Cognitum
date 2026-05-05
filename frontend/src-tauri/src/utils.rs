use std::future::Future;

use reqwest::{Client, Response, StatusCode};
use serde::{Deserialize, Serialize};
use tauri::Emitter;

use crate::{
    commands::{auth::refresh_token, config::load_token},
    entities::api_error::ApiError,
    AppState,
};

pub enum AuthMode {
    None,
    Bearer,
}

#[derive(Deserialize, Serialize)]
struct ErrorResponse {
    message: Option<String>,
    detail: Option<String>,
}

pub async fn decode_response<T: for<'de> Deserialize<'de>>(
    response: Response,
) -> Result<T, ApiError> {
    let status = response.status();
    let text = response.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        let message = serde_json::from_str::<ErrorResponse>(&text)
            .ok()
            .and_then(|error| error.message.or(error.detail))
            .filter(|message| !message.is_empty())
            .unwrap_or_else(|| text.clone());
        let err = ApiError::new(status.as_u16(), message);
        eprintln!("{}", err);
        return Err(err);
    }

    serde_json::from_str::<T>(&text).map_err(|e| {
        let err = format!("Decode error: {} | Body was: {}", e, text);
        eprintln!("{}", err);
        ApiError::from(err)
    })
}

pub async fn send_request_api_error<T, F, Fut>(
    state: &AppState,
    auth_mode: AuthMode,
    build_request: F,
) -> Result<T, ApiError>
where
    T: for<'de> Deserialize<'de>,
    F: Fn(&Client, Option<&str>) -> Fut,
    Fut: Future<Output = Result<Response, reqwest::Error>>,
{
    match auth_mode {
        AuthMode::None => {
            let response = build_request(&state.client, None)
                .await
                .map_err(|e| e.to_string())?;
            decode_response(response).await
        }
        AuthMode::Bearer => {
            let access_token = load_token(false)?;

            let response = build_request(&state.client, Some(&access_token))
                .await
                .map_err(|e| e.to_string())?;

            if response.status() == StatusCode::FORBIDDEN
                || response.status() == StatusCode::UNAUTHORIZED
            {
                let new_token = match refresh_token(&state.client, &state.base_url).await {
                    Ok(token) => token,
                    Err(e) => {
                        state.app_handle.emit("auth:logout", ()).unwrap();
                        return Err(e.into());
                    }
                };

                let retry_response = build_request(&state.client, Some(&new_token))
                    .await
                    .map_err(|e| e.to_string())?;

                return decode_response(retry_response).await;
            }

            decode_response(response).await
        }
    }
}

pub async fn send_request<T, F, Fut>(
    state: &AppState,
    auth_mode: AuthMode,
    build_request: F,
) -> Result<T, String>
where
    T: for<'de> Deserialize<'de>,
    F: Fn(&Client, Option<&str>) -> Fut,
    Fut: Future<Output = Result<Response, reqwest::Error>>,
{
    send_request_api_error(state, auth_mode, build_request)
        .await
        .map_err(|e| e.to_string())
}
