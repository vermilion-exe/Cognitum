use reqwest::Client;

use crate::commands::config::{load_token, save_token_internal};
use crate::entities::request_auth::RequestAuth;
use crate::entities::request_register::RequestRegister;
use crate::entities::response_auth::ResponseAuth;
use crate::utils::{send_request, AuthMode};
use crate::AppState;

#[tauri::command]
pub async fn request_register(
    request: RequestRegister,
    state: tauri::State<'_, AppState>,
) -> Result<ResponseAuth, String> {
    let url = format!("{}/auth/register", &state.base_url);

    send_request(&state, AuthMode::None, |client, _| {
        client.post(&url).json(&request).send()
    })
    .await
}

#[tauri::command]
pub async fn request_auth(
    request: RequestAuth,
    state: tauri::State<'_, AppState>,
) -> Result<ResponseAuth, String> {
    let url = format!("{}/auth/authenticate", &state.base_url);

    send_request(&state, AuthMode::None, |client, _| {
        client.post(&url).json(&request).send()
    })
    .await
}

pub async fn refresh_token(client: &Client, base_url: &str) -> Result<String, String> {
    let refresh_token = load_token(true)?;

    let response = client
        .post(format!("{}/refresh-token", base_url))
        .bearer_auth(refresh_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status();
    let text = response.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!("Token refresh failed: {}", text));
    }

    let token_response: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| e.to_string())?;

    let new_token = token_response["access_token"]
        .as_str()
        .ok_or("Missing access token in refresh response")?
        .to_string();

    save_token_internal(&new_token, false)?;
    Ok(new_token)
}
