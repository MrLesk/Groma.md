use std::collections::{HashMap, HashSet};
use std::path::Path;

use anyhow::{Context, bail};
use ra_ap_hir::{AnyDiagnostic, AsAssocItem, CallableKind, Crate, Function, Semantics};
use ra_ap_ide_db::RootDatabase;
use ra_ap_syntax::{AstNode, SyntaxNode, WalkEvent, ast, ast::HasName};
use ra_ap_vfs::FileId;
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Deserialize)]
pub struct Input {
    pub root: String,
    pub manifest: String,
    pub name: String,
    pub targets: Vec<String>,
}

struct Source {
    file: String,
    text: String,
    syntax: ast::SourceFile,
}

pub fn scan(input: Input) -> anyhow::Result<Value> {
    let config = ra_ap_project_model::CargoConfig {
        set_test: false,
        all_targets: false,
        sysroot: Some(ra_ap_project_model::RustLibSource::Discover),
        extra_args: vec!["--offline".into(), "--locked".into()],
        ..Default::default()
    };
    let load = ra_ap_load_cargo::LoadCargoConfig {
        load_out_dirs_from_check: false,
        with_proc_macro_server: ra_ap_load_cargo::ProcMacroServerChoice::None,
        prefill_caches: false,
    };
    let (db, vfs, _) =
        ra_ap_load_cargo::load_workspace_at(Path::new(&input.manifest), &config, &load, &|_| {})
            .context("rust-analyzer could not load the prepared Cargo project")?;
    let sema = Semantics::new(&db);
    let selected: HashSet<_> = input.targets.iter().collect();
    let crates: Vec<_> = Crate::all(&db)
        .into_iter()
        .filter(|krate| selected.contains(&vfs.file_path(krate.root_file(&db)).to_string()))
        .collect();
    if crates.is_empty() {
        bail!("rust-analyzer loaded no selected library or binary targets");
    }
    let file_ids = selected_files(&crates, &sema, &db)?;
    let mut files = Vec::new();
    let mut sources = Vec::new();
    let mut diagnostics = vec![json!({
        "severity": "information", "code": "rust-analysis-scope",
        "message": "Default Cargo features, host target, library/binary source only. Build-script output, procedural macros, expanded calls, trait dispatch and callback value flow are not extracted."
    })];
    for file_id in file_ids {
        let absolute = vfs.file_path(file_id).to_string();
        let file = Path::new(&absolute)
            .strip_prefix(&input.root)
            .context("selected source is outside the repository")?
            .to_string_lossy()
            .replace('\\', "/");
        let contexts = sema.file_to_module_defs(file_id).count();
        files.push(json!({"file": file, "symbols": []}));
        if contexts != 1 {
            diagnostics.push(json!({
                "severity": "warning", "code": "rust-unsupported-compilation-contexts",
                "message": format!("{file}: {contexts} compilation contexts; declarations and calls are omitted. The physical source keeps one curated owner.")
            }));
            continue;
        }
        let text = std::fs::read_to_string(&absolute)?;
        let edition = sema
            .file_to_module_defs(file_id)
            .next()
            .unwrap()
            .krate()
            .edition(&db);
        let parsed = ast::SourceFile::parse(&text, edition);
        if !parsed.errors().is_empty() {
            bail!("{file}: invalid Rust syntax: {:?}", parsed.errors());
        }
        let syntax = sema.parse_guess_edition(file_id);
        sources.push(Source { file, text, syntax });
    }
    sources.sort_by(|a, b| a.file.cmp(&b.file));
    let (operations, functions) = declarations(&sources, &sema);
    for file in &mut files {
        file["symbols"] = Value::Array(
            operations
                .iter()
                .filter(|op| op["file"] == file["file"])
                .map(|op| json!({"id": op["id"], "name": op["name"], "kind": "function"}))
                .collect(),
        );
    }
    let invocations = calls(&sources, &sema, &db, &functions);
    let scope = input
        .manifest
        .strip_prefix(&format!("{}/", input.root))
        .context("manifest is outside the repository")?
        .replace('\\', "/");
    let placements: Vec<_> = files
        .iter()
        .map(|file| json!({"file": file["file"], "scope": scope}))
        .collect();
    Ok(json!({
        "schemaVersion": 1, "complete": true,
        "scanner": {"language": "rust", "engine": "rust-analyzer-hir", "engineVersion": "0.0.301"},
        "root": {"kind": "cargo", "name": input.name, "file": scope},
        "scopes": [{"id": scope, "name": input.name}],
        "files": files, "placements": placements, "relationships": [],
        "operations": operations, "invocations": invocations, "diagnostics": diagnostics,
    }))
}

