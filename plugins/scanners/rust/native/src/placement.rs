use ra_ap_hir::{PathResolution, Semantics};
use ra_ap_ide_db::RootDatabase;
use ra_ap_syntax::ast::{self, HasArgList, HasName};
use ra_ap_syntax::{AstNode, SyntaxNode};

use crate::text::{callee, first_argument, let_value};
use crate::url::{Constants, literal_path};

/// The framework whose application a router is proved to be served at the root of.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Framework {
    /// An `App::new()` chain; actix-web takes the first registered match.
    Actix,
    /// A router passed to `serve`.
    Axum,
    /// A `rocket::build()` or `rocket::custom(..)` chain.
    Rocket,
}

/// What a router method does with its arguments.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum RouterCall {
    /// `route(path, handlers)` declares a route.
    Route,
    /// `nest(path, router)` and `mount(path, routes)` serve a router under a path.
    Nest,
    /// `service`, `configure` and `merge` register a router, a service or a handler without a path.
    Register,
    /// `to`, `to_async` and `default_service` answer every method, or everything else, of a scope
    /// or resource.
    Whole,
}

pub fn router_call(name: &str) -> Option<RouterCall> {
    match name {
        "route" => Some(RouterCall::Route),
        "nest" | "mount" => Some(RouterCall::Nest),
        "service" | "configure" | "merge" => Some(RouterCall::Register),
        "to" | "to_async" | "default_service" => Some(RouterCall::Whole),
        _ => None,
    }
}

/// Where a router call's routes are served, as far as its own function shows.
pub struct Placement {
    /// The literal prefixes the enclosing routers add, outermost first. When the source does not
    /// state one of them literally, only the readable part outside it.
    pub prefix: String,
    /// The framework whose application the source proves the router is served at the root of.
    pub framework: Option<Framework>,
    /// Every prefix is readable.
    pub complete: bool,
}

/// The prefixes the enclosing routers add to a router call, following the router value out to its
/// function. The value passes along as a method receiver, as the argument of a `nest`, `mount`,
/// `service`, `configure` or `merge` call (which add their paths), through a `let` used once, as a
/// block's final value or a `return` value, and through parentheses, `.await` and `?`. Anywhere
/// else, such as another call, an array, a tuple, a loop or an assignment, it may be served under
/// any prefix. A chain that starts at the application itself, or a router passed to `serve`, is
/// served at the root; a chain that starts at a `ServiceConfig` parameter is served wherever its
/// function is configured.
pub fn placement(sema: &Semantics<'_, RootDatabase>, names: &Constants, node: &SyntaxNode) -> Placement {
    let mut walk = Walk { sema, names, pieces: Vec::new(), framework: None, complete: true, configured: false };
    walk.chain(node);
    let mut current = node.clone();
    while walk.framework.is_none() && !walk.configured {
        let Some(next) = walk.step(&current) else { break };
        current = next;
    }
    walk.pieces.reverse();
    Placement { prefix: walk.pieces.concat(), framework: walk.framework, complete: walk.complete }
}

struct Walk<'a, 'db> {
    sema: &'a Semantics<'db, RootDatabase>,
    names: &'a Constants,
    /// Prefixes found so far, innermost first.
    pieces: Vec<String>,
    framework: Option<Framework>,
    complete: bool,
    /// The chain registers into a `ServiceConfig` parameter.
    configured: bool,
}

impl Walk<'_, '_> {
    /// The node the router value moves to next, or `None` at the function or where it is lost.
    fn step(&mut self, current: &SyntaxNode) -> Option<SyntaxNode> {
        let parent = current.parent()?;
        let receiver = ast::MethodCallExpr::cast(parent.clone()).and_then(|call| call.receiver());
        let tail = ast::StmtList::cast(parent.clone()).and_then(|list| list.tail_expr());
        let passes = ast::ParenExpr::can_cast(parent.kind())
            || ast::AwaitExpr::can_cast(parent.kind())
            || ast::TryExpr::can_cast(parent.kind())
            || ast::BlockExpr::can_cast(parent.kind())
            || receiver.is_some_and(|receiver| receiver.syntax() == current)
            || tail.is_some_and(|tail| tail.syntax() == current);
        if passes {
            return Some(parent);
        }
        // The function's body block, or a `return`, is the function's own value.
        if ast::Fn::can_cast(parent.kind()) || returned(&parent) {
            return None;
        }
        if let Some(binding) = ast::LetStmt::cast(parent.clone())
            && binding.initializer().is_some_and(|value| value.syntax() == current)
        {
            let used = single_use(self.sema, &binding);
            if used.is_none() {
                self.unreadable();
            }
            return used;
        }
        // An unreadable call still passes its result on, so the prefixes outside it stay readable.
        if ast::ArgList::can_cast(parent.kind()) {
            let call = parent.parent()?;
            self.enclosing(&call);
            return Some(call);
        }
        self.unreadable();
        None
    }

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
            match router_call(&name) {
                Some(RouterCall::Nest) => {
                    let path = first_argument(method.arg_list());
                    self.piece(path.and_then(|path| literal_path(self.sema, self.names, &path)));
                }
                Some(RouterCall::Register) => {}
                _ => return self.unreadable(),
            }
            self.chain(call);
        } else if let Some(function) = ast::CallExpr::cast(call.clone()) {
            // `axum::serve(listener, router)`.
            match callee(&function).last().is_some_and(|name| name == "serve") {
                true => self.framework = Some(Framework::Axum),
                false => self.unreadable(),
            }
        } else {
            self.unreadable();
        }
    }

    /// Where the call's receiver chain starts: the application itself, a router without a prefix
    /// of its own, or a `web::scope` or `web::resource` whose path it adds. Any other start may
    /// carry a prefix this scan cannot read.
    fn chain(&mut self, call: &SyntaxNode) {
        let Some(receiver) = ast::MethodCallExpr::cast(call.clone()).and_then(|call| call.receiver()) else { return };
        match start(self.sema, self.names, &receiver) {
            Start::Application(framework) => self.framework = Some(framework),
            Start::Plain => {}
            Start::Config => self.configured = true,
            Start::Scoped(path) => self.piece(path),
            Start::Other(_) => self.unreadable(),
        }
    }
}

