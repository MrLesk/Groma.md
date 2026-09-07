mod callbacks;
mod calls;
mod cargo;
mod index;
mod model;
mod modules;
mod resolve;
mod source;

use model::{Observation, Result};
use std::path::Path;

fn scan(root: &Path) -> Result<Option<Observation>> {
    let mut sources = source::Sources::open(root)?;
    let roots = sources.discover()?;
    if roots.is_empty() {
        return Ok(None);
    }
    let name = sources
        .root
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("repository name is not UTF-8")?
        .into();
    let mut observation = Observation::new(name, sources.relative(&roots[0])?);
    let targets = cargo::discover(&mut sources, &mut observation, &roots)?;
    let mut index = index::Index::new(targets);
    index.load(&mut sources, &mut observation)?;
    index.evidence(&mut observation);
    observation.finish(index.files);
    Ok(Some(observation))
}
fn main() {
    let arguments: Vec<_> = std::env::args_os().collect();
    if arguments.len() != 2 {
        eprintln!("usage: groma-rust-scanner REPOSITORY_ROOT");
        std::process::exit(2);
    }
    match scan(Path::new(&arguments[1])) {
        Ok(observation) => match serde_json::to_string(&observation) {
            Ok(json) => println!("{json}"),
            Err(error) => {
                eprintln!("{error}");
                std::process::exit(1);
            }
        },
        Err(error) => {
            eprintln!("Rust scan failed: {error}");
            std::process::exit(1);
        }
    }
}
