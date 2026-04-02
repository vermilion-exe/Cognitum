use std::{collections::HashMap, fs, path::Path};

use tauri::{AppHandle, Manager};
use uuid::Uuid;

use crate::{
    //commands::config::load_token,
    entities::{response_explanation::ResponseExplanation, response_highlight::ResponseHighlight},
    utils::send_request,
};

#[tauri::command]
pub async fn request_explanation(text: String) -> Result<ResponseExplanation, String> {
    let client = reqwest::Client::new();

    //let token: String = load_token(false).map_err(|e| e.to_string())?;

    let response = client
        .post("http://localhost:8080/api/cognitum/explanation/explain")
        //.header("Authorization", format!("Bearer {}", token))
        .json(&text)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    send_request::<ResponseExplanation>(response).await
}

#[tauri::command]
pub async fn read_highlights(
    app: AppHandle,
    file_id: String,
) -> Result<Option<Vec<ResponseHighlight>>, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(get_highlight_mapping(&app, &file_id)?);

    if !path.exists() {
        return Ok(None);
    }

    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text)
        .map(Some)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_highlights(
    app: AppHandle,
    file_id: String,
    highlights: Vec<ResponseHighlight>,
) -> Result<(), String> {
    let highlights_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(get_highlight_mapping(&app, &file_id)?);

    let json = serde_json::to_string(&highlights).map_err(|e| e.to_string())?;
    fs::write(highlights_path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_highlight(
    app: AppHandle,
    file_id: String,
    highlight_id: String,
) -> Result<(), String> {
    let highlights_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(get_highlight_mapping(&app, &file_id)?);

    let text = fs::read_to_string(&highlights_path).map_err(|e| e.to_string())?;
    let mut highlights: Vec<ResponseHighlight> =
        serde_json::from_str(&text).map_err(|e| e.to_string())?;

    highlights.retain(|x| x.id != highlight_id);

    let json = serde_json::to_string(&highlights).map_err(|e| e.to_string())?;
    fs::write(highlights_path, json).map_err(|e| e.to_string())
}

fn get_highlight_mapping(app: &AppHandle, file_id: &String) -> Result<String, String> {
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

    let new_value = format!("{}_{}", file_name, Uuid::new_v4());

    mappings.insert(file_id.clone(), new_value.clone());

    if let Some(parent) = mappings_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(&mappings).map_err(|e| e.to_string())?;
    fs::write(&mappings_path, json).map_err(|e| e.to_string())?;

    Ok(new_value)
}
