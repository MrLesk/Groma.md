use reqwest::{Client, Method};

const BASE: &str = "/api";

pub struct Settings {
    pub base: String,
}

impl Settings {
    pub fn base(&self) -> &str {
        &self.base
    }
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

/// A value a method returns is computed, not a setting read from a field.
pub async fn method_base(client: &Client, settings: &Settings) -> reqwest::Result<String> {
    client.get(format!("{}/talks", settings.base())).send().await?.text().await
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

/// A client built by `Client::builder()` and unwrapped.
pub async fn built_client() -> reqwest::Result<String> {
    let client = Client::builder().build().unwrap();
    client.get("/api/talks").send().await?.text().await
}

/// A base the function receives is unknown.
pub async fn based(client: &Client, base: &str) -> reqwest::Result<String> {
    client.get(format!("{base}/talks")).send().await?.text().await
}

/// A base read from the environment is a setting.
pub async fn from_environment(client: &Client) -> reqwest::Result<String> {
    let base = std::env::var("API_BASE").unwrap_or_default();
    client.get(base + "/talks").send().await?.text().await
}

pub struct Outbox;

pub struct Letter;

impl Outbox {
    pub fn get(&self, _topic: &str) -> Letter {
        Letter
    }
}

impl Letter {
    pub fn send(self) {}
}

/// `get` and `send` on something other than a reqwest client are not a request.
pub fn notify(outbox: &Outbox) {
    outbox.get("/api/talks").send();
}

pub trait Caching {
    fn cache(&self) -> Outbox;
}

impl Caching for Client {
    fn cache(&self) -> Outbox {
        Outbox
    }
}

/// A value a client method returns is not the client.
pub fn cached_send(client: &Client) {
    client.cache().get("/api/talks").send();
}

/// This module's `Client` is its own type, whatever the file imports.
mod local {
    pub struct Client;

    impl Client {
        pub fn get(&self, _topic: &str) -> super::Letter {
            super::Letter
        }
    }

    pub fn deliver(client: &Client) {
        client.get("/api/talks").send();
    }
}
