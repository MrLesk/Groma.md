use std::collections::{HashMap, HashSet};

use ra_ap_hir::{HasSource, ModuleDef, PathResolution, Semantics};
use ra_ap_ide_db::RootDatabase;
use ra_ap_syntax::ast::{self, HasArgList, HasName};
use ra_ap_syntax::{AstNode, SyntaxKind, SyntaxNode, SyntaxToken, T};
use serde_json::{Value, json};

use crate::text::{bound_names, macro_arguments, string_value, token_string};

/// How much of a URL the source proves.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Part {
    /// Text the source states, or that the scanner resolves to a literal.
    Text(String),
    /// A named value the scanner cannot see, such as a setting or a constant declared elsewhere.
    Named,
    /// A value the source computes.
    Computed,
}

/// Literal text of the crate's constants, by name; a name declared twice is left out.
pub type Constants = HashMap<String, Option<String>>;

const DEPTH: usize = 8;

/// Literal string values of every `const` and `static` in the scanned sources.
pub fn constants(files: impl Iterator<Item = SyntaxNode>) -> Constants {
    let mut result: Constants = HashMap::new();
    for file in files {
        for item in file.descendants() {
            let (Some(name), Some(body)) = declared_value(&item) else { continue };
            let text = match body {
                ast::Expr::Literal(literal) => string_value(&literal),
                _ => None,
            };
            result
                .entry(name)
                .and_modify(|known| {
                    if *known != text {
                        *known = None;
                    }
                })
                .or_insert(text);
        }
    }
    result
}

fn declared_value(item: &SyntaxNode) -> (Option<String>, Option<ast::Expr>) {
    if let Some(constant) = ast::Const::cast(item.clone()) {
        return (constant.name().map(|name| name.text().to_string()), constant.body());
    }
    match ast::Static::cast(item.clone()) {
        Some(item) => (item.name().map(|name| name.text().to_string()), item.body()),
        None => (None, None),
    }
}

/// The URL an expression builds, as far as the source proves its text.
pub fn url_parts(sema: &Semantics<'_, RootDatabase>, names: &Constants, expression: &ast::Expr) -> Vec<Part> {
    parts(sema, names, expression, 0)
}

/// The literal text of an expression, for a route path or a prefix.
pub fn literal_path(sema: &Semantics<'_, RootDatabase>, names: &Constants, expression: &ast::Expr) -> Option<String> {
    match url_parts(sema, names, expression).as_slice() {
        [Part::Text(text)] => Some(text.clone()),
        _ => None,
    }
}

fn parts(sema: &Semantics<'_, RootDatabase>, names: &Constants, expression: &ast::Expr, depth: usize) -> Vec<Part> {
    if depth > DEPTH {
        return computed();
    }
    let nested = |inner: Option<ast::Expr>| inner.map_or_else(computed, |inner| parts(sema, names, &inner, depth + 1));
    match expression {
        ast::Expr::Literal(literal) => string_value(literal).map_or_else(computed, |text| vec![Part::Text(text)]),
        // `&url` and `url.to_string()` pass the same text through.
        ast::Expr::RefExpr(reference) => nested(reference.expr()),
        ast::Expr::ParenExpr(paren) => nested(paren.expr()),
        ast::Expr::TryExpr(attempt) => nested(attempt.expr()),
        ast::Expr::AwaitExpr(pending) => nested(pending.expr()),
        ast::Expr::BinExpr(binary) => concatenation(sema, names, binary, depth),
        ast::Expr::MethodCallExpr(call) => nested(pass_through(call)),
        ast::Expr::CallExpr(call) => nested(conversion(call)),
        ast::Expr::MacroExpr(call) => call.macro_call().map_or_else(computed, |call| template(names, &call)),
        ast::Expr::PathExpr(path) => named_value(sema, names, path, depth),
        // A field read is a named value, such as `self.base`.
        ast::Expr::FieldExpr(_) => vec![Part::Named],
        _ => computed(),
    }
}

fn computed() -> Vec<Part> {
    vec![Part::Computed]
}

fn concatenation(sema: &Semantics<'_, RootDatabase>, names: &Constants, binary: &ast::BinExpr, depth: usize) -> Vec<Part> {
    let sum = binary.op_token().is_some_and(|token| token.kind() == T![+]);
    match (sum, binary.lhs(), binary.rhs()) {
        (true, Some(left), Some(right)) => {
            let mut result = parts(sema, names, &left, depth + 1);
            result.extend(parts(sema, names, &right, depth + 1));
            result
        }
        _ => computed(),
    }
}

