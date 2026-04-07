use crate::{
    commands::config::load_token, entities::request_note::RequestNote, utils::send_request,
};

#[tauri::command]
pub async fn get_notes() -> Result<Vec<RequestNote>, String> {
    let client = reqwest::Client::new();

    let token: String = load_token(false).map_err(|e| e.to_string())?;

    let response = client
        .post("http://localhost:8080/api/cognitum/summary/summarize")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    send_request::<Vec<RequestNote>>(response).await
}

#[tauri::command]
pub async fn create_note(request: RequestNote) -> Result<(), String> {
    let client = reqwest::Client::new();

    let token: String = load_token(false).map_err(|e| e.to_string())?;

    let response = client
        .post("http://localhost:8080/api/cognitum/summary/summarize")
        .header("Authorization", format!("Bearer {}", token))
        .json(&request)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    send_request(response).await
}
