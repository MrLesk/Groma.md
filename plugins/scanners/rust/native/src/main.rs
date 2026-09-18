mod client;
mod endpoints;
mod handlers;
mod outline;
mod patterns;
mod placement;
mod requests;
mod scan;
mod text;
mod url;
mod tokens;

use std::io::Read;

fn main() {
    if let Err(error) = run() {
        eprintln!("RUST_ANALYSIS_FAILED: {error:#}");
        std::process::exit(1);
    }
}

fn run() -> anyhow::Result<()> {
    let mut input = String::new();
    std::io::stdin().read_to_string(&mut input)?;
    // `outline` lists the declarations of Code files; otherwise the input selects a Cargo project to scan.
    let output = if std::env::args().nth(1).as_deref() == Some("outline") {
        outline::outline(serde_json::from_str(&input)?)?
    } else {
        scan::scan(serde_json::from_str(&input)?)?
    };
    println!("{}", serde_json::to_string(&output)?);
    Ok(())
}
