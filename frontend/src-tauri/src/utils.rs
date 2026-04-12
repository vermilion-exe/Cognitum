use std::future::Future;

use reqwest::{Client, Response, StatusCode};
use serde::Deserialize;
use tauri::Emitter;

use crate::{
    commands::{auth::refresh_token, config::load_token},
    AppState,
};

pub enum AuthMode {
    None,
    Bearer,
}

pub async fn decode_response<T: for<'de> Deserialize<'de>>(
    response: Response,
) -> Result<T, String> {
    let status = response.status();
    let text = response.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        let err = format!("Request failed with status {}: {}", status, text);
        eprintln!("{}", err);
        return Err(err);
    }

    serde_json::from_str::<T>(&text).map_err(|e| {
        let err = format!("Decode error: {} | Body was: {}", e, text);
        eprintln!("{}", err);
        err
    })
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
                        return Err(e);
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
