use std::collections::HashSet;

use ra_ap_syntax::{AstNode, SyntaxKind};
use ra_ap_syntax::ast::{self, HasArgList, HasAttrs, HasName};

use crate::text::{callee, first_argument, first_string};

const METHODS: [&str; 8] = ["get", "post", "put", "patch", "delete", "head", "options", "trace"];

/// Methods and handlers a method router states, such as `get(list).post(create)`.
pub fn method_handlers(expression: &ast::Expr) -> Vec<(String, ast::Expr)> {
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

fn call_method(call: &ast::CallExpr) -> Option<String> {
    method_of(callee(call).last()?)
}

fn method_of(name: &str) -> Option<String> {
    if name == "any" {
        return Some("*".to_owned());
    }
    METHODS.contains(&name).then(|| name.to_uppercase())
}

/// Routes an attribute macro declares, such as actix's and Rocket's `#[get("/talks/{id}")]`.
pub fn attribute_routes(function: &ast::Fn) -> Vec<(String, String)> {
    function
        .attrs()
        .filter_map(|attribute| {
            let name = attribute.path()?.segment()?.name_ref()?;
            let method = method_of(&name.text())?;
            Some((method, first_string(&attribute.token_tree()?)?))
        })
        .collect()
}

/// Whether a route attribute states Rocket's `rank`, which overrides the router's specificity.
pub fn ranked(function: &ast::Fn) -> bool {
    let routes = function.attrs().filter(|attribute| {
        let name = attribute.path().and_then(|path| path.segment()?.name_ref());
        name.is_some_and(|name| method_of(&name.text()).is_some())
    });
    let mut tokens = routes.filter_map(|attribute| attribute.token_tree()).flat_map(|tree| {
        tree.syntax().descendants_with_tokens().filter_map(|element| element.into_token()).collect::<Vec<_>>()
    });
    tokens.any(|token| token.kind() == SyntaxKind::IDENT && token.text() == "rank")
}

/// Parameters whose type is not `&str` or `String`.
pub fn typed_parameters(function: &ast::Fn) -> HashSet<String> {
    let parameters = function.param_list().into_iter().flat_map(|list| list.params());
    parameters
        .filter_map(|parameter| {
            let ast::Pat::IdentPat(pattern) = parameter.pat()? else { return None };
            let text = match parameter.ty() {
                Some(ast::Type::RefType(reference)) => reference.ty().map(|inner| inner.syntax().text().to_string()),
                other => other.map(|ty| ty.syntax().text().to_string()),
            };
            (text.as_deref() != Some("str") && text.as_deref() != Some("String")).then(|| pattern.name())?
        })
        .map(|name| name.text().to_string())
        .collect()
}
