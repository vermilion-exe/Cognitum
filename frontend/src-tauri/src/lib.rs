mod commands;
mod entities;
mod utils;

use commands::{auth, config, explanation, file_system, summarizer};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            auth::request_register,
            auth::request_auth,
            config::save_user,
            config::load_user,
            config::clear_user,
            config::save_token,
            config::load_token,
            config::clear_token,
            file_system::create_file,
            file_system::create_directory,
            file_system::read_file,
            file_system::delete_file,
            file_system::delete_directory,
            file_system::rename,
            file_system::move_node,
            config::load_config,
            config::save_vault_path,
            file_system::scan_dir,
            summarizer::request_summary,
            explanation::request_explanation,
            explanation::save_highlights,
            explanation::read_highlights,
            explanation::remove_highlight
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
