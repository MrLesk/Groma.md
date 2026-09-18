use axum::Router;
use axum::routing::{any, get};

pub fn app() -> Router {
    Router::new()
        .route("/health", get(health))
        .nest("/api", talks())
        .merge(admin())
}

fn talks() -> Router {
    Router::new()
        .route("/talks", get(list_talks).post(create_talk))
        .route("/talks/:id", get(show_talk))
}

fn admin() -> Router {
    Router::new().route("/admin/{*path}", any(proxy))
}

/// A prefix the source does not state keeps its routes unreported.
pub fn mounted(prefix: &str) -> Router {
    Router::new().nest(prefix, secret())
}

fn secret() -> Router {
    Router::new().route("/secret", get(hidden))
}

pub fn dynamic(pattern: &str) -> Router {
    Router::new().route(pattern, get(computed))
}

fn health() {}
fn list_talks() {}
fn create_talk() {}
fn show_talk() {}
fn proxy() {}
fn hidden() {}
fn computed() {}
