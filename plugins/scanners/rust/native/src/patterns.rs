use serde_json::{Value, json};

/// The segments of a route pattern, in the syntax of any supported Rust router:
/// `:name` and `{name}` for one segment, `{*rest}`, `*rest`, `{name:.*}` and `<rest..>`
/// for the remainder, and `<name>` for one segment. A pattern the scanner cannot express
/// exactly, such as an actix regular expression, has no segments and is not reported.
pub fn segments(pattern: &str) -> Option<Vec<Value>> {
    let path = pattern.split(['?', '#']).next().unwrap_or_default();
    let pieces: Vec<&str> = path.split('/').filter(|piece| !piece.is_empty()).collect();
    let mut segments = Vec::new();
    for (index, piece) in pieces.iter().enumerate() {
        let segment = segment(piece)?;
        // The remaining segments can only be taken by the last one.
        if segment["kind"] == "catch-all" && index + 1 != pieces.len() {
            return None;
        }
        segments.push(segment);
    }
    Some(segments)
}

fn segment(piece: &str) -> Option<Value> {
    if let Some(name) = piece.strip_prefix(':') {
        return parameter("parameter", name);
    }
    if let Some(name) = piece.strip_prefix('*') {
        return parameter("catch-all", if name.is_empty() { "rest" } else { name });
    }
    if let Some(inner) = piece.strip_prefix('{').and_then(|piece| piece.strip_suffix('}')) {
        return braced(inner);
    }
    if let Some(inner) = piece.strip_prefix('<').and_then(|piece| piece.strip_suffix('>')) {
        return match inner.strip_suffix("..") {
            Some(name) => parameter("catch-all", name),
            None => parameter("parameter", inner),
        };
    }
    literal(piece)
}

/// `{name}`, the axum remainder `{*rest}`, and the actix tail `{name:.*}`.
fn braced(inner: &str) -> Option<Value> {
    if let Some(name) = inner.strip_prefix('*') {
        return parameter("catch-all", name);
    }
    match inner.split_once(':') {
        Some((name, ".*")) => parameter("catch-all", name),
        // Any other constraint is a pattern the fact format cannot state.
        Some(_) => None,
        None => parameter("parameter", inner),
    }
}

/// RFC 3986 path characters, which the observation contract requires of names and literals.
fn allowed(text: &str) -> bool {
    !text.is_empty() && text.bytes().all(|byte| byte.is_ascii_alphanumeric() || b"-._~!$&'()*+,;=:@%".contains(&byte))
}

fn parameter(kind: &str, name: &str) -> Option<Value> {
    allowed(name).then(|| json!({"kind": kind, "name": name}))
}

/// A literal segment states its own text; text mixed with a parameter is not expressible.
fn literal(piece: &str) -> Option<Value> {
    if piece.contains(['{', '}', '<', '>', '*']) || !allowed(piece) {
        return None;
    }
    Some(json!({"kind": "literal", "value": piece}))
}
