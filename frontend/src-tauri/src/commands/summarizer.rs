use std::{collections::HashMap, fs};

use crate::{
    entities::{request_summary::RequestSummary, response_summary::ResponseSummary},
    utils::{send_request, AuthMode},
    AppState,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize)]
pub struct SummaryUpdate {
    summary: ResponseSummary,
    timestamp: u64,
}

#[tauri::command]
pub async fn request_summary(
    request: RequestSummary,
    state: tauri::State<'_, AppState>,
) -> Result<ResponseSummary, String> {
    let url = format!("{}/summary/summarize", &state.base_url);

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
pub async fn get_summary_by_note_id(
    note_id: u64,
    state: tauri::State<'_, AppState>,
) -> Result<ResponseSummary, String> {
    let url = format!("{}/summary/note", &state.base_url);
    let params = [("noteId", note_id.to_string())];

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
pub async fn create_summary(
    request: ResponseSummary,
    state: tauri::State<'_, AppState>,
) -> Result<ResponseSummary, String> {
    let url = format!("{}/summary", &state.base_url);

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
pub async fn get_summaries_since(
    since: u64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<SummaryUpdate>, String> {
    let url = format!("{}/summary/since/{}", &state.base_url, since);

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
pub async fn save_summary(app: AppHandle, summary: String, file_id: String) -> Result<(), String> {
    let mappings_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("summaries.json");

    let mut mappings: HashMap<String, String> = if mappings_path.exists() {
        let text = fs::read_to_string(&mappings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&text).map_err(|e| e.to_string())?
    } else {
        HashMap::new()
    };

    let summary_json = serde_json::to_string_pretty(&summary).map_err(|e| e.to_string())?;
    mappings.insert(file_id, summary_json);

    if let Some(parent) = mappings_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(&mappings).map_err(|e| e.to_string())?;
    fs::write(&mappings_path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_local_summary(app: AppHandle, file_id: String) -> Result<String, String> {
    let mappings_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("summaries.json");

    let mappings: HashMap<String, String> = if mappings_path.exists() {
        let text = fs::read_to_string(&mappings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&text).map_err(|e| e.to_string())?
    } else {
        return Err("Summary for file non-existent".to_string());
    };

    let value = mappings
        .get(&file_id)
        .ok_or_else(|| "Note summary not found".to_string())?;

    serde_json::from_str(&value).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_local_summary(app: AppHandle, file_id: String) -> Result<(), String> {
    let mappings_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("summaries.json");

    let mut mappings: HashMap<String, String> = if mappings_path.exists() {
        let text = fs::read_to_string(&mappings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&text).map_err(|e| e.to_string())?
    } else {
        return Err("Summary for file non-existent".to_string());
    };

    mappings.remove(&file_id);

    let json = serde_json::to_string_pretty(&mappings).map_err(|e| e.to_string())?;
    fs::write(&mappings_path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_local_summaries(app: AppHandle) -> Result<(), String> {
    let mappings_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("summaries.json");

    if mappings_path.exists() {
        fs::remove_file(&mappings_path).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}
