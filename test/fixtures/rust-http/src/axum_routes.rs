use axum::Router;
use axum::routing::{any, get};

/// The router this binary serves; `serve` puts it at the root.
pub async fn run(listener: tokio::net::TcpListener) {
    let app = app();
    axum::serve(listener, app.into_make_service()).await.unwrap();
}

fn app() -> Router {
    let docs = Router::new().route("/docs", get(docs_page));
    Router::new()
        .route("/health", get(health))
        .nest("/api", talks())
        .merge(admin())
        .merge(versioned())
        .merge(mounted("/hidden"))
        .merge(dynamic("/computed"))
        // A router passed to a helper may be nested anywhere, so its routes are unreported.
        .merge(with_prefix(Router::new().route("/wrapped", get(wrapped))))
        .merge(with_prefix(docs))
        .merge(with_extra(Router::new()))
        .merge(reassigned())
        .merge(collected())
        .merge(twice())
        // A `Router` parameter carries no prefix of its own.
        .nest("/p", add(Router::new()))
        // A router passed to a method that is not a router registration is unreported too.
        .nest_service("/assets", Router::new().route("/logo", get(logo)))
}

/// A `mut` binding may be reassigned to any router.
fn with_extra(mut router: Router) -> Router {
    router = router.route("/extra", get(extra));
    Router::new().nest("/extended", router)
}

/// A router kept in an array and nested in a loop may be served under any prefix.
fn collected() -> Router {
    let routers = [Router::new().route("/listed", get(listed))];
    let mut app = Router::new();
    for router in routers {
        app = app.nest("/v1", router);
    }
    app
}

/// A router used twice may be served under either prefix.
fn twice() -> Router {
    let shared = Router::new().route("/shared", get(shared_page));
    let copy = shared.clone();
    Router::new().nest("/a", shared).nest("/b", copy)
}

fn add(router: Router) -> Router {
    router.route("/added", get(added))
}

fn reassigned() -> Router {
    let mut api = Router::new();
    api = Router::new().route("/fresh", get(fresh));
    Router::new().nest("/replaced", api)
}

fn with_prefix(router: Router) -> Router {
    Router::new().nest("/prefixed", router)
}

/// A router bound to a local keeps the prefix it is nested under.
fn versioned() -> Router {
    let items = Router::new().route("/items", get(list_items));
    Router::new().nest("/v2", items)
}

/// Nothing serves this router, so its routes are unreported.
fn unused() -> Router {
    Router::new().route("/unused", get(legacy))
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
fn mounted(prefix: &str) -> Router {
    Router::new().nest(prefix, secret())
}

fn secret() -> Router {
    Router::new().route("/secret", get(hidden))
}

fn dynamic(pattern: &str) -> Router {
    Router::new().route(pattern, get(computed))
}

fn health() {}
fn list_talks() {}
fn create_talk() {}
fn show_talk() {}
fn proxy() {}
fn hidden() {}
fn computed() {}
fn list_items() {}
fn legacy() {}
fn docs_page() {}
fn wrapped() {}
fn extra() {}
fn fresh() {}
fn logo() {}
fn listed() {}
fn shared_page() {}
fn added() {}
