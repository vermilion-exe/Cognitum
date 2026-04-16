use std::{collections::HashMap, fs};

use tauri::{Manager, State};

use crate::{
    entities::{
        card_review::CardReview, response_flashcard::ResponseFlashcard,
        response_operation::ResponseOperation,
    },
    utils::{send_request, AuthMode},
    AppState,
};

#[tauri::command]
pub async fn generate_flashcards(
    state: State<'_, AppState>,
    note_id: u64,
    count: u32,
) -> Result<Vec<ResponseFlashcard>, String> {
    let url = format!("{}/question/flashcards", &state.base_url);
    let params = [
        ("noteId", note_id.to_string()),
        ("count", count.to_string()),
    ];

    let url = reqwest::Url::parse_with_params(&url, &params).map_err(|e| e.to_string())?;

    send_request(&state, AuthMode::Bearer, |client, token| {
        let mut request = client.post(url.clone());
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
    flashcard_ids: Vec<u64>,
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
pub async fn get_due_cards(state: State<'_, AppState>) -> Result<Vec<ResponseFlashcard>, String> {
    let url = format!("{}/question/due", &state.base_url);

    send_request(&state, AuthMode::Bearer, |client, token| {
        let mut request = client.get(&url);
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
    note_id: u64,
) -> Result<Vec<u64>, String> {
    let url = format!("{}/question/relevance", &state.base_url);
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
    let params = [("note_id", note_id.to_string())];

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
) -> Result<(), String> {
    let url = format!("{}/question/flashcards/stale", &state.base_url);
    let params = [("note_id", note_id.to_string())];

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
) -> Result<(), String> {
    let url = format!("{}/question/flashcards", &state.base_url);
    let params = [("note_id", note_id.to_string())];

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
pub async fn delete_flashcard(state: State<'_, AppState>, flashcard_id: u64) -> Result<(), String> {
    let url = format!(
        "{}/question/flashcards/{}",
        &state.base_url,
        flashcard_id.to_string()
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
    note_id: u64,
) -> Result<(), String> {
    let flashcards_path = &state
        .app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(format!("flashcards_{}.json", note_id));

    if let Some(parent) = flashcards_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(&flashcards).map_err(|e| e.to_string())?;
    fs::write(&flashcards_path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_local_flashcards(
    state: State<'_, AppState>,
    note_id: u64,
) -> Result<Option<Vec<ResponseFlashcard>>, String> {
    let flashcards_path = &state
        .app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(format!("flashcards_{}.json", note_id));

    if !flashcards_path.exists() {
        return Ok(None);
    }

    let text = fs::read_to_string(&flashcards_path).map_err(|e| e.to_string())?;
    let flashcards = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    Ok(Some(flashcards))
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
