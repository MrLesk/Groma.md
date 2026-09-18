use std::collections::HashMap;

use ra_ap_hir::{Function, Semantics};
use ra_ap_ide_db::RootDatabase;
use ra_ap_syntax::ast::{self, HasArgList};
use ra_ap_syntax::{AstNode, SyntaxNode};
use serde_json::{Value, json};

use crate::client::is_client;
use crate::scan::{Source, owned_nodes};
use crate::text::{callee, first_argument, literal_string, path_tail};
use crate::url::{Constants, request_path, url_parts};

/// Client calls that name their method, such as `client.get(url)` or `reqwest::get(url)`.
const METHODS: [&str; 7] = ["get", "post", "put", "patch", "delete", "head", "options"];

/// The HTTP requests the scanned functions send with a recognized client.
pub fn requests(
    sema: &Semantics<'_, RootDatabase>,
    names: &Constants,
    sources: &[Source],
    functions: &HashMap<Function, String>,
) -> Vec<Value> {
    let mut facts = Vec::new();
    for source in sources {
        for syntax in source.syntax.syntax().descendants().filter_map(ast::Fn::cast) {
            let (Some(function), Some(body)) = (sema.to_def(&syntax), syntax.body()) else { continue };
            let Some(operation) = functions.get(&function) else { continue };
            for node in owned_nodes(body.syntax()) {
                if let Some((method, url)) = client_call(sema, &node) {
                    let mut fact = request_path(&url_parts(sema, names, &url));
                    fact["operation"] = json!(operation);
                    if let Some(method) = method {
                        fact["method"] = json!(method);
                    }
                    facts.push(fact);
                }
            }
        }
    }
    facts
}

/// The method and URL of one recognized client call.
fn client_call(sema: &Semantics<'_, RootDatabase>, node: &SyntaxNode) -> Option<(Option<String>, ast::Expr)> {
    if let Some(call) = ast::CallExpr::cast(node.clone()) {
        return client_function(&call);
    }
    let call = ast::MethodCallExpr::cast(node.clone())?;
    let name = call.name_ref()?.text().to_string();
    let mut arguments = call.arg_list()?.args();
    if name == "uri" {
        // `Request::builder().method(GET).uri(url)` from hyper and http.
        let url = arguments.next()?;
        return builder(&call).then(|| (chain_method(&call), url));
    }
    if !sends(&call) || !is_client(sema, &call.receiver()?) {
        return None;
    }
    if name == "request" {
        let selected = arguments.next()?;
        return Some((method_name(&selected), arguments.next()?));
    }
    let method = METHODS.contains(&name.as_str()).then(|| name.to_uppercase())?;
    Some((Some(method), arguments.next()?))
}

/// `reqwest::get(url)` and `reqwest::blocking::get(url)` name both the client and the method.
fn client_function(call: &ast::CallExpr) -> Option<(Option<String>, ast::Expr)> {
    let path = callee(call);
    let name = path.last()?;
    if !path.iter().any(|part| part == "reqwest") || !METHODS.contains(&name.as_str()) {
        return None;
    }
    Some((Some(name.to_uppercase()), first_argument(call.arg_list())?))
}

/// A request is sent when its builder chain reaches `send`.
fn sends(call: &ast::MethodCallExpr) -> bool {
    chain(call).any(|outer| outer.name_ref().is_some_and(|name| name.text() == "send"))
}

/// A URI belongs to a request when a `Request::builder()` chain builds one.
fn builder(call: &ast::MethodCallExpr) -> bool {
    let names: Vec<String> = receivers(call).collect();
    names.iter().any(|name| name == "Request") && names.iter().any(|name| name == "builder")
}

/// The method a `method(...)` call in the same chain states.
fn chain_method(call: &ast::MethodCallExpr) -> Option<String> {
    let calls = chain(call).chain(receiver_calls(call));
    calls
        .filter(|other| other.name_ref().is_some_and(|name| name.text() == "method"))
        .find_map(|other| method_name(&first_argument(other.arg_list())?))
}

/// An uppercase method from `Method::GET` or from a literal such as `"GET"`.
fn method_name(expression: &ast::Expr) -> Option<String> {
    let name = path_tail(expression).or_else(|| literal_string(expression))?;
    let method = name.to_uppercase();
    (name == method && name.bytes().all(|byte| byte.is_ascii_uppercase())).then_some(method)
}

/// The calls this call's value flows into as their receiver, such as `send` in
/// `client.get(url).send()`. A value passed as an argument starts a chain of its own.
fn chain(call: &ast::MethodCallExpr) -> impl Iterator<Item = ast::MethodCallExpr> {
    let mut current = call.syntax().clone();
    std::iter::from_fn(move || {
        loop {
            let parent = current.parent()?;
            if let Some(outer) = ast::MethodCallExpr::cast(parent.clone()) {
                let receives = outer.receiver().is_some_and(|receiver| receiver.syntax() == &current);
                current = parent;
                return receives.then_some(outer);
            }
            // `await`, `?` and parentheses keep the same value.
            if !passes_through(&parent) {
                return None;
            }
            current = parent;
        }
    })
}

fn passes_through(node: &SyntaxNode) -> bool {
    ast::AwaitExpr::can_cast(node.kind()) || ast::TryExpr::can_cast(node.kind()) || ast::ParenExpr::can_cast(node.kind())
}

/// The calls this call's receiver is built from, innermost last.
fn receiver_calls(call: &ast::MethodCallExpr) -> impl Iterator<Item = ast::MethodCallExpr> {
    let mut current = call.receiver();
    std::iter::from_fn(move || {
        loop {
            match current.take()? {
                ast::Expr::MethodCallExpr(inner) => {
                    current = inner.receiver();
                    return Some(inner);
                }
                ast::Expr::AwaitExpr(pending) => current = pending.expr(),
                ast::Expr::TryExpr(attempt) => current = attempt.expr(),
                ast::Expr::ParenExpr(paren) => current = paren.expr(),
                _ => return None,
            }
        }
    })
}

/// Names of the calls and paths the receiver chain is built from, such as `builder`.
fn receivers(call: &ast::MethodCallExpr) -> impl Iterator<Item = String> {
    let mut current = call.receiver();
    let mut pending: Vec<String> = Vec::new();
    std::iter::from_fn(move || {
        loop {
            if let Some(name) = pending.pop() {
                return Some(name);
            }
            match current.take()? {
                ast::Expr::MethodCallExpr(inner) => {
                    let name = inner.name_ref().map(|name| name.text().to_string());
                    current = inner.receiver();
                    if let Some(name) = name {
                        return Some(name);
                    }
                }
                ast::Expr::CallExpr(inner) => {
                    let names = inner.expr().and_then(|expression| match expression {
                        ast::Expr::PathExpr(path) => path.path(),
                        _ => None,
                    });
                    pending = names
                        .into_iter()
                        .flat_map(|path| path.syntax().descendants().filter_map(ast::NameRef::cast))
                        .map(|part| part.text().to_string())
                        .collect();
                    current = None;
                }
                ast::Expr::AwaitExpr(pending_value) => current = pending_value.expr(),
                ast::Expr::TryExpr(attempt) => current = attempt.expr(),
                ast::Expr::ParenExpr(paren) => current = paren.expr(),
                _ => return None,
            }
        }
    })
}
