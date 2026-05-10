use std::{collections::HashMap, fs, path::Path};

use serde::Serialize;
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

use crate::{
    entities::{
        card_review::CardReview, request_delete_flashcard::RequestDeleteFlashcard,
        response_flashcard::ResponseFlashcard, response_operation::ResponseOperation,
    },
    utils::{send_request, AuthMode},
    AppState,
};

#[derive(Serialize)]
struct GenerateFlashcardsRequest<'a> {
    markdown: &'a str,
    count: u32,
}

#[derive(Serialize)]
struct CheckFlashcardRelevanceRequest<'a> {
    markdown: &'a str,
    flashcards: &'a [ResponseFlashcard],
}

#[tauri::command]
pub async fn generate_flashcards(
    state: State<'_, AppState>,
    markdown: String,
    count: u32,
) -> Result<Vec<ResponseFlashcard>, String> {
    let url = format!("{}/question/flashcards/generate", &state.base_url);
    let body = GenerateFlashcardsRequest {
        markdown: &markdown,
        count,
    };

    send_request(&state, AuthMode::Bearer, |client, token| {
        let mut request = client.post(&url).json(&body);
        if let Some(t) = token {
            request = request.bearer_auth(t);
        }
        request.send()
    })
    .await
}

#[tauri::command]
pub async fn update_stale_flashcards(
    state: State<'_, AppState>,
    note_id: u64,
    flashcard_ids: Vec<String>,
) -> Result<ResponseOperation, String> {
    let url = format!("{}/question/flashcards/stale", &state.base_url);
    let params = [("noteId", note_id.to_string())];

    let url = reqwest::Url::parse_with_params(&url, &params).map_err(|e| e.to_string())?;

    send_request(&state, AuthMode::Bearer, |client, token| {
        let mut request = client.put(url.clone()).json(&flashcard_ids);
        if let Some(t) = token {
            request = request.bearer_auth(t);
        }
        request.send()
    })
    .await
}

#[tauri::command]
pub async fn check_flashcard_relevance(
    state: State<'_, AppState>,
    markdown: String,
    flashcards: Vec<ResponseFlashcard>,
) -> Result<Vec<String>, String> {
    let url = format!("{}/question/relevance", &state.base_url);
    let body = CheckFlashcardRelevanceRequest {
        markdown: &markdown,
        flashcards: &flashcards,
    };

    send_request(&state, AuthMode::Bearer, |client, token| {
        let mut request = client.post(&url).json(&body);
        if let Some(t) = token {
            request = request.bearer_auth(t);
        }
        request.send()
    })
    .await
}

#[tauri::command]
pub async fn create_flashcard(
    state: State<'_, AppState>,
    request: Vec<ResponseFlashcard>,
) -> Result<ResponseOperation, String> {
    let url = format!("{}/question", &state.base_url);

    send_request::<ResponseOperation, _, _>(&state, AuthMode::Bearer, |client, token| {
        let mut request = client.post(&url).json(&request);
        if let Some(t) = token {
            request = request.bearer_auth(t);
        }
        request.send()
    })
    .await
}

#[tauri::command]
pub async fn submit_review(
    state: State<'_, AppState>,
    review: ResponseFlashcard,
) -> Result<ResponseOperation, String> {
    let url = format!("{}/question/review", &state.base_url);

    send_request::<ResponseOperation, _, _>(&state, AuthMode::Bearer, |client, token| {
        let mut request = client.post(&url).json(&review);
        if let Some(t) = token {
            request = request.bearer_auth(t);
        }
        request.send()
    })
    .await
}

