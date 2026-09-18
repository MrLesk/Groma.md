use rocket::{Build, Rocket, get, routes};

/// A rank overrides Rocket's specificity, so this application's order is unknown.
#[get("/ranked/<id>", rank = 2)]
fn by_id(id: u32) -> &'static str {
    let _ = id;
    ""
}

#[get("/ranked/<name>")]
fn by_name(name: &str) -> &'static str {
    let _ = name;
    ""
}

pub fn ranked() -> Rocket<Build> {
    rocket::build().mount("/", routes![by_id, by_name])
}
