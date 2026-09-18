use std::collections::{HashMap, HashSet};

use ra_ap_hir::{Function, HasSource, ModuleDef, PathResolution, Semantics};
use ra_ap_ide_db::RootDatabase;
use ra_ap_syntax::AstNode;
use ra_ap_syntax::ast::{self, HasArgList, HasName};
use serde_json::{Value, json};

use crate::handlers::{attribute_routes, method_handlers, ranked, typed_parameters};
use crate::patterns::segments;
use crate::placement::{Framework, Placement, RouterCall, Start, placement, router_call, start};
use crate::scan::{Source, owned_nodes};
use crate::text::{callee, let_value, macro_identifiers};
use crate::url::{Constants, literal_path};

/// One route a function body declares: its path under the function's placement, and its handler.
/// A route without a handler is an entry this scan sees but cannot report, such as a service it
/// cannot resolve. In an actix-web application it may capture requests registered after it, so
/// it is reported as a blocker: its readable prefix followed by a constrained optional catch-all.
struct Route {
    owner: Function,
    framework: Option<Framework>,
    path: String,
    method: String,
    handler: Option<Function>,
}

/// One place a router function or handler is registered. A prefix the source does not state
/// literally is `None`, which reports nothing for the routes under it.
struct Registration {
    owner: Function,
    framework: Option<Framework>,
    prefix: Option<String>,
}

/// Methods and paths the attribute macros declare on one handler.
struct Attributed {
    handler: Function,
    routes: Vec<(String, String)>,
    /// Parameters whose argument is not a string, which Rocket checks before the route matches.
    typed: HashSet<String>,
    /// An attribute states Rocket's `rank`.
    ranked: bool,
}

#[derive(Default)]
struct Routing {
    routes: Vec<Route>,
    registrations: HashMap<Function, Vec<Registration>>,
    attributes: Vec<Attributed>,
    /// The file that declares each function.
    files: HashMap<Function, String>,
}

/// The HTTP endpoints the scanned sources serve, with every prefix their routers declare.
pub fn endpoints(
    sema: &Semantics<'_, RootDatabase>,
    names: &Constants,
    sources: &[Source],
    functions: &HashMap<Function, String>,
) -> Vec<Value> {
    let routing = routing(sema, names, sources);
    let mut bases = Bases::default();
    let ranked = ranked_applications(&routing, &mut bases);
    let mut facts = Facts { functions, files: &routing.files, ranked, seen: HashSet::new(), list: Vec::new() };
    let untyped = HashSet::new();
    for route in &routing.routes {
        for base in served(&routing, route.owner, route.framework, &mut bases) {
            let path = format!("{}{}", base.prefix, route.path);
            match route.handler {
                Some(handler) => facts.endpoint(handler, &base, &route.method, &path, &untyped),
                None if base.framework == Framework::Actix => facts.blocker(route.owner, &base, &route.method, &path),
                None => {}
            }
        }
    }
    // An attribute macro states the path; the registration states the prefix it is served under.
    for attributed in &routing.attributes {
        for site in routing.registrations.get(&attributed.handler).into_iter().flatten() {
            let Some(prefix) = &site.prefix else { continue };
            for base in served(&routing, site.owner, site.framework, &mut bases) {
                let typed = if base.framework == Framework::Rocket { &attributed.typed } else { &untyped };
                for (method, pattern) in &attributed.routes {
                    let path = format!("{}{prefix}{pattern}", base.prefix);
                    facts.endpoint(attributed.handler, &base, method, &path, typed);
                }
            }
        }
    }
    facts.list
}

/// Rocket applications with a route that states `rank`, which overrides the router's specificity.
/// A registration whose prefix is unreadable still counts: its routes go unreported, but the rank
/// still changes how the application orders the others.
fn ranked_applications(routing: &Routing, bases: &mut Bases) -> HashSet<Function> {
    let mut applications = HashSet::new();
    for attributed in routing.attributes.iter().filter(|attributed| attributed.ranked) {
        for site in routing.registrations.get(&attributed.handler).into_iter().flatten() {
            let served = served(routing, site.owner, site.framework, bases);
            let rocket = served.into_iter().filter(|base| base.framework == Framework::Rocket);
            applications.extend(rocket.map(|base| base.application));
        }
    }
    applications
}

