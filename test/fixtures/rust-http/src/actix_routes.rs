use actix_web::{App, HttpResponse, get, post, web};

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

pub fn server() -> App<()> {
    App::new()
        .service(web::scope("/api").service(list).service(create).configure(config))
        .service(web::resource("/stats").route(web::get().to(stats)))
}
