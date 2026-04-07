use crate::{
    commands::config::load_token,
    entities::{request_summary::RequestSummary, response_summary::ResponseSummary},
    utils::send_request,
};

#[tauri::command]
pub async fn request_summary(request: RequestSummary) -> Result<ResponseSummary, String> {
    let client = reqwest::Client::new();

    let token: String = load_token(false).map_err(|e| e.to_string())?;

    let response = client
        .post("http://localhost:8080/api/cognitum/summary/summarize")
        .header("Authorization", format!("Bearer {}", token))
        .json(&request)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    send_request::<ResponseSummary>(response).await
}

#[tauri::command]
pub async fn get_summary_by_note_id(note_id: u64) -> Result<ResponseSummary, String> {
    let client = reqwest::Client::new();

    let token: String = load_token(false).map_err(|e| e.to_string())?;

    let url = "http://localhost:8080/api/cognitum/note/path";
    let params = [
        ("noteId", note_id.to_string())
    ];

    let url = reqwest::Url::parse_with_params(url, &params).map_err(|e| e.to_string())?;

    let response = client
        .post(url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    send_request::<ResponseSummary>(response).await
}


