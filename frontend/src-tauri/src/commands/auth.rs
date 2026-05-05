use reqwest::Client;

use crate::commands::config::{load_token, save_token_internal};
use crate::entities::api_error::ApiError;
use crate::entities::request_attachment::RequestAttachment;
use crate::entities::request_auth::RequestAuth;
use crate::entities::request_change_password::RequestChangePassword;
use crate::entities::request_confirmation::RequestConfirmation;
use crate::entities::request_move_att::RequestMoveAttachment;
use crate::entities::request_register::RequestRegister;
use crate::entities::response_attachment::ResponseAttachment;
use crate::entities::response_auth::ResponseAuth;
use crate::entities::response_operation::ResponseOperation;
use crate::utils::{send_request, send_request_api_error, AuthMode};
use crate::AppState;
use reqwest::multipart;
use std::fs;
use std::path::Path;

#[tauri::command]
pub async fn request_register(
    request: RequestRegister,
    state: tauri::State<'_, AppState>,
) -> Result<ResponseAuth, ApiError> {
    let url = format!("{}/auth/register", &state.base_url);

    send_request_api_error(&state, AuthMode::None, |client, _| {
        client.post(&url).json(&request).send()
    })
    .await
}

#[tauri::command]
pub async fn request_auth(
    request: RequestAuth,
    state: tauri::State<'_, AppState>,
) -> Result<ResponseAuth, ApiError> {
    let url = format!("{}/auth/authenticate", &state.base_url);

    send_request_api_error(&state, AuthMode::None, |client, _| {
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

#[tauri::command]
pub async fn logout(state: tauri::State<'_, AppState>) -> Result<ResponseOperation, String> {
    let url = format!("{}/auth/logout", &state.base_url);

    send_request(&state, AuthMode::Bearer, |client, token| {
        let mut request = client.post(&url);
        if let Some(t) = token {
            request = request.bearer_auth(t);
        }
        request.send()
    })
    .await
}

#[tauri::command]
pub async fn confirm_code(
    state: tauri::State<'_, AppState>,
    request: RequestConfirmation,
) -> Result<ResponseOperation, String> {
    let url = format!("{}/auth/confirm", &state.base_url);

    send_request(&state, AuthMode::None, |client, _| {
        let request = client.post(&url).json(&request);
        request.send()
    })
    .await
}

#[tauri::command]
pub async fn email_send_code(
    state: tauri::State<'_, AppState>,
    email: String,
    is_change_password: bool,
) -> Result<bool, String> {
    let url = format!("{}/auth/email", &state.base_url);
    let params = [
        ("email", email),
        ("isChangePassword", is_change_password.to_string()),
    ];

    let url = reqwest::Url::parse_with_params(&url, &params).map_err(|e| e.to_string())?;

    send_request(&state, AuthMode::None, |client, _| {
        let request = client.get(url.clone());
        request.send()
    })
    .await
}

#[tauri::command]
pub async fn change_password(
    state: tauri::State<'_, AppState>,
    request: RequestChangePassword,
) -> Result<bool, String> {
    let url = format!("{}/auth/change-password", &state.base_url);

    send_request(&state, AuthMode::Bearer, |client, token| {
        let mut request = client.post(&url).json(&request);
        if let Some(t) = token {
            request = request.bearer_auth(t);
        }
        request.send()
    })
    .await
}

#[tauri::command]
pub async fn delete_user(state: tauri::State<'_, AppState>) -> Result<ResponseOperation, String> {
    let url = format!("{}/auth", &state.base_url);

    send_request(&state, AuthMode::Bearer, |client, token| {
        let mut request = client.delete(&url);
        if let Some(t) = token {
            request = request.bearer_auth(t);
        }
        request.send()
    })
    .await
}

#[tauri::command]
pub async fn get_attachments(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<ResponseAttachment>, String> {
    let url = format!("{}/auth/attachment", &state.base_url);

    send_request(&state, AuthMode::Bearer, |client, token| {
        let mut request = client.get(&url);
        if let Some(t) = token {
            request = request.bearer_auth(t);
        }
        request.send()
    })
    .await
}

#[tauri::command]
pub async fn create_attachment(
    state: tauri::State<'_, AppState>,
    request: RequestAttachment,
) -> Result<ResponseAttachment, String> {
    let attachment_path = Path::new(&request.file_path);

    if !attachment_path.exists() {
        return Err("File does not exist".to_string());
    }

    let name = attachment_path
        .file_name()
        .ok_or("unknown")?
        .to_string_lossy()
        .to_string();
    let mime_type = mime_guess::from_path(attachment_path)
        .first_or_octet_stream()
        .to_string();
    let bytes = fs::read(attachment_path).map_err(|e| e.to_string())?;

    let url = format!("{}/auth/upload", &state.base_url);
    let mut params = vec![("path", request.relative_path.clone())];

    if let Some(created_at) = request.created_at {
        params.push(("createdAt", created_at.to_rfc3339()));
    }

    if let Some(last_updated) = request.last_updated {
        params.push(("lastUpdated", last_updated.to_rfc3339()));
    }

    let url = reqwest::Url::parse_with_params(&url, &params).map_err(|e| e.to_string())?;

    send_request(&state, AuthMode::Bearer, |client, token| {
        let part = multipart::Part::bytes(bytes.clone())
            .file_name(name.clone())
            .mime_str(&mime_type)
            .expect("Valid MIME Type");

        let form = multipart::Form::new().part("file", part);

        let mut request = client.post(url.clone()).multipart(form);
        if let Some(t) = token {
            request = request.bearer_auth(t);
        }
        request.send()
    })
    .await
}

#[tauri::command]
pub async fn delete_attachment(
    state: tauri::State<'_, AppState>,
    request: String,
) -> Result<ResponseOperation, String> {
    let url = format!("{}/auth/attachment", &state.base_url);
    let params = [("path", request)];

    let url = reqwest::Url::parse_with_params(&url, &params).map_err(|e| e.to_string())?;

    send_request(&state, AuthMode::Bearer, |client, token| {
        let mut request = client.delete(url.clone());
        if let Some(t) = token {
            request = request.bearer_auth(t);
        }
        request.send()
    })
    .await
}

#[tauri::command]
pub async fn move_attachment(
    state: tauri::State<'_, AppState>,
    request: RequestMoveAttachment,
) -> Result<ResponseOperation, String> {
    let url = format!("{}/auth/attachment/move", &state.base_url);
    let params = [
        ("oldPath", &request.old_path),
        ("newPath", &request.new_path),
    ];

    let url = reqwest::Url::parse_with_params(&url, &params).map_err(|e| e.to_string())?;

    send_request(&state, AuthMode::Bearer, |client, token| {
        let mut request = client.put(url.clone());
        if let Some(t) = token {
            request = request.bearer_auth(t);
        }
        request.send()
    })
    .await
}
