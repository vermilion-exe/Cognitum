use serde::Serialize;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

#[tauri::command]
pub fn create_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_image(path: String, contents: Vec<u8>) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    fs::remove_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_directory(path: String) -> Result<(), String> {
    fs::remove_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename(from: String, to: String) -> Result<(), String> {
    fs::rename(&from, &to).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn move_node(from: String, to: String) -> Result<(), String> {
    fs::rename(&from, &to).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_image(path: String) -> Result<Vec<u8>, String> {
    let image_path = Path::new(&path);

    if !image_path.exists() {
        return Err("File does not exist!".to_string());
    }

    let mut file = std::fs::File::open(&image_path).map_err(|e| e.to_string())?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;

    Ok(buffer)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FSNode {
    pub id: String,
    pub name: String,
    pub extension: Option<String>,
    pub kind: String,
    pub children: Vec<FSNode>,
    pub last_modified: Option<i64>,
}

#[tauri::command]
pub fn scan_dir(path: String, recursive: bool) -> Result<Vec<FSNode>, String> {
    let root = PathBuf::from(&path);

    if !root.exists() {
        return Err(format!("Path does not exist: {}", path));
    } else if !root.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    read_dir_nodes(&root, recursive).map_err(|e| e.to_string())
}

pub fn read_dir_nodes(dir: &Path, recursive: bool) -> std::io::Result<Vec<FSNode>> {
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
        let last_modified = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64);
        let extension = p
            .extension()
            .and_then(|e| e.to_str())
            .map(|s| s.to_string());

        if file_type.is_dir() {
            let children = if recursive {
                read_dir_nodes(&p, true)?
            } else {
                vec![]
            };
            nodes.push(FSNode {
                id,
                name,
                extension,
                kind: "dir".to_string(),
                children,
                last_modified,
            });
        } else if file_type.is_file() {
            nodes.push(FSNode {
                id,
                name,
                extension,
                kind: "file".to_string(),
                children: vec![],
                last_modified,
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