const PASS_THROUGH: [&str; 7] = ["to_string", "to_owned", "into", "as_str", "as_ref", "clone", "to_str"];

/// The receiver of a call that keeps the text, such as `url.to_string()`.
fn pass_through(call: &ast::MethodCallExpr) -> Option<ast::Expr> {
    let name = call.name_ref()?;
    PASS_THROUGH.contains(&name.text().as_str()).then(|| call.receiver())?
}

/// The argument of a conversion that keeps the text, such as `String::from(url)`.
fn conversion(call: &ast::CallExpr) -> Option<ast::Expr> {
    let ast::Expr::PathExpr(path) = call.expr()? else { return None };
    let name = path.path()?.segment()?.name_ref()?;
    (name.text() == "from").then_some(())?;
    call.arg_list()?.args().next()
}

/// A path that resolves to a constant, a static or a `let` bound once reads as its literal text.
fn named_value(sema: &Semantics<'_, RootDatabase>, names: &Constants, path: &ast::PathExpr, depth: usize) -> Vec<Part> {
    match resolved_value(sema, path) {
        Some(value) => parts(sema, names, &value, depth + 1),
        None => vec![Part::Named],
    }
}

fn resolved_value(sema: &Semantics<'_, RootDatabase>, path: &ast::PathExpr) -> Option<ast::Expr> {
    let db = sema.db;
    match sema.resolve_path(&path.path()?)? {
        PathResolution::Def(ModuleDef::Const(item)) => item.source(db)?.value.body(),
        PathResolution::Def(ModuleDef::Static(item)) if !item.is_mut(db) => item.source(db)?.value.body(),
        PathResolution::Local(local) if !local.is_mut(db) => {
            let pattern = local.primary_source(db).as_ident_pat()?.clone();
            ast::LetStmt::cast(pattern.syntax().parent()?)?.initializer()
        }
        _ => None,
    }
}

/// `format!` contributes its template text, with one part per placeholder.
fn template(names: &Constants, call: &ast::MacroCall) -> Vec<Part> {
    let macro_name = call.path().and_then(|path| path.segment()).and_then(|segment| segment.name_ref());
    if macro_name.is_none_or(|name| name.text() != "format") {
        return computed();
    }
    let Some(tree) = call.token_tree() else { return computed() };
    let arguments = macro_arguments(tree.syntax());
    let Some(first) = arguments.first().and_then(|tokens| token_string(tokens)) else {
        return computed();
    };
    let mut positional = arguments[1..].iter();
    let shadowed = bound_names(call.syntax());
    placeholders(&first).into_iter().map(|part| fill(part, names, &shadowed, &mut positional)).collect()
}

/// A placeholder reads as a constant's text when the source names one, and stays a value otherwise.
fn fill<'a>(
    part: Placeholder,
    names: &Constants,
    shadowed: &HashSet<String>,
    positional: &mut impl Iterator<Item = &'a Vec<SyntaxToken>>,
) -> Part {
    match part {
        Placeholder::Text(text) => Part::Text(text),
        Placeholder::Named(name) => constant(&name, names, shadowed).map_or(Part::Named, Part::Text),
        Placeholder::Positional => match positional.next().map(|tokens| argument_part(tokens, names, shadowed)) {
            Some(part) => part,
            None => Part::Named,
        },
    }
}

/// The text of a crate constant, unless the enclosing function binds that name itself.
fn constant(name: &str, names: &Constants, shadowed: &HashSet<String>) -> Option<String> {
    if shadowed.contains(name) {
        return None;
    }
    names.get(name)?.clone()
}

/// A positional argument reads as a constant's text, a plain name, or a computed value.
fn argument_part(tokens: &[SyntaxToken], names: &Constants, shadowed: &HashSet<String>) -> Part {
    if let [single] = tokens
        && single.kind() == SyntaxKind::IDENT
        && let Some(text) = constant(single.text(), names, shadowed)
    {
        return Part::Text(text);
    }
    let plain = tokens
        .iter()
        .all(|token| matches!(token.kind(), SyntaxKind::IDENT | T![.] | T![::] | T![self] | T![&] | T![*]));
    if plain { Part::Named } else { Part::Computed }
}

enum Placeholder {
    Text(String),
    Named(String),
    Positional,
}

