use ra_ap_hir::{PathResolution, Semantics};
use ra_ap_ide_db::RootDatabase;
use ra_ap_syntax::ast::{self, HasArgList, HasName};
use ra_ap_syntax::{AstNode, SyntaxNode};

use crate::text::{callee, first_argument};
use crate::url::{Constants, literal_path};

/// The application a router is proved to be served at the root of.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Root {
    /// An `App::new()` chain; actix-web takes the first registered match.
    Actix,
    /// A router passed to `serve`.
    Axum,
    /// A `rocket::build()` or `rocket::custom(..)` chain.
    Rocket,
}

/// Where a router call's routes are served, as far as its own function shows.
pub struct Placement {
    /// The literal prefixes the enclosing routers add, outermost first. When the source does not
    /// state one of them literally, only the readable part outside it.
    pub prefix: String,
    /// The application the source proves the router is served at the root of.
    pub root: Option<Root>,
    /// Every prefix is readable.
    pub complete: bool,
}

/// Calls whose argument router is served under the call's own placement.
const ROUTER_ARGUMENTS: [&str; 6] = ["nest", "mount", "serve", "service", "configure", "merge"];

/// The prefixes the enclosing routers add to a router call, walking out to its function: an
/// argument of `nest` or `mount` is nested under that call's path, `web::scope` and
/// `web::resource` in a receiver chain add theirs, and a router bound to a local continues where
/// that local is used. A router passed to any other call, a local used more than once, and a
/// receiver that is a parameter able to carry a prefix, such as an actix `Scope`, leave the rest
/// unknown. A chain built on `App::new()`, `rocket::build()` or `rocket::custom(..)`, and a router
/// passed to `serve`, are served at the application root.
pub fn placement(sema: &Semantics<'_, RootDatabase>, names: &Constants, node: &SyntaxNode) -> Placement {
    let mut walk = Walk { sema, names, pieces: Vec::new(), root: None, complete: true };
    walk.chain(node);
    let mut current = node.clone();
    while walk.root.is_none() {
        let Some(parent) = current.parent() else { break };
        if ast::Fn::can_cast(parent.kind()) {
            break;
        }
        // A router assigned to a variable may end up anywhere that variable goes.
        let assigned = ast::BinExpr::cast(parent.clone()).and_then(|expression| expression.op_kind());
        if matches!(assigned, Some(ast::BinaryOp::Assignment { .. })) {
            walk.unreadable();
            break;
        }
        if let Some(binding) = ast::LetStmt::cast(parent.clone())
            && binding.initializer().is_some_and(|value| value.syntax() == &current)
        {
            let Some(used) = single_use(sema, &binding) else {
                walk.unreadable();
                break;
            };
            current = used;
            continue;
        }
        // Only an argument is served by the call around it; a receiver continues the chain.
        if ast::ArgList::can_cast(current.kind()) {
            walk.enclosing(&parent);
        }
        current = parent;
    }
    walk.pieces.reverse();
    Placement { prefix: walk.pieces.concat(), root: walk.root, complete: walk.complete }
}

struct Walk<'a, 'db> {
    sema: &'a Semantics<'db, RootDatabase>,
    names: &'a Constants,
    /// Prefixes found so far, innermost first.
    pieces: Vec<String>,
    root: Option<Root>,
    complete: bool,
}

impl Walk<'_, '_> {
    fn piece(&mut self, piece: Option<String>) {
        match piece {
            Some(piece) => self.pieces.push(piece),
            None => self.unreadable(),
        }
    }

    /// A prefix the source does not state literally hides everything inside it.
    fn unreadable(&mut self) {
        self.pieces.clear();
        self.complete = false;
    }

    /// The call a router is an argument of: `nest` and `mount` add their path, `serve` puts it at
    /// the root, and a call that is not a router registration hides where it goes.
    fn enclosing(&mut self, call: &SyntaxNode) {
        if let Some(method) = ast::MethodCallExpr::cast(call.clone()) {
            let name = method.name_ref().map(|name| name.text().to_string()).unwrap_or_default();
            if !ROUTER_ARGUMENTS.contains(&name.as_str()) {
                return self.unreadable();
            }
            if name == "nest" || name == "mount" {
                let path = first_argument(method.arg_list());
                self.piece(path.and_then(|path| literal_path(self.sema, self.names, &path)));
            }
            if name == "serve" {
                self.root = Some(Root::Axum);
            }
            self.chain(call);
        } else if let Some(function) = ast::CallExpr::cast(call.clone()) {
            // `axum::serve(listener, router)`.
            match callee(&function).last().is_some_and(|name| name == "serve") {
                true => self.root = Some(Root::Axum),
                false => self.unreadable(),
            }
        }
    }

    /// Where the call's receiver chain starts: the application itself, a router without a prefix
    /// of its own, or a `web::scope` or `web::resource` whose path it adds. Any other start may
    /// carry a prefix this scan cannot read.
    fn chain(&mut self, call: &SyntaxNode) {
        let Some(receiver) = ast::MethodCallExpr::cast(call.clone()).and_then(|call| call.receiver()) else { return };
        match start(self.sema, self.names, &receiver) {
            Start::Root(root) => self.root = Some(root),
            Start::Plain => {}
            Start::Scoped(path) => self.piece(path),
            Start::Other(_) => self.unreadable(),
        }
    }
}

