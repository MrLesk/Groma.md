use std::collections::{HashMap, HashSet};

use ra_ap_hir::{Function, ModuleDef, PathResolution, Semantics};
use ra_ap_ide_db::RootDatabase;
use ra_ap_syntax::ast::{self, HasArgList, HasAttrs, HasName};
use ra_ap_syntax::{AstNode, SyntaxNode};
use serde_json::{Value, json};

use crate::patterns::segments;
use crate::scan::{Source, owned_nodes};
use crate::text::{first_string, macro_identifiers};
use crate::url::{Constants, literal_path};

const METHODS: [&str; 8] = ["get", "post", "put", "patch", "delete", "head", "options", "trace"];
/// Calls that register a nested router, a service or a handler without adding a path.
const REGISTRATIONS: [&str; 3] = ["service", "configure", "merge"];

/// One route a function body declares: its path relative to that function, and its handler.
struct Route {
    owner: Function,
    path: String,
    method: String,
    handler: Function,
}

/// One place a router function or handler is registered. A prefix the source does not state
/// literally is `None`, which reports nothing for the routes under it.
struct Registration {
    owner: Function,
    prefix: Option<String>,
}

struct Routing {
    routes: Vec<Route>,
    registrations: HashMap<Function, Vec<Registration>>,
    /// Methods and paths the attribute macros declare on handlers, in source order.
    attributes: Vec<(Function, Vec<(String, String)>)>,
}

/// The HTTP endpoints the scanned sources serve, with every prefix their routers declare.
pub fn endpoints(
    sema: &Semantics<'_, RootDatabase>,
    names: &Constants,
    sources: &[Source],
    functions: &HashMap<Function, String>,
) -> Vec<Value> {
    let routing = routing(sema, names, sources);
    let mut facts = Vec::new();
    let mut seen = HashSet::new();
    let mut paths = Paths::new();
    for route in &routing.routes {
        for base in bases(&routing, route.owner, &mut paths) {
            let path = format!("{base}{}", route.path);
            fact(&mut facts, &mut seen, functions, route.handler, &route.method, &path);
        }
    }
    // An attribute macro states the path; the registration states the prefix it is served under.
    for (handler, declared) in &routing.attributes {
        for site in routing.registrations.get(handler).into_iter().flatten() {
            let Some(prefix) = &site.prefix else { continue };
            for base in bases(&routing, site.owner, &mut paths) {
                for (method, pattern) in declared {
                    let path = format!("{base}{prefix}{pattern}");
                    fact(&mut facts, &mut seen, functions, *handler, method, &path);
                }
            }
        }
    }
    facts
}

fn fact(
    facts: &mut Vec<Value>,
    seen: &mut HashSet<String>,
    functions: &HashMap<Function, String>,
    handler: Function,
    method: &str,
    path: &str,
) {
    let (Some(operation), Some(path)) = (functions.get(&handler), segments(path)) else { return };
    let fact = json!({"operation": operation, "method": method, "path": path});
    if seen.insert(fact.to_string()) {
        facts.push(fact);
    }
}

/// The prefixes a function's own routes are served under: none when nothing registers it.
fn bases(routing: &Routing, function: Function, paths: &mut Paths) -> Vec<String> {
    resolve(routing, function, paths).0
}

struct Paths {
    known: HashMap<Function, Vec<String>>,
    /// Functions being resolved, so routers that register each other contribute no path.
    active: HashSet<Function>,
}

impl Paths {
    fn new() -> Self {
        Paths { known: HashMap::new(), active: HashSet::new() }
    }
}

/// The prefixes, and whether a cycle cut the answer short. Only a complete answer is kept.
fn resolve(routing: &Routing, function: Function, paths: &mut Paths) -> (Vec<String>, bool) {
    if let Some(known) = paths.known.get(&function) {
        return (known.clone(), false);
    }
    let Some(sites) = routing.registrations.get(&function) else { return (vec![String::new()], false) };
    if !paths.active.insert(function) {
        return (Vec::new(), true);
    }
    let mut result = Vec::new();
    let mut cycled = false;
    for site in sites {
        let Some(prefix) = &site.prefix else { continue };
        let (bases, cut) = resolve(routing, site.owner, paths);
        cycled |= cut;
        result.extend(bases.into_iter().map(|base| format!("{base}{prefix}")));
    }
    paths.active.remove(&function);
    if !cycled {
        paths.known.insert(function, result.clone());
    }
    (result, cycled)
}

