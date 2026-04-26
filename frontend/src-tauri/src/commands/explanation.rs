use std::{collections::HashMap, fs, path::Path};

use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

use crate::{
    entities::{
        response_explanation::ResponseExplanation, response_highlight::ResponseHighlight,
        response_operation::ResponseOperation,
    },
    utils::{send_request, AuthMode},
    AppState,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct HighlightUpdate {
    highlight: ResponseHighlight,
    timestamp: u64,
}

#[tauri::command]
pub async fn request_explanation(
    text: String,
    state: tauri::State<'_, AppState>,
) -> Result<ResponseExplanation, String> {
    let url = format!("{}/explanation/explain", &state.base_url);

    send_request(&state, AuthMode::Bearer, |client, token| {
        let mut request = client.post(&url).json(&text);
        if let Some(t) = token {
            request = request.bearer_auth(t);
        }
        request.send()
    })
    .await
}

#[tauri::command]
pub async fn read_highlights(
    state: State<'_, AppState>,
    file_id: String,
) -> Result<Option<Vec<ResponseHighlight>>, String> {
    let _lock = &state.highlight_mapping_lock.lock().await;
    let path = &state
        .app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(get_highlight_mapping(&state.app_handle, &file_id, _lock)?);

    if !path.exists() {
        return Ok(None);
    }

    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let highlights = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    Ok(Some(highlights))
}

#[tauri::command]
pub async fn save_highlights(
    state: State<'_, AppState>,
    file_id: String,
    highlights: Vec<ResponseHighlight>,
) -> Result<(), String> {
    let _lock = &state.highlight_mapping_lock.lock().await;
    let highlights_path = &state
        .app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(get_highlight_mapping(&state.app_handle, &file_id, _lock)?);

    let json = serde_json::to_string(&highlights).map_err(|e| e.to_string())?;
    fs::write(highlights_path, json).map_err(|e| e.to_string())
}

fn get_highlight_mapping<T>(
    app: &AppHandle,
    file_id: &String,
    _lock: &T,
) -> Result<String, String> {
    let mappings_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("highlight_mappings.json");

    let mut mappings: HashMap<String, String> = if mappings_path.exists() {
        let text = fs::read_to_string(&mappings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&text).map_err(|e| e.to_string())?
    } else {
        HashMap::new()
    };

    if let Some(value) = mappings.get(file_id) {
        return Ok(value.clone());
    }

    let file_name = Path::new(&file_id)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown");

    let new_value = format!("{}_{}.json", file_name, Uuid::new_v4());

    mappings.insert(file_id.clone(), new_value.clone());

    if let Some(parent) = mappings_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(&mappings).map_err(|e| e.to_string())?;
    fs::write(&mappings_path, json).map_err(|e| e.to_string())?;

    Ok(new_value)
}

#[tauri::command]
pub async fn get_explanations_by_note_id(
    note_id: u64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<ResponseHighlight>, String> {
    let url = format!("{}/explanation/note", state.base_url);
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
pub async fn create_explanation(
    request: ResponseHighlight,
    state: tauri::State<'_, AppState>,
) -> Result<ResponseHighlight, String> {
    let url = format!("{}/explanation", &state.base_url);

    send_request::<ResponseHighlight, _, _>(&state, AuthMode::Bearer, |client, token| {
        let mut request = client.post(&url).json(&request);
        if let Some(t) = token {
            request = request.bearer_auth(t);
        }
        request.send()
    })
    .await
}

#[tauri::command]
pub async fn delete_explanation(
    state: tauri::State<'_, AppState>,
    highlight_id: String,
) -> Result<ResponseOperation, String> {
    let url = format!("{}/explanation/{}", &state.base_url, highlight_id);

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
pub async fn delete_explanations_except(
    state: tauri::State<'_, AppState>,
    ids: Vec<String>,
) -> Result<ResponseOperation, String> {
    let url = format!("{}/explanation/except", state.base_url);

    let mut url = reqwest::Url::parse(&url).map_err(|e| e.to_string())?;
    {
        let mut query = url.query_pairs_mut();
        for id in &ids {
            query.append_pair("ids", &id.to_string());
        }
    }

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
pub async fn delete_all_note_explanations(
    state: tauri::State<'_, AppState>,
    note_id: u64,
) -> Result<ResponseOperation, String> {
    let url = format!("{}/explanation/note", state.base_url);
    let params = [("noteId", note_id.to_string())];

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
pub async fn get_highlights_since(
    since: u64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<HighlightUpdate>, String> {
    let url = format!("{}/explanation/since/{}", &state.base_url, since);

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
pub async fn remove_highlight(
    state: State<'_, AppState>,
    file_id: String,
    highlight_id: String,
) -> Result<(), String> {
    let _lock = &state.highlight_mapping_lock.lock().await;
    let highlights_path = &state
        .app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(get_highlight_mapping(&state.app_handle, &file_id, _lock)?);

    let text = fs::read_to_string(&highlights_path).map_err(|e| e.to_string())?;
    let mut highlights: Vec<ResponseHighlight> =
        serde_json::from_str(&text).map_err(|e| e.to_string())?;

    highlights.retain(|x| x.id != highlight_id);

    let json = serde_json::to_string(&highlights).map_err(|e| e.to_string())?;
    fs::write(highlights_path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_local_highlights(
    state: State<'_, AppState>,
    file_id: String,
) -> Result<(), String> {
    let _lock = &state.highlight_mapping_lock.lock().await;
    let highlights_path = &state
        .app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(get_highlight_mapping(&state.app_handle, &file_id, _lock)?);

    if !highlights_path.exists() {
        return Ok(());
    }

    fs::remove_file(&highlights_path).map_err(|e| e.to_string())
}

fn remove_highlights_internal(app: &AppHandle, file_id: String) -> Result<(), String> {
    let highlights_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(file_id);

    fs::remove_file(&highlights_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_local_highlight_data(app: AppHandle) -> Result<(), String> {
    let mappings_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("highlight_mappings.json");

    let mappings: HashMap<String, String> = if mappings_path.exists() {
        let text = fs::read_to_string(&mappings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&text).map_err(|e| e.to_string())?
    } else {
        HashMap::new()
    };

    for (_, filename) in mappings {
        let _ = remove_highlights_internal(&app, filename);
    }

    fs::remove_file(&mappings_path).map_err(|e| e.to_string())
}
