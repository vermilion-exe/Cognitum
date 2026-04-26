use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{new_debouncer, DebouncedEvent, Debouncer};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

pub struct WatcherState(pub Mutex<Option<Debouncer<RecommendedWatcher>>>);

#[tauri::command]
pub fn watch_dir(path: String, app: AppHandle) -> Result<(), String> {
    let state = app.state::<WatcherState>();
    let mut watcher_guard = state.0.lock().map_err(|e| e.to_string())?;

    // Drop any existing watcher
    *watcher_guard = None;

    let app_handle = app.clone();

    let mut debouncer = new_debouncer(
        Duration::from_millis(300),
        move |res: Result<Vec<DebouncedEvent>, notify::Error>| match res {
            Ok(events) => {
                let paths: Vec<String> = events
                    .iter()
                    .map(|e: &DebouncedEvent| e.path.to_string_lossy().to_string())
                    .collect();

                let _ = app_handle.emit("fs-change", paths);
            }
            Err(e) => eprintln!("Watch error: {:?}", e),
        },
    )
    .map_err(|e| e.to_string())?;

    debouncer
        .watcher()
        .watch(std::path::Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    *watcher_guard = Some(debouncer);

    Ok(())
}

#[tauri::command]
pub fn unwatch_dir(app: AppHandle) -> Result<(), String> {
    let state = app.state::<WatcherState>();
    let mut watcher_guard = state.0.lock().map_err(|e| e.to_string())?;
    *watcher_guard = None;
    Ok(())
}
