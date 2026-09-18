use actix_web::{HttpResponse, get, web};

#[get("/reports")]
async fn reports() -> HttpResponse {
    HttpResponse::Ok().finish()
}

/// The application that configures these routes is created in another file.
pub fn routes(services: &mut web::ServiceConfig) {
    services.service(reports);
}
