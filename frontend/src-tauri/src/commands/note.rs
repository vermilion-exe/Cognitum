use std::{
    collections::HashMap,
    fs::{self},
};

use crate::{
    entities::{
        request_delete::RequestDelete, request_move::RequestMove, request_note::RequestNote,
        response_operation::ResponseOperation,
    },
    utils::{send_request, AuthMode},
    AppState,
};
use chrono::{DateTime, Utc};
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn get_note_by_path(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<RequestNote, String> {
    let url = format!("{}/note/path", &state.base_url);
    let params = [("path", path)];

    let url = reqwest::Url::parse_with_params(&url, &params).map_err(|e| e.to_string())?;

    send_request(&state, AuthMode::Bearer, |client, token| {
        let mut request = client.get(url.clone());
        if let Some(t) = token {
            request = request.bearer_auth(t);
        }

        request.send()
    })
    .await
}

#[tauri::command]
pub async fn create_note(
    request: RequestNote,
    state: tauri::State<'_, AppState>,
) -> Result<RequestNote, String> {
    let url = format!("{}/note", &state.base_url);

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
pub async fn get_all_notes(state: tauri::State<'_, AppState>) -> Result<Vec<RequestNote>, String> {
    let url = format!("{}/note", &state.base_url);

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
pub async fn get_notes_since(
    since: DateTime<Utc>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<RequestNote>, String> {
    let url = format!("{}/note/since", &state.base_url);
    let params = [("timestamp", since.to_rfc3339())];

    let url = reqwest::Url::parse_with_params(&url, &params).map_err(|e| e.to_string())?;

    send_request(&state, AuthMode::Bearer, |client, token| {
        let mut request = client.get(url.clone());
        if let Some(t) = token {
            request = request.bearer_auth(t);
        }

        request.send()
    })
    .await
}

#[tauri::command]
pub async fn move_note(
    state: tauri::State<'_, AppState>,
    request: RequestMove,
) -> Result<RequestNote, String> {
    let url = format!("{}/note/move", &state.base_url);
    let params = [("oldPath", request.old_path), ("newPath", request.new_path)];

    let url = reqwest::Url::parse_with_params(&url, &params).map_err(|e| e.to_string())?;

    send_request(&state, AuthMode::Bearer, |client, token| {
        let mut request = client.post(url.clone());
        if let Some(t) = token {
            request = request.bearer_auth(t);
        }
        request.send()
    })
    .await
}

#[tauri::command]
pub async fn delete_note(
    state: tauri::State<'_, AppState>,
    request: RequestDelete,
) -> Result<ResponseOperation, String> {
    let url = format!("{}/note", &state.base_url);
    let params = [("path", request.path)];

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
pub async fn save_note_timestamp(
    app: AppHandle,
    path: String,
    timestamp: DateTime<Utc>,
) -> Result<(), String> {
    let mappings_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("note_metadata.json");

    let mut mappings: HashMap<String, DateTime<Utc>> = if mappings_path.exists() {
        let text = fs::read_to_string(&mappings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&text).map_err(|e| e.to_string())?
    } else {
        HashMap::new()
    };

    mappings.insert(path, timestamp);

    if let Some(parent) = mappings_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(&mappings).map_err(|e| e.to_string())?;
    fs::write(&mappings_path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_local_note_timestamp(
    app: AppHandle,
    path: String,
) -> Result<Option<DateTime<Utc>>, String> {
    let mappings_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("note_metadata.json");

    let mappings: HashMap<String, DateTime<Utc>> = if mappings_path.exists() {
        let text = fs::read_to_string(&mappings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&text).map_err(|e| e.to_string())?
    } else {
        return Ok(None);
    };

    Ok(mappings.get(&path).cloned())
}

#[tauri::command]
pub async fn remove_local_note_timestamp(app: AppHandle, path: String) -> Result<(), String> {
    let mappings_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("note_metadata.json");

    let mut mappings: HashMap<String, String> = if mappings_path.exists() {
        let text = fs::read_to_string(&mappings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&text).map_err(|e| e.to_string())?
    } else {
        return Ok(());
    };

    mappings.remove(&path);

    if let Some(parent) = mappings_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(&mappings).map_err(|e| e.to_string())?;
    fs::write(&mappings_path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_note_metadata(app: AppHandle) -> Result<(), String> {
    let mappings_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("note_metadata.json");

    fs::remove_file(&mappings_path).map_err(|e| e.to_string())
}
