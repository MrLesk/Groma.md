use rocket::{Build, Rocket, get, post, routes};

#[get("/speakers")]
fn index() -> &'static str {
    ""
}

#[get("/speakers/<id>")]
fn detail(id: u32) -> &'static str {
    let _ = id;
    ""
}

#[post("/speakers/<id>/photos/<rest..>")]
fn upload(id: u32, rest: std::path::PathBuf) -> &'static str {
    let _ = (id, rest);
    ""
}

#[get("/speakers/<slug>/bio")]
fn bio(slug: &str) -> &'static str {
    let _ = slug;
    ""
}

pub fn build() -> Rocket<Build> {
    rocket::build().mount("/v1", routes![index, detail, upload, bio])
}