fn selected_files(
    crates: &[Crate],
    sema: &Semantics<'_, RootDatabase>,
    db: &RootDatabase,
) -> anyhow::Result<Vec<FileId>> {
    let mut files = HashSet::new();
    for krate in crates {
        for module in krate.modules(db) {
            let mut diagnostics = Vec::new();
            module.diagnostics(db, &mut diagnostics, false);
            for diagnostic in diagnostics {
                if let AnyDiagnostic::UnresolvedModule(missing) = diagnostic {
                    bail!(
                        "rust-analyzer could not load module {:?}; unsupported module loading prevents a complete observation",
                        missing.candidates
                    );
                }
            }
            if let Some(file) = sema.module_definition_node(module).file_id.file_id() {
                files.insert(file.file_id(db));
            }
        }
    }
    Ok(files.into_iter().collect())
}

fn declarations(
    sources: &[Source],
    sema: &Semantics<'_, RootDatabase>,
) -> (Vec<Value>, HashMap<Function, String>) {
    let mut operations = Vec::new();
    let mut functions = HashMap::new();
    for source in sources {
        for syntax in source
            .syntax
            .syntax()
            .descendants()
            .filter_map(ast::Fn::cast)
        {
            let (Some(function), Some(name), Some(_)) =
                (sema.to_def(&syntax), syntax.name(), syntax.body())
            else {
                continue;
            };
            let position = position(&source.text, syntax.syntax());
            let id = format!("{}:{position}", source.file);
            functions.insert(function, id.clone());
            operations.push(json!({"id": id, "file": source.file, "name": name.text().to_string(), "position": position}));
        }
    }
    (operations, functions)
}

fn calls(
    sources: &[Source],
    sema: &Semantics<'_, RootDatabase>,
    db: &RootDatabase,
    functions: &HashMap<Function, String>,
) -> Vec<Value> {
    let mut invocations = Vec::new();
    for source in sources {
        for syntax in source
            .syntax
            .syntax()
            .descendants()
            .filter_map(ast::Fn::cast)
        {
            let Some(function) = sema.to_def(&syntax) else {
                continue;
            };
            let Some(caller) = functions.get(&function) else {
                continue;
            };
            let Some(body) = syntax.body() else { continue };
            for node in call_nodes(body.syntax()) {
                let target = call_target(&node, sema)
                    .filter(|function| {
                        function
                            .as_assoc_item(db)
                            .and_then(|item| item.container_or_implemented_trait(db))
                            .is_none()
                    })
                    .and_then(|function| functions.get(&function));
                let offset = position(&source.text, &node);
                let line = source.text[..usize::from(node.text_range().start())]
                    .bytes()
                    .filter(|byte| *byte == b'\n')
                    .count()
                    + 1;
                let mut invocation = json!({
                    "source": caller, "targets": target.into_iter().collect::<Vec<_>>(),
                    "unresolved": target.is_none(), "line": line, "position": offset,
                });
                if let Some(name) =
                    ast::MethodCallExpr::cast(node.clone()).and_then(|call| call.name_ref())
                {
                    invocation["member"] = json!(name.text().to_string());
                }
                invocations.push(invocation);
            }
        }
    }
    invocations
}

fn call_nodes(body: &SyntaxNode) -> Vec<SyntaxNode> {
    let mut nodes = Vec::new();
    let mut walk = body.preorder();
    while let Some(event) = walk.next() {
        let WalkEvent::Enter(node) = event else {
            continue;
        };
        if &node != body
            && (ast::Fn::can_cast(node.kind())
                || ast::ClosureExpr::can_cast(node.kind())
                || ast::BlockExpr::cast(node.clone())
                    .is_some_and(|block| block.async_token().is_some()))
        {
            walk.skip_subtree();
        } else if ast::CallExpr::can_cast(node.kind()) || ast::MethodCallExpr::can_cast(node.kind())
        {
            nodes.push(node);
        }
    }
    nodes
}

fn call_target(node: &SyntaxNode, sema: &Semantics<'_, RootDatabase>) -> Option<Function> {
    if let Some(call) = ast::MethodCallExpr::cast(node.clone()) {
        return sema.resolve_method_call(&call);
    }
    let call = ast::CallExpr::cast(node.clone())?;
    match sema.resolve_expr_as_callable(&call.expr()?)?.kind() {
        CallableKind::Function(function) => Some(function),
        _ => None,
    }
}

fn position(text: &str, syntax: &SyntaxNode) -> usize {
    let offset = syntax
        .descendants_with_tokens()
        .filter_map(|element| element.into_token())
        .find(|token| !token.kind().is_trivia())
        .map_or(syntax.text_range().start(), |token| {
            token.text_range().start()
        });
    text[..usize::from(offset)].encode_utf16().count()
}
