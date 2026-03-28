use reqwest::Response;
use serde::Deserialize;

pub async fn send_request<T: for<'de> Deserialize<'de>>(response: Response) -> Result<T, String> {
    let status = response.status();
    let text = response.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        let err = format!("Request failed with status {}: {}", status, text);
        eprintln!("{}", err);
        return Err(err);
    }

    serde_json::from_str::<T>(&text).map_err(|e| {
        let err = format!("Decode error: {} | Body was: {}", e, text);
        eprintln!("{}", err);
        err
    })
}
