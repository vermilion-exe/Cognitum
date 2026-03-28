use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub vault_path: Option<String>,
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

    let cfg = AppConfig {
        vault_path: Some(vault_path),
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

    entry.delete_password().map_err(|e| e.to_string())
}