#[tauri::command]
pub async fn get_flashcards_by_note_id(
    state: State<'_, AppState>,
    note_id: u64,
) -> Result<Vec<ResponseFlashcard>, String> {
    let url = format!("{}/question/flashcards", &state.base_url);
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
pub async fn delete_stale_flashcards(
    state: State<'_, AppState>,
    note_id: u64,
) -> Result<ResponseOperation, String> {
    let url = format!("{}/question/flashcards/stale", &state.base_url);
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
pub async fn delete_all_flashcards_by_note_id(
    state: State<'_, AppState>,
    note_id: u64,
) -> Result<ResponseOperation, String> {
    let url = format!("{}/question/flashcards", &state.base_url);
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
pub async fn delete_flashcards_except(
    state: State<'_, AppState>,
    ids: Vec<String>,
) -> Result<ResponseOperation, String> {
    let url = format!("{}/question/flashcards/except", state.base_url);

    let mut url = reqwest::Url::parse(&url).map_err(|e| e.to_string())?;
    {
        let mut query = url.query_pairs_mut();
        for id in &ids {
            query.append_pair("flashcardIds", &id.to_string());
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
pub async fn delete_flashcard(
    state: State<'_, AppState>,
    request: RequestDeleteFlashcard,
) -> Result<ResponseOperation, String> {
    let url = format!(
        "{}/question/flashcards/{}",
        &state.base_url, request.flashcard_id
    );

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
pub async fn save_local_flashcards(
    state: State<'_, AppState>,
    flashcards: Vec<ResponseFlashcard>,
    file_id: String,
) -> Result<(), String> {
    let _lock = &state.flashcard_mapping_lock.lock().await;
    let flashcards_path = &state
        .app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(get_flashcard_mapping(&state.app_handle, &file_id, _lock)?);

    if let Some(parent) = flashcards_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(&flashcards).map_err(|e| e.to_string())?;
    fs::write(&flashcards_path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_local_flashcards(
    state: State<'_, AppState>,
    file_id: String,
) -> Result<Option<Vec<ResponseFlashcard>>, String> {
    let _lock = &state.flashcard_mapping_lock.lock().await;
    let flashcards_path = &state
        .app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(get_flashcard_mapping(&state.app_handle, &file_id, _lock)?);

    if !flashcards_path.exists() {
        return Ok(None);
    }

    let text = fs::read_to_string(&flashcards_path).map_err(|e| e.to_string())?;
    let flashcards = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    Ok(Some(flashcards))
}

#[tauri::command]
pub async fn remove_local_flashcards(
    state: State<'_, AppState>,
    file_id: String,
) -> Result<(), String> {
    let _lock = &state.flashcard_mapping_lock.lock().await;
    let flashcards_path = &state
        .app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(get_flashcard_mapping(&state.app_handle, &file_id, _lock)?);

    if !flashcards_path.exists() {
        return Ok(());
    }

    fs::remove_file(&flashcards_path).map_err(|e| e.to_string())
}

fn remove_local_flashcards_internal(app: &AppHandle, filename: String) -> Result<(), String> {
    let flashcards_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(filename);

    if !flashcards_path.exists() {
        return Ok(());
    }

    fs::remove_file(flashcards_path).map_err(|e| e.to_string())
}

fn get_flashcard_mapping<T>(
    app: &AppHandle,
    file_id: &String,
    _lock: &T,
) -> Result<String, String> {
    let mappings_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("flashcard_mappings.json");

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
pub async fn save_review_queue(
    state: State<'_, AppState>,
    queue: HashMap<u64, CardReview>,
) -> Result<(), String> {
    let review_queue_path = &state
        .app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("flashcard_review_queue.json");

    if let Some(parent) = review_queue_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(&queue).map_err(|e| e.to_string())?;
    fs::write(&review_queue_path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_review_queue(
    state: State<'_, AppState>,
) -> Result<Option<HashMap<u64, CardReview>>, String> {
    let review_queue_path = &state
        .app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("flashcard_review_queue.json");

    if !review_queue_path.exists() {
        return Ok(None);
    }

    let text = fs::read_to_string(&review_queue_path).map_err(|e| e.to_string())?;
    let queue = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    Ok(Some(queue))
}

#[tauri::command]
pub async fn delete_local_flashcards(state: State<'_, AppState>) -> Result<(), String> {
    let _lock = &state.flashcard_mapping_lock.lock().await;
    let mappings_path = state
        .app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("flashcard_mappings.json");

    let mappings: HashMap<String, String> = if mappings_path.exists() {
        let text = fs::read_to_string(&mappings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&text).map_err(|e| e.to_string())?
    } else {
        return Ok(());
    };

    for (_, filename) in mappings {
        remove_local_flashcards_internal(&state.app_handle, filename)?;
    }

    fs::remove_file(&mappings_path).map_err(|e| e.to_string())
}