struct Facts<'a> {
    functions: &'a HashMap<Function, String>,
    files: &'a HashMap<Function, String>,
    ranked: HashSet<Function>,
    seen: HashSet<String>,
    list: Vec<Value>,
}

impl Facts<'_> {
    /// actix-web takes the first registered match, and so does a Rocket application whose ranks
    /// override specificity. The application is the file whose chain creates it. This scan does
    /// not prove registration order, so every position is 0.
    fn order(&self, base: &Base) -> Option<Value> {
        let ordered = base.framework == Framework::Actix
            || (base.framework == Framework::Rocket && self.ranked.contains(&base.application));
        let file = self.files.get(&base.application)?;
        ordered.then(|| json!({"application": file, "position": 0}))
    }

    fn endpoint(&mut self, handler: Function, base: &Base, method: &str, path: &str, typed: &HashSet<String>) {
        let Some(mut segments) = segments(path) else { return };
        for segment in &mut segments {
            if segment["name"].as_str().is_some_and(|name| typed.contains(name)) {
                segment["constrained"] = json!(true);
            }
        }
        self.push(handler, method, segments, self.order(base));
    }

    /// The readable prefix, then a constrained optional catch-all; a prefix that already ends in a
    /// catch-all has that one constrained instead.
    fn blocker(&mut self, owner: Function, base: &Base, method: &str, prefix: &str) {
        let mut segments = segments(prefix).unwrap_or_default();
        if segments.last().is_none_or(|last| last["kind"] != "catch-all") {
            segments.push(json!({"kind": "catch-all", "name": "rest"}));
        }
        if let Some(last) = segments.last_mut() {
            last["optional"] = json!(true);
            last["constrained"] = json!(true);
        }
        self.push(owner, method, segments, self.order(base));
    }

    fn push(&mut self, operation: Function, method: &str, path: Vec<Value>, order: Option<Value>) {
        let Some(operation) = self.functions.get(&operation) else { return };
        let mut fact = json!({"operation": operation, "method": method, "path": path});
        if let Some(order) = order {
            fact["order"] = order;
        }
        if self.seen.insert(fact.to_string()) {
            self.list.push(fact);
        }
    }
}

/// One prefix a function's routes are served under, and the function whose chain creates the
/// application.
#[derive(Clone)]
struct Base {
    prefix: String,
    application: Function,
    framework: Framework,
}

/// The prefixes a function's routes are served under: none when nothing registers the function.
fn served(routing: &Routing, owner: Function, framework: Option<Framework>, bases: &mut Bases) -> Vec<Base> {
    site(routing, owner, framework, bases).0
}

/// A site the source proves is at the application root, or else the function's own registrations,
/// with whether a cycle cut the answer short.
fn site(routing: &Routing, owner: Function, framework: Option<Framework>, bases: &mut Bases) -> (Vec<Base>, bool) {
    match framework {
        Some(framework) => (vec![Base { prefix: String::new(), application: owner, framework }], false),
        None => resolve(routing, owner, bases),
    }
}

#[derive(Default)]
struct Bases {
    known: HashMap<Function, Vec<Base>>,
    /// Functions being resolved, so routers that register each other contribute no path.
    active: HashSet<Function>,
}

/// The prefixes every registration of a function gives it. Only a complete answer is kept.
fn resolve(routing: &Routing, function: Function, bases: &mut Bases) -> (Vec<Base>, bool) {
    if let Some(known) = bases.known.get(&function) {
        return (known.clone(), false);
    }
    let Some(sites) = routing.registrations.get(&function) else { return (Vec::new(), false) };
    if !bases.active.insert(function) {
        return (Vec::new(), true);
    }
    let mut result = Vec::new();
    let mut cycled = false;
    for registration in sites {
        let Some(prefix) = &registration.prefix else { continue };
        let (outer, cut) = site(routing, registration.owner, registration.framework, bases);
        cycled |= cut;
        result.extend(outer.into_iter().map(|base| Base { prefix: format!("{}{prefix}", base.prefix), ..base }));
    }
    bases.active.remove(&function);
    if !cycled {
        bases.known.insert(function, result.clone());
    }
    (result, cycled)
}