fn routing(sema: &Semantics<'_, RootDatabase>, names: &Constants, sources: &[Source]) -> Routing {
    let mut routing = Routing { routes: Vec::new(), registrations: HashMap::new(), attributes: Vec::new() };
    let mut handlers: HashMap<String, Vec<Function>> = HashMap::new();
    for (syntax, function) in declared(sema, sources) {
        let declared = attribute_routes(&syntax);
        if declared.is_empty() {
            continue;
        }
        if let Some(name) = syntax.name() {
            handlers.entry(name.text().to_string()).or_default().push(function);
        }
        routing.attributes.push((function, declared));
    }
    for (syntax, owner) in declared(sema, sources) {
        let Some(body) = syntax.body() else { continue };
        for node in owned_nodes(body.syntax()) {
            let Some(call) = ast::MethodCallExpr::cast(node) else { continue };
            visit(sema, names, owner, &call, &handlers, &mut routing);
        }
    }
    routing
}

/// Every function of the scanned sources that the engine resolved, with its declaration.
fn declared<'a>(
    sema: &'a Semantics<'_, RootDatabase>,
    sources: &'a [Source],
) -> impl Iterator<Item = (ast::Fn, Function)> + 'a {
    sources.iter().flat_map(move |source| {
        source
            .syntax
            .syntax()
            .descendants()
            .filter_map(ast::Fn::cast)
            .filter_map(move |syntax| sema.to_def(&syntax).map(|function| (syntax, function)))
    })
}

fn visit(
    sema: &Semantics<'_, RootDatabase>,
    names: &Constants,
    owner: Function,
    call: &ast::MethodCallExpr,
    handlers: &HashMap<String, Vec<Function>>,
    routing: &mut Routing,
) {
    let Some(name) = call.name_ref().map(|name| name.text().to_string()) else { return };
    let arguments: Vec<ast::Expr> = call.arg_list().into_iter().flat_map(|list| list.args()).collect();
    let prefix = prefix_of(sema, names, call.syntax());
    if name == "route" {
        // A prefix the source does not state literally leaves the routes under it unreported.
        if let Some(prefix) = prefix {
            routes(sema, names, owner, &prefix, &arguments, routing);
        }
        return;
    }
    if name == "nest" || name == "mount" {
        let [path, target] = arguments.as_slice() else { return };
        let nested = prefix.zip(literal_path(sema, names, path)).map(|(prefix, path)| format!("{prefix}{path}"));
        register(sema, target, owner, nested, handlers, routing);
        return;
    }
    if REGISTRATIONS.contains(&name.as_str())
        && let [target] = arguments.as_slice()
    {
        register(sema, target, owner, prefix, handlers, routing);
    }
}

/// `route(path, handlers)` states its own path; an actix resource route takes the receiver's.
fn routes(
    sema: &Semantics<'_, RootDatabase>,
    names: &Constants,
    owner: Function,
    prefix: &str,
    arguments: &[ast::Expr],
    routing: &mut Routing,
) {
    let (pattern, handlers) = match arguments {
        // An actix resource route takes its receiver's path, and reports nothing without one.
        [handlers] if !prefix.is_empty() => (String::new(), handlers),
        [path, handlers] => match literal_path(sema, names, path) {
            Some(pattern) => (pattern, handlers),
            None => return,
        },
        _ => return,
    };
    for (method, handler) in method_handlers(handlers) {
        if let Some(function) = target_function(sema, &handler) {
            let path = format!("{prefix}{pattern}");
            routing.routes.push(Route { owner, path, method, handler: function });
        }
    }
}

fn register(
    sema: &Semantics<'_, RootDatabase>,
    target: &ast::Expr,
    owner: Function,
    prefix: Option<String>,
    handlers: &HashMap<String, Vec<Function>>,
    routing: &mut Routing,
) {
    let mut registered = |function: Function| {
        routing.registrations.entry(function).or_default().push(Registration { owner, prefix: prefix.clone() });
    };
    // Rocket's `routes![show, create]` names its handlers by identifier.
    if let ast::Expr::MacroExpr(call) = target {
        let Some(call) = call.macro_call() else { return };
        for name in macro_identifiers(&call) {
            if let Some([function]) = handlers.get(&name).map(Vec::as_slice) {
                registered(*function);
            }
        }
        return;
    }
    if let Some(function) = target_function(sema, target) {
        registered(function);
    }
}

/// The function a handler or router argument names, such as `show` or `talks::routes()`.
fn target_function(sema: &Semantics<'_, RootDatabase>, expression: &ast::Expr) -> Option<Function> {
    match expression {
        ast::Expr::CallExpr(call) => target_function(sema, &call.expr()?),
        ast::Expr::RefExpr(reference) => target_function(sema, &reference.expr()?),
        ast::Expr::PathExpr(path) => match sema.resolve_path(&path.path()?)? {
            PathResolution::Def(ModuleDef::Function(function)) => Some(function),
            _ => None,
        },
        _ => None,
    }
}