/// A `return` in the function itself, not in a closure inside it.
fn returned(node: &SyntaxNode) -> bool {
    let owner = node.ancestors().find(|it| ast::Fn::can_cast(it.kind()) || ast::ClosureExpr::can_cast(it.kind()));
    ast::ReturnExpr::can_cast(node.kind()) && owner.is_some_and(|owner| ast::Fn::can_cast(owner.kind()))
}

/// Where a method chain starts.
pub enum Start {
    /// The application itself.
    Application(Framework),
    /// A router with no prefix of its own: `Router::new()`, or a parameter typed `Router`.
    Plain,
    /// A `ServiceConfig` parameter, which routes register into in place.
    Config,
    /// `web::scope(path)` or `web::resource(path)`, with its path when it is literal.
    Scoped(Option<String>),
    /// Any other value, such as another call, a field, or a binding that is `mut`, has no value
    /// or comes from a pattern.
    Other(ast::Expr),
}

/// How many receivers and `let` values `start` follows before it gives up on a chain.
const DEPTH: usize = 16;

/// The start of the chain an expression continues, through method receivers and immutable `let`
/// bindings to the call or parameter that creates it.
pub fn start(sema: &Semantics<'_, RootDatabase>, names: &Constants, expression: &ast::Expr) -> Start {
    let mut current = expression.clone();
    for _ in 0..DEPTH {
        let next = match &current {
            ast::Expr::MethodCallExpr(call) => call.receiver(),
            ast::Expr::PathExpr(path) => match path.path().and_then(|path| sema.resolve_path(&path)) {
                Some(PathResolution::Local(local)) => match parameter(sema, local) {
                    Some(Some(start)) => return start,
                    Some(None) => None,
                    None => let_value(sema, local),
                },
                _ => None,
            },
            ast::Expr::CallExpr(call) => match created(sema, names, call) {
                Some(start) => return start,
                None => None,
            },
            _ => None,
        };
        match next {
            Some(next) => current = next,
            None => return Start::Other(current),
        }
    }
    Start::Other(current)
}

/// A call that creates a router this scan knows.
fn created(sema: &Semantics<'_, RootDatabase>, names: &Constants, call: &ast::CallExpr) -> Option<Start> {
    match callee(call).as_slice() {
        [.., app, new] if app == "App" && new == "new" => Some(Start::Application(Framework::Actix)),
        [.., rocket, build] if rocket == "rocket" && (build == "build" || build == "custom") => {
            Some(Start::Application(Framework::Rocket))
        }
        [.., router, new] if router == "Router" && new == "new" => Some(Start::Plain),
        [.., scope] if scope == "scope" || scope == "resource" => {
            let path = first_argument(call.arg_list());
            Some(Start::Scoped(path.and_then(|path| literal_path(sema, names, &path))))
        }
        _ => None,
    }
}

/// The start a parameter gives a chain: an immutable `ServiceConfig` or `Router` carries no prefix
/// of its own, and any other parameter may carry one (`Some(None)`). `None` when the local is not
/// a parameter.
fn parameter(sema: &Semantics<'_, RootDatabase>, local: ra_ap_hir::Local) -> Option<Option<Start>> {
    let parent = local.primary_source(sema.db).as_ident_pat()?.syntax().parent()?;
    let declared = match ast::Param::cast(parent)?.ty() {
        Some(ast::Type::RefType(reference)) => reference.ty(),
        other => other,
    };
    let name = match declared {
        Some(ast::Type::PathType(path)) => path.path().and_then(|path| path.segment()?.name_ref()),
        _ => None,
    };
    if local.is_mut(sema.db) {
        return Some(None);
    }
    Some(match name.as_ref().map(|name| name.text().to_string()).as_deref() {
        Some("ServiceConfig") => Some(Start::Config),
        Some("Router") => Some(Start::Plain),
        _ => None,
    })
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