/// Where a method chain starts.
pub enum Start {
    /// The application itself.
    Root(Root),
    /// A router with no prefix of its own: `Router::new()`, or a parameter typed `ServiceConfig`,
    /// `Router` or `Rocket`.
    Plain,
    /// `web::scope(path)` or `web::resource(path)`, with its path when it is literal.
    Scoped(Option<String>),
    /// Any other value, such as another call, a field, or a binding that is `mut`, has no value
    /// or comes from a pattern.
    Other(ast::Expr),
}

/// The start of the chain an expression continues, through method receivers and immutable `let`
/// bindings to the call or parameter that creates it.
pub fn start(sema: &Semantics<'_, RootDatabase>, names: &Constants, expression: &ast::Expr) -> Start {
    let mut current = expression.clone();
    for _ in 0..DEPTH {
        let next = match &current {
            ast::Expr::MethodCallExpr(call) => call.receiver(),
            ast::Expr::PathExpr(path) => match binding(sema, path) {
                Binding::Value(value) => Some(value),
                Binding::Plain => return Start::Plain,
                Binding::Other => None,
            },
            ast::Expr::CallExpr(call) => {
                if let Some(start) = created(sema, names, call) {
                    return start;
                }
                None
            }
            _ => None,
        };
        match next {
            Some(next) => current = next,
            None => return Start::Other(current),
        }
    }
    Start::Other(current)
}

/// How far a chain is followed through receivers and bindings.
const DEPTH: usize = 16;

/// A call that creates a router this scan knows.
fn created(sema: &Semantics<'_, RootDatabase>, names: &Constants, call: &ast::CallExpr) -> Option<Start> {
    let callee = callee(call);
    if let Some(root) = application(&callee) {
        return Some(Start::Root(root));
    }
    match callee.as_slice() {
        [.., router, new] if router == "Router" && new == "new" => Some(Start::Plain),
        [.., scope] if scope == "scope" || scope == "resource" => {
            let path = first_argument(call.arg_list());
            Some(Start::Scoped(path.and_then(|path| literal_path(sema, names, &path))))
        }
        _ => None,
    }
}

enum Binding {
    /// The value an immutable `let` binds.
    Value(ast::Expr),
    /// A parameter typed as a router without a prefix of its own.
    Plain,
    Other,
}

fn binding(sema: &Semantics<'_, RootDatabase>, path: &ast::PathExpr) -> Binding {
    let Some(PathResolution::Local(local)) = path.path().and_then(|path| sema.resolve_path(&path)) else {
        return Binding::Other;
    };
    // A `mut` binding may be reassigned to any router.
    let parent = local.primary_source(sema.db).as_ident_pat().and_then(|pattern| pattern.syntax().parent());
    match parent {
        _ if local.is_mut(sema.db) => Binding::Other,
        Some(parent) if ast::Param::can_cast(parent.kind()) => {
            let prefixless = ast::Param::cast(parent).is_some_and(|parameter| prefixless(parameter.ty()));
            if prefixless { Binding::Plain } else { Binding::Other }
        }
        Some(parent) => match ast::LetStmt::cast(parent).and_then(|binding| binding.initializer()) {
            Some(value) => Binding::Value(value),
            None => Binding::Other,
        },
        None => Binding::Other,
    }
}

fn prefixless(declared: Option<ast::Type>) -> bool {
    match declared {
        Some(ast::Type::RefType(reference)) => prefixless(reference.ty()),
        Some(ast::Type::PathType(path)) => {
            let name = path.path().and_then(|path| path.segment()?.name_ref());
            name.is_some_and(|name| matches!(name.text().as_str(), "ServiceConfig" | "Router" | "Rocket"))
        }
        _ => false,
    }
}

/// `App::new()`, `rocket::build()` and `rocket::custom(..)` create the application.
fn application(callee: &[String]) -> Option<Root> {
    match callee {
        [.., app, new] if app == "App" && new == "new" => Some(Root::Actix),
        [.., rocket, build] if rocket == "rocket" && (build == "build" || build == "custom") => Some(Root::Rocket),
        _ => None,
    }
}

/// The one use of the local a `let` binds, if it is used exactly once; assigning to it is a use.
fn single_use(sema: &Semantics<'_, RootDatabase>, binding: &ast::LetStmt) -> Option<SyntaxNode> {
    let ast::Pat::IdentPat(pattern) = binding.pat()? else { return None };
    let local = sema.to_def(&pattern)?;
    let name = pattern.name()?.text().to_string();
    let body = binding.syntax().ancestors().find_map(ast::Fn::cast)?.body()?;
    let mut uses = body.syntax().descendants().filter_map(ast::PathExpr::cast).filter(|read| {
        let path = read.path();
        let reference = path.as_ref().and_then(|path| path.as_single_name_ref());
        let resolved = || path.as_ref().and_then(|path| sema.resolve_path(path));
        reference.is_some_and(|reference| reference.text() == name)
            && matches!(resolved(), Some(PathResolution::Local(found)) if found == local)
    });
    let first = uses.next()?;
    uses.next().is_none().then(|| first.syntax().clone())
}
