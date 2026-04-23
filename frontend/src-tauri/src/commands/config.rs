use chrono::DateTime;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

use crate::entities::request_sync_progress::RequestSyncProgress;
use crate::entities::sync_operation::SyncOperation;

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub vault_path: Option<String>,
    pub sync_enabled: Option<bool>,
}

pub fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("config.json"))
}

#[tauri::command]
pub fn load_config(app: AppHandle) -> Result<AppConfig, String> {
    let path = config_path(&app)?;

    if !path.exists() {
        return Ok(AppConfig::default());
    }

    let s = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&s).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_vault_path(app: AppHandle, vault_path: String) -> Result<(), String> {
    let path = config_path(&app)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let prev_config: AppConfig = fs::read_to_string(path.clone())
        .ok()
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default();

    let cfg = AppConfig {
        vault_path: Some(vault_path),
        sync_enabled: prev_config.sync_enabled,
    };

    let s = serde_json::to_string_pretty(&cfg).map_err(|e| e.to_string())?;
    fs::write(path, s).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_sync_enabled(app: AppHandle, sync_enabled: bool) -> Result<(), String> {
    let path = config_path(&app)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let prev_config: AppConfig = fs::read_to_string(path.clone())
        .ok()
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default();

    let cfg = AppConfig {
        vault_path: prev_config.vault_path,
        sync_enabled: Some(sync_enabled),
    };

    let s = serde_json::to_string_pretty(&cfg).map_err(|e| e.to_string())?;
    fs::write(path, s).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_user(app: AppHandle, user: serde_json::Value) -> Result<(), String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("user.json");

    fs::write(path, user.to_string()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_user(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("user.json");

    if !path.exists() {
        return Ok(None);
    }

    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text)
        .map(Some)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_user(app: AppHandle) -> Result<(), String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("user.json");

    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn save_token(token: String, is_refresh_token: bool) -> Result<(), String> {
    let token_type = if is_refresh_token {
        "refresh_token"
    } else {
        "access_token"
    };
    let entry = keyring::Entry::new("cognitum", token_type).map_err(|e| e.to_string())?;

    entry.set_password(&token).map_err(|e| e.to_string())
}

pub fn save_token_internal(token: &str, is_refresh_token: bool) -> Result<(), String> {
    let token_type = if is_refresh_token {
        "refresh_token"
    } else {
        "access_token"
    };
    let entry = keyring::Entry::new("cognitum", token_type).map_err(|e| e.to_string())?;

    entry.set_password(&token).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_token(is_refresh_token: bool) -> Result<String, String> {
    let token_type = if is_refresh_token {
        "refresh_token"
    } else {
        "access_token"
    };
    let entry = keyring::Entry::new("cognitum", token_type).map_err(|e| e.to_string())?;

    entry.get_password().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_token(is_refresh_token: bool) -> Result<(), String> {
    let token_type = if is_refresh_token {
        "refresh_token"
    } else {
        "access_token"
    };
    let entry = keyring::Entry::new("cognitum", token_type).map_err(|e| e.to_string())?;

    match entry.get_password() {
        Ok(_) => entry.delete_password().map_err(|e| e.to_string()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn save_sync_timestamp(app: AppHandle, timestamp: DateTime<Utc>) -> Result<(), String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("sync_timestamp.json");

    let json = serde_json::to_string(&timestamp).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_sync_timestamp(app: AppHandle) -> Result<DateTime<Utc>, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("sync_timestamp.json");

    if !path.exists() {
        return Err("No sync timestamp".to_string());
    }

    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_sync_progress(app: AppHandle, progress: RequestSyncProgress) -> Result<(), String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("sync_progress.json");

    let json = serde_json::to_string(&progress).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_sync_progress(app: AppHandle) -> Result<Option<RequestSyncProgress>, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("sync_progress.json");

    if !path.exists() {
        return Ok(None);
    }

    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_sync_progress(app: AppHandle) -> Result<(), String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("sync_progress.json");

    fs::remove_file(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_sync_queue(
    app: AppHandle,
    queue: HashMap<String, SyncOperation>,
) -> Result<(), String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("sync_queue.json");

    let json = serde_json::to_string(&queue).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_sync_queue(app: AppHandle) -> Result<Option<HashMap<String, SyncOperation>>, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("sync_queue.json");

    if !path.exists() {
        return Ok(None);
    }

    let json = fs::read_to_string(path).map_err(|e| e.to_string())?;
    if json.trim().is_empty() {
        return Ok(None);
    }
    let queue = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    Ok(Some(queue))
}

fn delete_sync_data_internal(app: &AppHandle) -> Result<(), String> {
    let sync_progress_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("sync_progress.json");

    if sync_progress_path.exists() {
        let _ = fs::remove_file(&sync_progress_path).map_err(|e| e.to_string());
    }

    let sync_queue_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("sync_queue.json");

    if sync_queue_path.exists() {
        let _ = fs::remove_file(&sync_queue_path).map_err(|e| e.to_string());
    }

    let sync_timestamp_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("sync_timestamp.json");

    if sync_timestamp_path.exists() {
        fs::remove_file(&sync_timestamp_path).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
pub fn delete_sync_data(app: AppHandle) -> Result<(), String> {
    delete_sync_data_internal(&app)
}

#[tauri::command]
pub fn delete_app_data(app: AppHandle) -> Result<(), String> {
    let _ = delete_sync_data_internal(&app);

    let config_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("config.json");

    if config_path.exists() {
        fs::remove_file(&config_path).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}
