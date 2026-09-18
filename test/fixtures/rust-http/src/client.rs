use reqwest::{Client, Method};

const BASE: &str = "/api";

pub struct Settings {
    pub base: String,
}

pub async fn list_talks(client: &Client) -> reqwest::Result<String> {
    client.get(format!("{BASE}/talks")).send().await?.text().await
}

pub async fn show_talk(client: &Client, id: u32) -> reqwest::Result<String> {
    client.get(format!("{BASE}/talks/{id}")).send().await?.text().await
}

pub async fn create_talk(client: &Client, body: String) -> reqwest::Result<String> {
    client.post("/api/talks").body(body).send().await?.text().await
}

pub async fn remove_talk(client: &Client, id: u32) -> reqwest::Result<String> {
    client.request(Method::DELETE, format!("/api/talks/{id}")).send().await?.text().await
}

pub async fn speakers(client: &Client, settings: &Settings) -> reqwest::Result<String> {
    client.get(format!("{}/speakers", settings.base)).send().await?.text().await
}

pub async fn external(client: &Client) -> reqwest::Result<String> {
    client.get("https://api.example.com/talks").send().await?.text().await
}

pub async fn partial(client: &Client, slug: &str) -> reqwest::Result<String> {
    client.get(format!("/api/talks/{slug}-latest")).send().await?.text().await
}

/// The path reaches the client as a value the scanner cannot see.
pub async fn through_helper(client: &Client, path: &str) -> reqwest::Result<String> {
    client.get(format!("{BASE}{path}")).send().await?.text().await
}

/// The header value is an argument, so its `get` is not a request of its own.
pub async fn forwarded(client: &Client, tokens: &std::collections::HashMap<String, String>) -> reqwest::Result<String> {
    client
        .post("/api/talks")
        .header("x-token", tokens.get("talks").cloned().unwrap_or_default())
        .send()
        .await?
        .text()
        .await
}

pub fn built(body: String) -> hyper::Request<String> {
    hyper::Request::builder().method("PUT").uri("/api/talks/42").body(body).unwrap()
}

pub fn cached(entries: &std::collections::HashMap<String, String>) -> Option<&String> {
    entries.get("talks")
}
