mod commands;
mod entities;
mod utils;

use commands::{auth, config, explanation, file_system, note, question, summarizer, watcher};
use notify::RecommendedWatcher;
use notify_debouncer_mini::Debouncer;
use reqwest::Client;
use tauri::{async_runtime::Mutex, Manager};

use crate::commands::watcher::WatcherState;

pub struct AppState {
    pub client: Client,
    pub base_url: String,
    pub app_handle: tauri::AppHandle,
    pub highlight_mapping_lock: Mutex<()>,
    pub flashcard_mapping_lock: Mutex<()>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            app.manage(AppState {
                client: reqwest::Client::new(),
                base_url: "http://localhost:8080/api/cognitum".to_string(),
                app_handle: handle,
                highlight_mapping_lock: Mutex::new(()),
                flashcard_mapping_lock: Mutex::new(()),
            });
            Ok(())
        })
        .manage(WatcherState(std::sync::Mutex::new(
            None::<Debouncer<RecommendedWatcher>>,
        )))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            auth::request_register,
            auth::request_auth,
            auth::logout,
            auth::confirm_code,
            auth::email_send_code,
            auth::change_password,
            auth::delete_user,
            watcher::watch_dir,
            watcher::unwatch_dir,
            config::save_user,
            config::load_user,
            config::clear_user,
            config::save_token,
            config::load_token,
            config::clear_token,
            config::delete_sync_data,
            config::delete_app_data,
            file_system::create_file,
            file_system::create_directory,
            file_system::read_file,
            file_system::delete_file,
            file_system::delete_directory,
            file_system::rename,
            file_system::move_node,
            config::load_config,
            config::save_vault_path,
            config::save_sync_enabled,
            file_system::scan_dir,
            summarizer::request_summary,
            summarizer::get_summary_by_note_id,
            summarizer::create_summary,
            summarizer::save_summary,
            summarizer::get_local_summary,
            summarizer::remove_local_summary,
            summarizer::delete_local_summaries,
            explanation::request_explanation,
            explanation::save_highlights,
            explanation::read_highlights,
            explanation::remove_highlight,
            explanation::get_explanations_by_note_id,
            explanation::create_explanation,
            explanation::delete_explanation,
            explanation::delete_all_note_explanations,
            explanation::delete_explanations_except,
            explanation::remove_local_highlights,
            explanation::delete_local_highlight_data,
            note::get_all_notes,
            note::save_note_metadata,
            note::get_local_note,
            note::get_local_notes,
            note::move_note,
            note::get_notes_since, // New command for polling
            note::get_note_by_path,
            note::create_note,
            note::delete_note,
            explanation::get_highlights_since, // New command for polling
            summarizer::get_summaries_since,   // New command for polling
            question::generate_flashcards,
            question::check_flashcard_relevance,
            question::update_stale_flashcards,
            question::create_flashcard,
            question::submit_review,
            question::get_flashcards_by_note_id,
            question::delete_stale_flashcards,
            question::delete_all_flashcards_by_note_id,
            question::delete_flashcards_except,
            question::delete_flashcard,
            question::save_local_flashcards,
            question::load_local_flashcards,
            question::remove_local_flashcards,
            question::save_review_queue,
            question::load_review_queue,
            question::delete_local_flashcards,
            config::save_sync_timestamp, // New command for saving sync timestamp
            config::load_sync_timestamp, // New command for loading sync timestamp
            config::save_sync_progress,
            config::load_sync_progress,
            config::clear_sync_progress,
            config::save_sync_queue,
            config::load_sync_queue,
            config::get_manual
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