fn routing(sema: &Semantics<'_, RootDatabase>, names: &Constants, sources: &[Source]) -> Routing {
    let mut routing = Routing::default();
    let mut handlers: HashMap<String, Vec<Function>> = HashMap::new();
    for (file, syntax, function) in declared(sema, sources) {
        routing.files.insert(function, file.to_owned());
        let routes = attribute_routes(&syntax);
        if routes.is_empty() {
            continue;
        }
        if let Some(name) = syntax.name() {
            handlers.entry(name.text().to_string()).or_default().push(function);
        }
        let (typed, ranked) = (typed_parameters(&syntax), ranked(&syntax));
        routing.attributes.push(Attributed { handler: function, routes, typed, ranked });
    }
    let reader = Reader { sema, names, handlers };
    for (_, syntax, owner) in declared(sema, sources) {
        let Some(body) = syntax.body() else { continue };
        for node in owned_nodes(body.syntax()) {
            if let Some(call) = ast::MethodCallExpr::cast(node.clone()) {
                reader.visit(owner, &call, &mut routing);
            } else if let Some(call) = ast::CallExpr::cast(node) {
                reader.serve(owner, &call, &mut routing);
            }
        }
    }
    routing
}

/// Every function of the scanned sources that the engine resolved, with its file and declaration.
fn declared<'a>(
    sema: &'a Semantics<'_, RootDatabase>,
    sources: &'a [Source],
) -> impl Iterator<Item = (&'a str, ast::Fn, Function)> + 'a {
    sources.iter().flat_map(move |source| {
        let functions = source.syntax.syntax().descendants().filter_map(ast::Fn::cast);
        let file = source.file.as_str();
        functions.filter_map(move |syntax| sema.to_def(&syntax).map(|function| (file, syntax, function)))
    })
}

struct Reader<'a, 'db> {
    sema: &'a Semantics<'db, RootDatabase>,
    names: &'a Constants,
    /// Attributed handlers by name, for Rocket's `routes![..]`.
    handlers: HashMap<String, Vec<Function>>,
}

/// How many called functions `handled` follows through their returned values.
const DEPTH: usize = 8;

impl Reader<'_, '_> {
    fn visit(&self, owner: Function, call: &ast::MethodCallExpr, routing: &mut Routing) {
        let Some(kind) = call.name_ref().and_then(|name| router_call(&name.text())) else { return };
        if kind == RouterCall::Whole && !self.scoped(call) {
            return;
        }
        let arguments: Vec<ast::Expr> = call.arg_list().into_iter().flat_map(|list| list.args()).collect();
        let place = placement(self.sema, self.names, call.syntax());
        let path = place.prefix.clone();
        let blocker = Route { owner, framework: place.framework, path, method: "*".to_owned(), handler: None };
        // What follows an unreadable prefix is unknown.
        if !place.complete || kind == RouterCall::Whole {
            return routing.routes.push(blocker);
        }
        match (kind, arguments.as_slice()) {
            (RouterCall::Route, _) => self.routes(owner, &place, &arguments, routing),
            (RouterCall::Nest, [path, target]) => {
                let nested = literal_path(self.sema, self.names, path).map(|path| format!("{}{path}", place.prefix));
                self.register(target, owner, place.framework, nested, routing);
            }
            (RouterCall::Register, [target]) => {
                if !self.handled(target, 0) {
                    routing.routes.push(blocker);
                }
                self.register(target, owner, place.framework, Some(place.prefix), routing);
            }
            _ => {}
        }
    }

    /// `axum::serve(listener, router)` serves its router at the root.
    fn serve(&self, owner: Function, call: &ast::CallExpr, routing: &mut Routing) {
        let named = callee(call).last().is_some_and(|name| name == "serve");
        if let (true, Some(target)) = (named, call.arg_list().and_then(|list| list.args().last())) {
            self.register(&target, owner, Some(Framework::Axum), Some(String::new()), routing);
        }
    }

    /// `route(path, handlers)` states its own path; an actix resource route takes the receiver's.
    /// A path, method router or handler the scan cannot read is a route without a handler.
    fn routes(&self, owner: Function, place: &Placement, arguments: &[ast::Expr], routing: &mut Routing) {
        let route = |path: String, method: String, handler: Option<Function>| {
            Route { owner, framework: place.framework, path, method, handler }
        };
        let (pattern, handlers) = match arguments {
            // An actix resource route takes its receiver's path, and reports nothing without one.
            [handlers] if !place.prefix.is_empty() => (String::new(), handlers),
            [path, handlers] => match literal_path(self.sema, self.names, path) {
                Some(pattern) => (pattern, handlers),
                None => return routing.routes.push(route(place.prefix.clone(), "*".to_owned(), None)),
            },
            _ => return,
        };
        let path = format!("{}{pattern}", place.prefix);
        let methods = method_handlers(handlers);
        if methods.is_empty() {
            routing.routes.push(route(path.clone(), "*".to_owned(), None));
        }
        for (method, handler) in methods {
            routing.routes.push(route(path.clone(), method, target_function(self.sema, &handler)));
        }
    }

    fn register(
        &self,
        target: &ast::Expr,
        owner: Function,
        framework: Option<Framework>,
        prefix: Option<String>,
        routing: &mut Routing,
    ) {
        let mut registered = |function: Function| {
            let site = Registration { owner, framework, prefix: prefix.clone() };
            routing.registrations.entry(function).or_default().push(site);
        };
        // Rocket's `routes![show, create]` names its handlers by identifier.
        if let ast::Expr::MacroExpr(call) = target {
            let Some(call) = call.macro_call() else { return };
            for name in macro_identifiers(&call) {
                if let Some([function]) = self.handlers.get(&name).map(Vec::as_slice) {
                    registered(*function);
                }
            }
            return;
        }
        if let Some(function) = target_function(self.sema, target) {
            registered(function);
        }
    }

    /// Whether a call is made on a `web::scope` or `web::resource` chain.
    fn scoped(&self, call: &ast::MethodCallExpr) -> bool {
        let receiver = call.receiver();
        receiver.is_some_and(|receiver| matches!(start(self.sema, self.names, &receiver), Start::Scoped(_)))
    }

    /// A registration target this scan follows: a router whose chain it reads, a function it
    /// registers, Rocket's `routes![..]`, or a call to a function whose returned value is one of
    /// these.
    fn handled(&self, target: &ast::Expr, depth: usize) -> bool {
        if depth > DEPTH {
            return false;
        }
        match start(self.sema, self.names, target) {
            Start::Plain | Start::Config | Start::Scoped(_) => true,
            Start::Application(_) => false,
            Start::Other(ast::Expr::MacroExpr(_)) => true,
            Start::Other(ast::Expr::PathExpr(path)) => {
                let resolved = path.path().and_then(|path| self.sema.resolve_path(&path));
                matches!(resolved, Some(PathResolution::Def(ModuleDef::Function(_))))
            }
            Start::Other(ast::Expr::CallExpr(call)) => {
                let function = call.expr().and_then(|callee| target_function(self.sema, &callee));
                let body = function.and_then(|function| function.source(self.sema.db)?.value.body());
                let returned = body.and_then(|body| body.stmt_list()?.tail_expr());
                returned.is_some_and(|value| self.handled(&value, depth + 1))
            }
            Start::Other(_) => false,
        }
    }
}

/// The function a handler or router argument names, such as `show` or `talks::routes()`, also
/// through a local bound to it or `into_make_service()`.
fn target_function(sema: &Semantics<'_, RootDatabase>, expression: &ast::Expr) -> Option<Function> {
    match expression {
        ast::Expr::CallExpr(call) => target_function(sema, &call.expr()?),
        ast::Expr::MethodCallExpr(call) if call.name_ref()?.text().starts_with("into_make_service") => {
            target_function(sema, &call.receiver()?)
        }
        ast::Expr::PathExpr(path) => match sema.resolve_path(&path.path()?)? {
            PathResolution::Def(ModuleDef::Function(function)) => Some(function),
            PathResolution::Local(local) => target_function(sema, &let_value(sema, local)?),
            _ => None,
        },
        _ => None,
    }
}