/// Methods and handlers a method router states, such as `get(list).post(create)`.
fn method_handlers(expression: &ast::Expr) -> Vec<(String, ast::Expr)> {
    match expression {
        ast::Expr::CallExpr(call) => match (call_method(call), first_argument(call.arg_list())) {
            // `web::get()` states only the method; `.to(handler)` supplies the handler.
            (Some(method), Some(handler)) => vec![(method, handler)],
            _ => Vec::new(),
        },
        ast::Expr::MethodCallExpr(call) => chained_handlers(call),
        _ => Vec::new(),
    }
}

fn chained_handlers(call: &ast::MethodCallExpr) -> Vec<(String, ast::Expr)> {
    let name = call.name_ref().map(|name| name.text().to_string()).unwrap_or_default();
    let argument = first_argument(call.arg_list());
    let receiver = call.receiver();
    if name == "to" || name == "to_async" {
        let method = match &receiver {
            Some(ast::Expr::CallExpr(inner)) => call_method(inner),
            _ => None,
        };
        return match (method, argument) {
            (Some(method), Some(handler)) => vec![(method, handler)],
            _ => Vec::new(),
        };
    }
    // Calls that only wrap the router, such as `layer` or `with_state`, keep its routes.
    let mut result = receiver.map(|receiver| method_handlers(&receiver)).unwrap_or_default();
    if let (Some(method), Some(handler)) = (method_of(&name), argument) {
        result.push((method, handler));
    }
    result
}

fn first_argument(arguments: Option<ast::ArgList>) -> Option<ast::Expr> {
    arguments?.args().next()
}

fn call_method(call: &ast::CallExpr) -> Option<String> {
    let ast::Expr::PathExpr(path) = call.expr()? else { return None };
    method_of(&path.path()?.segment()?.name_ref()?.text())
}

fn method_of(name: &str) -> Option<String> {
    if name == "any" {
        return Some("*".to_owned());
    }
    METHODS.contains(&name).then(|| name.to_uppercase())
}

/// Routes an attribute macro declares, such as actix's and Rocket's `#[get("/talks/{id}")]`.
fn attribute_routes(function: &ast::Fn) -> Vec<(String, String)> {
    function
        .attrs()
        .filter_map(|attribute| {
            let name = attribute.path()?.segment()?.name_ref()?;
            let method = method_of(&name.text())?;
            Some((method, first_string(&attribute.token_tree()?)?))
        })
        .collect()
}

/// The literal prefix the enclosing routers add, or nothing when one of them is not literal.
fn prefix_of(sema: &Semantics<'_, RootDatabase>, names: &Constants, node: &SyntaxNode) -> Option<String> {
    let mut levels = vec![scopes(sema, names, node)?];
    let mut current = node.clone();
    while let Some(parent) = current.parent() {
        if ast::Fn::can_cast(parent.kind()) {
            break;
        }
        // Only an argument is nested inside the outer router; a receiver continues the chain.
        if let Some(call) = ast::MethodCallExpr::cast(parent.clone())
            && ast::ArgList::can_cast(current.kind())
        {
            let mut level = scopes(sema, names, call.syntax())?;
            if let Some(path) = nested_path(sema, names, &call)? {
                level.push(path);
            }
            levels.push(level);
        }
        current = parent;
    }
    levels.reverse();
    Some(levels.concat().concat())
}

/// The path a `nest` or `mount` call gives its argument; `Some(None)` for any other call.
fn nested_path(
    sema: &Semantics<'_, RootDatabase>,
    names: &Constants,
    call: &ast::MethodCallExpr,
) -> Option<Option<String>> {
    let nests = call.name_ref().is_some_and(|name| matches!(name.text().as_str(), "nest" | "mount"));
    if !nests {
        return Some(None);
    }
    first_argument(call.arg_list()).and_then(|path| literal_path(sema, names, &path)).map(Some)
}

/// Literal prefixes of `web::scope` and `web::resource` in a call's receiver chain, outermost first.
fn scopes(sema: &Semantics<'_, RootDatabase>, names: &Constants, node: &SyntaxNode) -> Option<Vec<String>> {
    let mut prefixes = Vec::new();
    let mut current = ast::MethodCallExpr::cast(node.clone()).and_then(|call| call.receiver());
    while let Some(expression) = current {
        let (name, arguments, receiver) = match expression {
            ast::Expr::MethodCallExpr(call) => (
                call.name_ref().map(|name| name.text().to_string()),
                call.arg_list(),
                call.receiver(),
            ),
            ast::Expr::CallExpr(call) => (path_name(&call), call.arg_list(), None),
            _ => break,
        };
        if name.is_some_and(|name| name == "scope" || name == "resource") {
            prefixes.push(literal_path(sema, names, &first_argument(arguments)?)?);
        }
        current = receiver;
    }
    prefixes.reverse();
    Some(prefixes)
}

fn path_name(call: &ast::CallExpr) -> Option<String> {
    let ast::Expr::PathExpr(path) = call.expr()? else { return None };
    Some(path.path()?.segment()?.name_ref()?.text().to_string())
}