/// Text pieces and placeholders of one format template, in source order.
fn placeholders(template: &str) -> Vec<Placeholder> {
    let mut result = Vec::new();
    let mut text = String::new();
    let mut rest = template;
    while let Some(open) = rest.find('{') {
        text.push_str(&rest[..open]);
        rest = &rest[open..];
        if let Some(escaped) = rest.strip_prefix("{{") {
            text.push('{');
            rest = escaped;
            continue;
        }
        let Some(close) = rest.find('}') else { break };
        if !text.is_empty() {
            result.push(Placeholder::Text(std::mem::take(&mut text)));
        }
        let field = rest[1..close].split(':').next().unwrap_or_default();
        result.push(if field.is_empty() || field.bytes().all(|byte| byte.is_ascii_digit()) {
            Placeholder::Positional
        } else {
            Placeholder::Named(field.to_owned())
        });
        rest = &rest[close + 1..];
    }
    text.push_str(rest);
    if !text.is_empty() {
        result.push(Placeholder::Text(text));
    }
    result
}

/// RFC 3986 path characters, which the observation contract requires of literal text.
fn encoded(text: &str) -> String {
    let allowed = |byte: u8| byte.is_ascii_alphanumeric() || b"-._~!$&'()*+,;=:@%".contains(&byte);
    let mut result = String::new();
    for byte in text.bytes() {
        if allowed(byte) {
            result.push(char::from(byte));
        } else {
            result.push_str(&format!("%{byte:02X}"));
        }
    }
    result
}

#[derive(PartialEq, Eq)]
enum Base {
    None,
    Configured,
    Unknown,
}

/// The request path a URL's parts describe, with `configured` set when it follows a setting.
pub fn request_path(parts: &[Part]) -> Value {
    let (base, rest) = base(parts);
    let mut segments = if base == Base::Unknown { vec![json!({"kind": "unknown"})] } else { Vec::new() };
    segments.extend(path_segments(rest));
    let mut fact = json!({"path": segments});
    if base == Base::Configured {
        fact["configured"] = json!(true);
    }
    fact
}

/// What precedes the path: nothing, a setting the scanner cannot see, or a base it cannot use.
fn base(parts: &[Part]) -> (Base, &[Part]) {
    match parts.first() {
        Some(Part::Text(text)) if authority(text) => (Base::Unknown, parts),
        Some(Part::Named) if follows_path(&parts[1..]) => (Base::Configured, &parts[1..]),
        Some(Part::Named | Part::Computed) => (Base::Unknown, &parts[1..]),
        _ => (Base::None, parts),
    }
}

/// A scheme or `//` means the URL leaves this application's root.
fn authority(text: &str) -> bool {
    text.starts_with("//")
        || text.split_once("://").is_some_and(|(scheme, _)| {
            !scheme.is_empty() && scheme.bytes().all(|byte| byte.is_ascii_alphanumeric() || b"+-.".contains(&byte))
        })
}

fn follows_path(rest: &[Part]) -> bool {
    matches!(rest.first(), Some(Part::Text(text)) if text.starts_with('/'))
}

/// Path segments of the parts after the base, cut before the query and fragment.
fn path_segments(parts: &[Part]) -> Vec<Value> {
    let mut segments = Vec::new();
    let mut pieces: Vec<Part> = Vec::new();
    for part in parts {
        let Part::Text(text) = part else {
            pieces.push(part.clone());
            continue;
        };
        let text = strip_authority(text);
        let (text, ends) = match text.find(['?', '#']) {
            Some(end) => (&text[..end], true),
            None => (text, false),
        };
        for (index, piece) in text.split('/').enumerate() {
            if index > 0 {
                flush(&mut segments, &mut pieces);
            }
            if !piece.is_empty() {
                pieces.push(Part::Text(piece.to_owned()));
            }
        }
        if ends {
            break;
        }
    }
    flush(&mut segments, &mut pieces);
    segments
}

/// A literal host is reported as unknown; its path continues after the authority.
fn strip_authority(text: &str) -> &str {
    if !authority(text) {
        return text;
    }
    let rest = text.split_once("://").map_or_else(|| text.trim_start_matches('/'), |(_, rest)| rest);
    rest.find('/').map_or("", |slash| &rest[slash..])
}

fn flush(segments: &mut Vec<Value>, pieces: &mut Vec<Part>) {
    let taken = std::mem::take(pieces);
    match taken.as_slice() {
        [] => {}
        [Part::Named | Part::Computed] => segments.push(json!({"kind": "dynamic"})),
        parts if parts.iter().all(|part| matches!(part, Part::Text(_))) => {
            let text: String = parts.iter().filter_map(|part| match part {
                Part::Text(text) => Some(text.as_str()),
                _ => None,
            }).collect();
            segments.push(json!({"kind": "literal", "value": encoded(&text)}));
        }
        _ => segments.push(json!({"kind": "unknown"})),
    }
}

