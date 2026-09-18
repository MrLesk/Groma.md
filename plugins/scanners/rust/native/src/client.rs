use ra_ap_hir::{FieldSource, HasSource, ModuleDef, PathResolution, Semantics};
use ra_ap_ide_db::RootDatabase;
use ra_ap_syntax::ast::{self, HasModuleItem, HasName};
use ra_ap_syntax::{AstNode, SyntaxNode};

use crate::text::callee;

/// Whether a call is made on a reqwest client: a value whose declared type is `reqwest::Client`,
/// a `Client::new()` or `Client::default()`, a `Client::builder()` chain's `build()` with `?`,
/// `unwrap()` or `expect(..)`, or a clone of one. External crates stay unresolved, so the type is
/// read from its declaration: a parameter, a `let`, a static or a struct field.
pub fn is_client(sema: &Semantics<'_, RootDatabase>, value: &ast::Expr) -> bool {
    let inner = |value: Option<ast::Expr>| value.is_some_and(|value| is_client(sema, &value));
    match value {
        ast::Expr::RefExpr(reference) => inner(reference.expr()),
        ast::Expr::ParenExpr(paren) => inner(paren.expr()),
        ast::Expr::TryExpr(attempt) => inner(attempt.expr()),
        ast::Expr::MethodCallExpr(call) => match call.name_ref().map(|name| name.text().to_string()).as_deref() {
            Some("clone") => inner(call.receiver()),
            Some("build") => built(call),
            // `build()` returns a `Result`.
            Some("unwrap" | "expect") => match call.receiver() {
                Some(ast::Expr::MethodCallExpr(result)) => {
                    result.name_ref().is_some_and(|name| name.text() == "build") && built(&result)
                }
                _ => false,
            },
            _ => false,
        },
        ast::Expr::CallExpr(call) => constructed(call, &["new", "default"]),
        ast::Expr::PathExpr(path) => path.path().is_some_and(|path| declared(sema, &path)),
        ast::Expr::FieldExpr(field) => {
            let declaration = sema.resolve_field(field).and_then(|field| field.left()?.source(sema.db));
            matches!(declaration.map(|it| it.value), Some(FieldSource::Named(field)) if typed(field.ty()))
        }
        _ => false,
    }
}

/// `Client::builder()` followed by builder settings and `build()`.
fn built(call: &ast::MethodCallExpr) -> bool {
    let mut current = call.receiver();
    while let Some(ast::Expr::MethodCallExpr(setting)) = &current {
        current = setting.receiver();
    }
    matches!(current, Some(ast::Expr::CallExpr(start)) if constructed(&start, &["builder"]))
}

/// A call such as `Client::new()` on reqwest's client type.
fn constructed(call: &ast::CallExpr, constructors: &[&str]) -> bool {
    let Some(ast::Expr::PathExpr(callee_path)) = call.expr() else { return false };
    let Some(path) = callee_path.path() else { return false };
    let names = callee(call);
    names.last().is_some_and(|name| constructors.contains(&name.as_str()))
        && path.qualifier().is_some_and(|qualifier| client_path(&qualifier))
}

/// A local, static or constant declared as a client.
fn declared(sema: &Semantics<'_, RootDatabase>, path: &ast::Path) -> bool {
    match sema.resolve_path(path) {
        Some(PathResolution::Local(local)) => {
            let source = local.primary_source(sema.db);
            let Some(parent) = source.as_ident_pat().and_then(|pattern| pattern.syntax().parent()) else {
                return false;
            };
            if let Some(parameter) = ast::Param::cast(parent.clone()) {
                return typed(parameter.ty());
            }
            let Some(binding) = ast::LetStmt::cast(parent) else { return false };
            match binding.ty() {
                Some(declared) => typed(Some(declared)),
                None => binding.initializer().is_some_and(|value| is_client(sema, &value)),
            }
        }
        Some(PathResolution::Def(ModuleDef::Static(item))) => {
            item.source(sema.db).is_some_and(|source| typed(source.value.ty()))
        }
        _ => false,
    }
}

/// A type written as the client, also behind a reference.
fn typed(declared: Option<ast::Type>) -> bool {
    match declared {
        Some(ast::Type::RefType(reference)) => typed(reference.ty()),
        Some(ast::Type::PathType(path)) => path.path().is_some_and(|path| client_path(&path)),
        _ => false,
    }
}

/// `reqwest::Client`, `reqwest::blocking::Client`, or a name its module imports as one of them.
fn client_path(path: &ast::Path) -> bool {
    let names: Vec<String> =
        path.segments().filter_map(|segment| Some(segment.name_ref()?.text().to_string())).collect();
    match names.as_slice() {
        [name] => imported_client(path.syntax(), name),
        [first, .., last] => first == "reqwest" && last == "Client",
        [] => false,
    }
}

/// Whether a `use` item of the module that contains `place`, an inline `mod` or the file, binds
/// this name to reqwest's `Client`. Names resolve in their own module, so an import in another
/// module does not count.
fn imported_client(place: &SyntaxNode, name: &str) -> bool {
    let items: Vec<ast::Item> = match place.ancestors().find_map(ast::ItemList::cast) {
        Some(list) => list.items().collect(),
        None => place.ancestors().find_map(ast::SourceFile::cast).map_or_else(Vec::new, |file| file.items().collect()),
    };
    let uses = items.into_iter().filter_map(|item| match item {
        ast::Item::Use(import) => import.use_tree(),
        _ => None,
    });
    let mut leaves = uses.flat_map(|root| {
        let trees = root.syntax().descendants().filter_map(ast::UseTree::cast);
        trees.filter(|tree| tree.use_tree_list().is_none()).map(move |leaf| (root.clone(), leaf)).collect::<Vec<_>>()
    });
    leaves.any(|(root, leaf)| {
        let Some(imported) = leaf.path().and_then(|path| path.segment()?.name_ref()) else { return false };
        let bound = match leaf.rename() {
            Some(rename) => rename.name().is_some_and(|alias| alias.text() == name),
            None => imported.text() == name,
        };
        let crate_name = root.path().and_then(|path| path.first_segment()?.name_ref());
        bound && imported.text() == "Client" && crate_name.is_some_and(|crate_name| crate_name.text() == "reqwest")
    })
}
