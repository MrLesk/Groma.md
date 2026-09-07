use crate::{
    model::{Observation, Result, Scope},
    source::Sources,
};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::{Path, PathBuf},
};
use toml::Value;

#[derive(Clone)]
pub struct Target {
    pub id: String,
    pub scope: String,
    pub file: PathBuf,
    pub name: String,
    pub library: bool,
    pub uncertain: bool,
    pub dependencies: BTreeMap<String, (String, bool)>,
}
struct Package {
    manifest: PathBuf,
    scope: String,
    value: Value,
    workspace: Value,
    workspace_dir: PathBuf,
}
fn table<'a>(value: &'a Value, name: &str) -> Option<&'a toml::map::Map<String, Value>> {
    value.get(name).and_then(Value::as_table)
}
fn text<'a>(value: &'a Value, name: &str) -> Option<&'a str> {
    value.get(name).and_then(Value::as_str)
}
fn strings(value: Option<&Value>) -> Result<Vec<String>> {
    match value {
        None => Ok(vec![]),
        Some(Value::Array(items)) => items
            .iter()
            .map(|item| {
                item.as_str()
                    .map(str::to_owned)
                    .ok_or_else(|| "expected a string array".into())
            })
            .collect(),
        _ => Err("expected a string array".into()),
    }
}
fn read_manifest(sources: &mut Sources, file: &Path) -> Result<Value> {
    let text = sources.read(file)?;
    toml::from_str(&text)
        .map_err(|e| format!("{}: {e}", sources.relative(file).unwrap_or_default()))
}
fn workspace_members(
    sources: &mut Sources,
    file: &Path,
    value: &Value,
) -> Result<BTreeSet<PathBuf>> {
    let base = file.parent().ok_or("manifest has no parent")?;
    let mut members = BTreeSet::new();
    if value.get("package").is_some() {
        members.insert(file.to_owned());
    }
    let workspace = value.get("workspace");
    let exclusions = strings(workspace.and_then(|w| w.get("exclude")))?
        .iter()
        .map(|s| glob::Pattern::new(s).map_err(|e| e.to_string()))
        .collect::<Result<Vec<_>>>()?;
    for member in strings(workspace.and_then(|w| w.get("members")))? {
        let pattern = base
            .join(member)
            .to_str()
            .ok_or("non-UTF-8 member path")?
            .to_owned();
        for entry in glob::glob(&pattern).map_err(|e| e.to_string())? {
            let path = entry.map_err(|e| e.to_string())?;
            let relative = path.strip_prefix(base).map_err(|e| e.to_string())?;
            if exclusions
                .iter()
                .any(|pattern| pattern.matches_path(relative))
            {
                continue;
            }
            members.insert(sources.checked(&path.join("Cargo.toml"))?);
            if members.len() > sources.config.max_files {
                return Err("workspace member budget exceeded".into());
            }
        }
    }
    if members.is_empty() {
        return Err(format!(
            "no packages selected by {}",
            sources.relative(file)?
        ));
    }
    Ok(members)
}
fn packages(sources: &mut Sources, roots: &[PathBuf]) -> Result<Vec<Package>> {
    let mut packages = BTreeMap::new();
    for root in roots {
        let value = read_manifest(sources, root)?;
        let workspace = value
            .get("workspace")
            .cloned()
            .unwrap_or(Value::Table(Default::default()));
        for manifest in workspace_members(sources, root, &value)? {
            let package_value = if manifest == *root {
                value.clone()
            } else {
                read_manifest(sources, &manifest)?
            };
            if package_value.get("package").is_none() {
                return Err(format!(
                    "workspace member has no package: {}",
                    sources.relative(&manifest)?
                ));
            }
            let scope = format!("cargo:{}", sources.relative(&manifest)?);
            packages.entry(manifest.clone()).or_insert(Package {
                manifest,
                scope,
                value: package_value,
                workspace: workspace.clone(),
                workspace_dir: root.parent().ok_or("manifest has no parent")?.to_owned(),
            });
        }
    }
    Ok(packages.into_values().collect())
}
fn edition(package: &Package) -> &str {
    let value = &package.value["package"];
    text(value, "edition")
        .or_else(|| {
            if value
                .get("edition")
                .and_then(|e| e.get("workspace"))
                .and_then(Value::as_bool)
                == Some(true)
            {
                package
                    .workspace
                    .get("package")
                    .and_then(|p| text(p, "edition"))
            } else {
                None
            }
        })
        .unwrap_or("2015")
}
fn add_target(
    sources: &Sources,
    package: &Package,
    targets: &mut Vec<Target>,
    name: String,
    file: PathBuf,
    library: bool,
    conditional: bool,
) -> Result<()> {
    let file = sources.checked(&file)?;
    if targets.iter().any(|target| {
        target.scope == package.scope
            && target.name == name.replace('-', "_")
            && target.library == library
    }) {
        return Ok(());
    }
    let kind = if library { "lib" } else { "bin" };
    targets.push(Target {
        id: format!("{}:{kind}:{name}", package.scope),
        scope: package.scope.clone(),
        file,
        name: name.replace('-', "_"),
        library,
        uncertain: conditional || !matches!(edition(package), "2018" | "2021" | "2024"),
        dependencies: BTreeMap::new(),
    });
    Ok(())
}
fn targets(sources: &mut Sources, package: &Package) -> Result<Vec<Target>> {
    let mut targets = vec![];
    if !matches!(edition(package), "2018" | "2021" | "2024") {
        return Err(format!(
            "unsupported or unresolved Rust edition {} in {}; select a workspace root for inherited editions",
            edition(package),
            package.scope
        ));
    }
    let base = package.manifest.parent().ok_or("manifest has no parent")?;
    let name = text(&package.value["package"], "name").ok_or("package.name missing")?;
    let lib = package.value.get("lib");
    if lib.is_some() || base.join("src/lib.rs").is_file() {
        add_target(
            sources,
            package,
            &mut targets,
            lib.and_then(|l| text(l, "name")).unwrap_or(name).into(),
            base.join(lib.and_then(|l| text(l, "path")).unwrap_or("src/lib.rs")),
            true,
            false,
        )?;
    }
    if let Some(bins) = package.value.get("bin").and_then(Value::as_array) {
        for bin in bins {
            let bin_name = text(bin, "name").unwrap_or(name);
            let file = match text(bin, "path") {
                Some(path) => base.join(path),
                None if bin_name == name && base.join("src/main.rs").is_file() => {
                    base.join("src/main.rs")
                }
                None => base.join(format!("src/bin/{bin_name}.rs")),
            };
            add_target(
                sources,
                package,
                &mut targets,
                bin_name.into(),
                file,
                false,
                bin.get("required-features").is_some(),
            )?;
        }
    }
    if package.value["package"]
        .get("autobins")
        .and_then(Value::as_bool)
        != Some(false)
    {
        if base.join("src/main.rs").is_file() {
            add_target(
                sources,
                package,
                &mut targets,
                name.into(),
                base.join("src/main.rs"),
                false,
                false,
            )?;
        }
        if base.join("src/bin").is_dir() {
            for file in sources.directory(&base.join("src/bin"))? {
                let source = if file.is_dir() {
                    file.join("main.rs")
                } else {
                    file.clone()
                };
                if source.extension().and_then(|s| s.to_str()) != Some("rs") || !source.is_file() {
                    continue;
                }
                let name = file
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .ok_or("non-UTF-8 target")?;
                add_target(
                    sources,
                    package,
                    &mut targets,
                    name.into(),
                    source,
                    false,
                    false,
                )?;
            }
        }
    }
    Ok(targets)
}
fn add_dependencies(
    sources: &Sources,
    package: &Package,
    deps: &toml::map::Map<String, Value>,
    conditional: bool,
    output: &mut BTreeMap<String, (String, bool)>,
) -> Result<()> {
    for (alias, dependency) in deps {
        let inherited = dependency.get("workspace").and_then(Value::as_bool) == Some(true);
        let spec = if inherited {
            package
                .workspace
                .get("dependencies")
                .and_then(|d| d.get(alias))
                .unwrap_or(dependency)
        } else {
            dependency
        };
        let Some(path) = text(spec, "path") else {
            continue;
        };
        let base = if inherited {
            &package.workspace_dir
        } else {
            package.manifest.parent().ok_or("manifest has no parent")?
        };
        let candidate = base.join(path).join("Cargo.toml");
        // An external path dependency is not part of this observation's source set.
        let Ok(manifest) = candidate.canonicalize() else {
            continue;
        };
        if !manifest.starts_with(&sources.root) {
            continue;
        }
        let scope = format!("cargo:{}", sources.relative(&manifest)?);
        let uncertain = conditional
            || spec.get("optional").and_then(Value::as_bool) == Some(true)
            || dependency.get("optional").and_then(Value::as_bool) == Some(true);
        let key = alias.replace('-', "_");
        match output.get_mut(&key) {
            Some((old_scope, unknown)) => {
                *unknown = true;
                if *old_scope != scope {
                    *old_scope = String::new();
                }
            }
            None => {
                output.insert(key, (scope, uncertain));
            }
        }
    }
    Ok(())
}
pub fn discover(
    sources: &mut Sources,
    observation: &mut Observation,
    roots: &[PathBuf],
) -> Result<Vec<Target>> {
    let packages = packages(sources, roots)?;
    let mut output = vec![];
    for package in &packages {
        let name = text(&package.value["package"], "name").ok_or("package.name missing")?;
        observation.scopes.push(Scope {
            id: package.scope.clone(),
            name: name.into(),
        });
        let mut selected = targets(sources, package)?;
        if selected.is_empty() {
            observation.diagnostic(
                "RUST_NO_TARGETS",
                format!("{} has no selected library or binary", package.scope),
            );
        }
        let mut dependencies = BTreeMap::new();
        if let Some(deps) = table(&package.value, "dependencies") {
            add_dependencies(sources, package, deps, false, &mut dependencies)?;
        }
        if let Some(platforms) = table(&package.value, "target") {
            for platform in platforms.values() {
                if let Some(deps) = table(platform, "dependencies") {
                    add_dependencies(sources, package, deps, true, &mut dependencies)?;
                }
            }
        }
        for target in &mut selected {
            target.dependencies = dependencies.clone();
        }
        output.extend(selected);
    }
    output.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(output)
}
