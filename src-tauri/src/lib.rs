use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[tauri::command]
fn create_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    fs::remove_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_directory(path: String) -> Result<(), String> {
    fs::remove_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename(from: String, to: String) -> Result<(), String> {
    fs::rename(&from, &to).map_err(|e| e.to_string())
}

#[tauri::command]
fn move_node(from: String, to: String) -> Result<(), String> {
    fs::rename(&from, &to).map_err(|e| e.to_string())
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct AppConfig {
    vault_path: Option<String>,
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("config.json"))
}

#[tauri::command]
fn load_config(app: AppHandle) -> Result<AppConfig, String> {
    let path = config_path(&app)?;

    if !path.exists() {
        return Ok(AppConfig::default());
    }

    let s = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&s).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_vault_path(app: AppHandle, vault_path: String) -> Result<(), String> {
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FSNode {
    id: String,
    name: String,
    kind: String,
    children: Vec<FSNode>,
}

#[tauri::command]
fn scan_dir(path: String, recursive: bool) -> Result<Vec<FSNode>, String> {
    let root = PathBuf::from(&path);

    if !root.exists() {
        return Err(format!("Path does not exist: {}", path));
    } else if !root.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    read_dir_nodes(&root, recursive).map_err(|e| e.to_string())
}

fn read_dir_nodes(dir: &Path, recursive: bool) -> std::io::Result<Vec<FSNode>> {
    let mut nodes: Vec<FSNode> = vec![];

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let p = entry.path();
        let file_type = entry.file_type()?;

        let name = if file_type.is_file()
            && p.extension()
                .and_then(|e| e.to_str())
                .map_or(false, |e| e.eq_ignore_ascii_case("md"))
        {
            p.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or_default()
                .to_string()
        } else {
            entry.file_name().to_string_lossy().to_string()
        };

        let id = p.to_string_lossy().to_string();

        if file_type.is_dir() {
            let children = if recursive {
                read_dir_nodes(&p, true)?
            } else {
                vec![]
            };

            nodes.push(FSNode {
                id,
                name,
                kind: "dir".to_string(),
                children,
            });
        } else if file_type.is_file() {
            nodes.push(FSNode {
                id,
                name,
                kind: "file".to_string(),
                children: vec![],
            });
        }
    }

    nodes.sort_by(|a, b| {
        let a_is_dir = a.kind == "dir";
        let b_is_dir = b.kind == "dir";

        match (a_is_dir, b_is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(nodes)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            create_file,
            create_directory,
            read_file,
            delete_file,
            delete_directory,
            rename,
            move_node,
            load_config,
            save_vault_path,
            scan_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
