use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::Path;

use anyhow::{Context, bail};
use ra_ap_hir::{AnyDiagnostic, AsAssocItem, CallableKind, Crate, Function, Semantics};
use ra_ap_ide_db::RootDatabase;
use ra_ap_syntax::{AstNode, SyntaxNode, TextSize, WalkEvent, ast, ast::{HasAttrs, HasName}};
use ra_ap_vfs::FileId;
use serde::Deserialize;
use serde_json::{Value, json};

use crate::text::{line, position};
use crate::url;
use crate::{endpoints, requests};
use crate::tokens::operation_tokens;

#[derive(Deserialize)]
pub struct Input {
    pub root: String,
    pub manifest: String,
    pub name: String,
    pub targets: Vec<String>,
    pub crates: Vec<Value>,
    pub executables: Vec<Executable>,
    /// Repository-relative Rust files the scanner's exclusions name. The scan reads none of them.
    pub excluded: HashSet<String>,
}

#[derive(Deserialize)]
pub struct Executable {
    pub file: String,
    pub declaration: String,
    pub name: String,
}

pub(crate) struct Source {
    pub(crate) file: String,
    pub(crate) text: String,
    pub(crate) syntax: ast::SourceFile,
}

pub fn scan(input: Input) -> anyhow::Result<Value> {
    // Supply a source crate graph directly; Cargo, rustc and build scripts are never invoked.
    let repository_root = std::fs::canonicalize(&input.root)?;
    let base = ra_ap_vfs::AbsPathBuf::assert_utf8(std::path::PathBuf::from(&input.root));
    let project = ra_ap_project_model::ProjectJson::new(None, &base,
        serde_json::from_value(json!({ "crates": input.crates }))?);
    let workspace = ra_ap_project_model::ProjectWorkspace {
        kind: ra_ap_project_model::ProjectWorkspaceKind::Json(project),
        sysroot: ra_ap_project_model::Sysroot::empty(),
        rustc_cfg: Vec::new(), toolchain: None,
        target_layout: Err("No target compiler is used for source scanning".into()),
        cfg_overrides: Default::default(), extra_includes: Vec::new(), set_test: false,
    };
    let load = ra_ap_load_cargo::LoadCargoConfig {
        load_out_dirs_from_check: false,
        with_proc_macro_server: ra_ap_load_cargo::ProcMacroServerChoice::None,
        prefill_caches: false,
    };
    let (db, vfs, _) =
        ra_ap_load_cargo::load_workspace(workspace, &Default::default(), &load)
            .context("rust-analyzer could not load the source crate graph")?;
    let sema = Semantics::new(&db);
    let selected: HashSet<_> = input.targets.iter().collect();
    let crates: Vec<_> = Crate::all(&db)
        .into_iter()
        .filter(|krate| selected.contains(&vfs.file_path(krate.root_file(&db)).to_string()))
        .collect();
    if crates.is_empty() {
        bail!("rust-analyzer loaded no selected library or binary targets");
    }
    let relative = |file: &str| -> anyhow::Result<String> {
        Ok(std::fs::canonicalize(file)?.strip_prefix(&repository_root)?.to_string_lossy().replace('\\', "/"))
    };
    let excluded = |file: FileId| {
        relative(&vfs.file_path(file).to_string()).is_ok_and(|path| input.excluded.contains(&path))
    };
    let mut physical = BTreeMap::<_, Vec<FileId>>::new();
    for file_id in selected_files(&crates, &sema, &db, &excluded)? {
        let path = std::fs::canonicalize(vfs.file_path(file_id).to_string())?;
        physical.entry(path).or_default().push(file_id);
    }
    let mut entry_points = Vec::new();
    for executable in &input.executables {
        let krate = crates.iter().find(|krate| vfs.file_path(krate.root_file(&db)).to_string() == executable.file);
        // An excluded root file declares no entry point: its file list would leave out the root itself, which the
        // evidence contract rejects.
        if let Some(krate) = krate && !excluded(krate.root_file(&db)) {
            let members = selected_files(&[*krate], &sema, &db, &excluded)?;
            let own_files: Vec<_> = members.into_iter()
                .map(|file| relative(&vfs.file_path(file).to_string())).collect::<anyhow::Result<_>>()?;
            entry_points.push(json!({"file": relative(&executable.file)?,
                "declaration": relative(&executable.declaration)?, "name": executable.name, "files": own_files}));
        }
    }
    let mut files = Vec::new();
    let mut sources = Vec::new();
    let mut diagnostics = vec![json!({
        "severity": "information", "code": "rust-analysis-scope",
        "message": "Declared default features and library/binary source only; external crates and standard library types remain unresolved. Build-script output, procedural macros, expanded calls, trait dispatch and callback value flow are not extracted."
    })];
    for (absolute, variants) in physical {
        let file = absolute
            .strip_prefix(&repository_root)
            .context("selected source is outside the repository")?
            .to_string_lossy()
            .replace('\\', "/");
        let contexts: usize = variants.iter().map(|id| sema.file_to_module_defs(*id).count()).sum();
        files.push(json!({"file": file, "symbols": []}));
        if contexts != 1 {
            diagnostics.push(json!({
                "severity": "warning", "code": "rust-unsupported-compilation-contexts",
                "file": file,
                "message": format!("{contexts} compilation contexts; declarations and calls are omitted. The physical source keeps one curated owner.")
            }));
            continue;
        }
        let file_id = variants[0];
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
    let constants = url::constants(sources.iter().map(|source| source.syntax.syntax().clone()));
    let http_endpoints = endpoints::endpoints(&sema, &constants, &sources, &functions);
    let http_requests = requests::requests(&sema, &constants, &sources, &functions);
    let scope = Path::new(&input.manifest)
        .strip_prefix(&input.root)
        .context("manifest is outside the repository")?
        .to_string_lossy()
        .replace('\\', "/");
    for file in &mut files {
        file["roots"] = json!([scope]);
    }
    Ok(json!({
        "schemaVersion": 1,
        "scanner": {"id": "rust", "technology": "rust", "engine": "rust-analyzer-hir", "engineVersion": "0.0.301"},
        "roots": [{"id": scope, "kind": "cargo", "name": input.name, "file": scope}],
        "files": files,
        "entryPoints": entry_points,
        "operations": operations, "invocations": invocations,
        "httpEndpoints": http_endpoints, "httpRequests": http_requests,
        "diagnostics": diagnostics,
    }))
}

/// Module files of these crates, less the files `excluded` names. The scan never reads an excluded file, so it
/// reports nothing, and a module it declares that cannot load does not fail the scan.
fn selected_files(
    crates: &[Crate],
    sema: &Semantics<'_, RootDatabase>,
    db: &RootDatabase,
    excluded: &dyn Fn(FileId) -> bool,
) -> anyhow::Result<Vec<FileId>> {
    let mut files = HashSet::new();
    for krate in crates {
        for module in krate.modules(db) {
            let file = sema.module_definition_node(module).file_id.file_id().map(|file| file.file_id(db));
            if file.is_some_and(excluded) {
                continue;
            }
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
            if let Some(file) = file {
                files.insert(file);
            }
        }
    }
    let mut selected: Vec<_> = files.into_iter().collect();
    selected.sort();
    Ok(selected)
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
            if disabled(sema, syntax.syntax()) { continue }
            let (Some(function), Some(name), Some(body)) =
                (sema.to_def(&syntax), syntax.name(), syntax.body())
            else {
                continue;
            };
            let start = first_token_start(syntax.syntax());
            let position = position(&source.text, start);
            let id = format!("{}:{position}", source.file);
            functions.insert(function, id.clone());
            // Every Rust operation is a named function; core applies the minimum compared sizes.
            operations.push(json!({
                "id": id, "file": source.file, "name": name.text().to_string(), "position": position,
                "startLine": line(&source.text, start),
                "endLine": line(&source.text, syntax.syntax().text_range().end()),
                "tokens": operation_tokens(sema, &syntax, &body),
            }));
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
            for node in call_nodes(body.syntax(), sema) {
                let target = call_target(&node, sema)
                    .filter(|function| {
                        function
                            .as_assoc_item(db)
                            .and_then(|item| item.container_or_implemented_trait(db))
                            .is_none()
                    })
                    .and_then(|function| functions.get(&function));
                let offset = position(&source.text, first_token_start(&node));
                let mut invocation = json!({
                    "source": caller, "targets": target.into_iter().collect::<Vec<_>>(),
                    "unresolved": target.is_none(),
                    "line": line(&source.text, node.text_range().start()), "position": offset,
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

/// Nodes of one function body, including its closures and async blocks: their code is part of
/// this function. Nested `fn` items are their own operations and are left out.
pub(crate) fn owned_nodes(body: &SyntaxNode, sema: &Semantics<'_, RootDatabase>) -> Vec<SyntaxNode> {
    let mut nodes = Vec::new();
    let mut walk = body.preorder();
    while let Some(event) = walk.next() {
        let WalkEvent::Enter(node) = event else { continue };
        if disabled(sema, &node) {
            walk.skip_subtree();
            continue;
        }
        if &node != body && ast::Fn::can_cast(node.kind()) {
            walk.skip_subtree();
            continue;
        }
        nodes.push(node);
    }
    nodes
}

/// Call nodes of one function body. Unlike the nodes the body owns, a closure or async block
/// is skipped here: this scan does not extract the calls those deferred bodies make.
fn call_nodes(body: &SyntaxNode, sema: &Semantics<'_, RootDatabase>) -> Vec<SyntaxNode> {
    let mut nodes = Vec::new();
    let mut walk = body.preorder();
    while let Some(event) = walk.next() {
        let WalkEvent::Enter(node) = event else {
            continue;
        };
        if disabled(sema, &node) {
            walk.skip_subtree();
            continue;
        }
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

/// Only source active in the selected Cargo feature context contributes evidence.
pub(crate) fn disabled(sema: &Semantics<'_, RootDatabase>, node: &SyntaxNode) -> bool {
    let Some(item) = ast::AnyHasAttrs::cast(node.clone()) else { return false };
    item.attrs().any(|attr| {
        let Some(path) = attr.path() else { return false };
        let name = path.syntax().text().to_string();
        name == "test" || (name == "cfg" && attr.token_tree()
            .and_then(|tree| sema.check_cfg_attr(&tree)) == Some(false))
    })
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

/// Start of the first token that is not whitespace or a comment.
fn first_token_start(syntax: &SyntaxNode) -> TextSize {
    syntax
        .descendants_with_tokens()
        .filter_map(|element| element.into_token())
        .find(|token| !token.kind().is_trivia())
        .map_or(syntax.text_range().start(), |token| {
            token.text_range().start()
        })
}
