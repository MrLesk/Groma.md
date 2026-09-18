use actix_web::{App, HttpResponse, Resource, Scope, get, post, web};

#[get("/sessions")]
async fn list() -> HttpResponse {
    HttpResponse::Ok().finish()
}

#[post("/sessions")]
async fn create() -> HttpResponse {
    HttpResponse::Ok().finish()
}

#[get("/sessions/{id}")]
async fn show(id: web::Path<u32>) -> HttpResponse {
    let _ = id;
    HttpResponse::Ok().finish()
}

async fn stats() -> HttpResponse {
    HttpResponse::Ok().finish()
}

/// Declared but never registered, so its served path is unknown.
#[get("/hidden")]
async fn hidden() -> HttpResponse {
    HttpResponse::Ok().finish()
}

pub fn config(services: &mut web::ServiceConfig) {
    services.service(show);
}

#[get("/v{version}/info")]
async fn info() -> HttpResponse {
    HttpResponse::Ok().finish()
}

#[get("/files/{tail:.*}")]
async fn files() -> HttpResponse {
    HttpResponse::Ok().finish()
}

async fn tag() -> HttpResponse {
    HttpResponse::Ok().finish()
}

#[get("/detail")]
async fn scoped_detail() -> HttpResponse {
    HttpResponse::Ok().finish()
}

/// The scope arrives with a prefix this function cannot see.
fn add(scope: Scope) -> Scope {
    scope.service(scoped_detail)
}

async fn old() -> HttpResponse {
    HttpResponse::Ok().finish()
}

/// A resource that takes every method comes before the route after it.
fn legacy() -> Resource {
    web::resource("/archive/{id}").to(old)
}

#[get("/archive/latest")]
async fn latest() -> HttpResponse {
    HttpResponse::Ok().finish()
}

#[get("/summary")]
async fn summary() -> HttpResponse {
    HttpResponse::Ok().finish()
}

#[get("/status")]
async fn status() -> HttpResponse {
    HttpResponse::Ok().finish()
}

fn internal_api() -> Scope {
    web::scope("/api")
}

#[get("/relocated")]
async fn relocated() -> HttpResponse {
    HttpResponse::Ok().finish()
}

pub fn server() -> App<()> {
    // A receiver bound by `let` keeps its scope's path; a `mut` one may have been replaced.
    let local = web::scope("/local");
    let mut moved = web::scope("/before");
    moved = web::scope("/after");
    App::new()
        .service(web::scope("/api").service(list).service(create).configure(config))
        .service(web::resource("/stats").route(web::get().to(stats)))
        .configure(crate::actix_reports::routes)
        .service(info)
        .service(files)
        .service(web::resource(r"/tags/{id:\d+}").route(web::get().to(tag)))
        // Entries this scan cannot read still take their place in the first-match order.
        .service(web::scope("/admin/assets").service(actix_files::Files::new("/", ".")))
        .service(web::resource("/health/ping").route(web::get().to(|| async { HttpResponse::Ok().finish() })))
        .service(web::resource("/downloads/{tail:.*}").route(web::get().to(|| async { HttpResponse::Ok().finish() })))
        .service(web::scope("/legacy/api").service(add(web::scope("/v1"))))
        .service(legacy())
        .service(latest)
        .service(local.service(summary))
        // A scope another function returns carries a prefix this call cannot see.
        .service(web::scope("/internal").service(internal_api().service(status)))
        .service(web::scope("/relocation").service(moved.service(relocated)))
}
