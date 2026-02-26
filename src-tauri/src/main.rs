// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

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

        let name = entry.file_name().to_string_lossy().to_string();

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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![scan_dir])
        .run(tauri::generate_context!())
        .expect("Error while running tauri application");
    cognitum_frontend_lib::run()
}
