use std::{collections::HashMap, fs};

use crate::{
    entities::{
        request_delete::RequestDelete, request_move::RequestMove, request_note::RequestNote,
        response_operation::ResponseOperation,
    },
    utils::{send_request, AuthMode},
    AppState,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize)]
pub struct NoteUpdate {
    note: RequestNote,
    timestamp: u64,
}

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
) -> Result<Vec<NoteUpdate>, String> {
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
pub async fn save_note_metadata(
    app: AppHandle,
    path: String,
    note: RequestNote,
) -> Result<(), String> {
    let mappings_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("note_metadata.json");

    let mut mappings: HashMap<String, String> = if mappings_path.exists() {
        let text = fs::read_to_string(&mappings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&text).map_err(|e| e.to_string())?
    } else {
        HashMap::new()
    };

    let mut note_json: serde_json::Value =
        serde_json::to_value(&note).map_err(|e| e.to_string())?;

    if let serde_json::Value::Object(ref mut map) = note_json {
        map.remove("text");
    }

    let note_json = serde_json::to_string_pretty(&note_json).map_err(|e| e.to_string())?;
    mappings.insert(path, note_json);

    if let Some(parent) = mappings_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(&mappings).map_err(|e| e.to_string())?;
    fs::write(&mappings_path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_local_notes(app: AppHandle) -> Result<Option<Vec<RequestNote>>, String> {
    let mappings_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("note_metadata.json");

    let mappings: HashMap<String, String> = if mappings_path.exists() {
        let text = fs::read_to_string(&mappings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&text).map_err(|e| e.to_string())?
    } else {
        return Ok(None);
    };

    mappings
        .values()
        .map(|v| serde_json::from_str(v).map_err(|e| e.to_string()))
        .collect()
}

#[tauri::command]
pub async fn get_local_note(app: AppHandle, path: String) -> Result<Option<RequestNote>, String> {
    let mappings_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("note_metadata.json");

    let mappings: HashMap<String, String> = if mappings_path.exists() {
        let text = fs::read_to_string(&mappings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&text).map_err(|e| e.to_string())?
    } else {
        return Ok(None);
    };

    let metadata = mappings
        .get(&path)
        .ok_or_else(|| "Note metadata not found".to_string())?;

    serde_json::from_str(&metadata).map_err(|e| e.to_string())?
}
