use reqwest::Client;

use crate::entities::request_auth::RequestAuth;
use crate::entities::request_register::RequestRegister;
use crate::entities::response_auth::ResponseAuth;
use crate::utils::send_request;

#[tauri::command]
pub async fn request_register(request: RequestRegister) -> Result<ResponseAuth, String> {
    let client = Client::new();

    let response = client
        .post("http://localhost:8080/api/cognitum/auth/register")
        .json(&request)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    send_request::<ResponseAuth>(response).await
}

#[tauri::command]
pub async fn request_auth(request: RequestAuth) -> Result<ResponseAuth, String> {
    let client = Client::new();

    let response = client
        .post("http://localhost:8080/api/cognitum/auth/authenticate")
        .json(&request)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    send_request::<ResponseAuth>(response).await
}
