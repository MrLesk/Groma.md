mod scan;

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
    let input: scan::Input = serde_json::from_str(&input)?;
    let observation = scan::scan(input)?;
    println!("{}", serde_json::to_string(&observation)?);
    Ok(())
}
