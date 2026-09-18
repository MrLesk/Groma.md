use serde_json::{Value, json};

/// The segments of a route pattern, in the syntax of any supported Rust router:
/// `:name`, `{name}` and `<name>` for one segment, `{*rest}` and `*rest` for the remainder,
/// Rocket's `<rest..>` for any remainder, also none, and actix's `{name:regex}`. A regular expression restricts its parameter, which is
/// then constrained; one that may match a slash, and a catch-all written before other segments,
/// stand for the rest of the path as a constrained optional catch-all. `{name:.*}` is a plain
/// optional catch-all and `{name:.+}` a plain catch-all. A pattern with a name or literal the
/// fact format cannot state has no segments and is not reported.
pub fn segments(pattern: &str) -> Option<Vec<Value>> {
    let pieces = split(pattern)?;
    let mut segments = Vec::new();
    for (index, piece) in pieces.iter().enumerate() {
        let mut segment = segment(piece)?;
        if segment["kind"] == "catch-all" {
            if index + 1 != pieces.len() {
                segment["optional"] = json!(true);
                segment["constrained"] = json!(true);
            }
            segments.push(segment);
            break;
        }
        segments.push(segment);
    }
    Some(segments)
}

/// The nonempty pieces between slashes, before the query and fragment. Slashes and `?` inside a
/// `{..}` regular expression belong to it. An unbalanced brace has no pieces.
fn split(pattern: &str) -> Option<Vec<&str>> {
    let mut pieces = Vec::new();
    let (mut depth, mut start) = (0usize, 0);
    for (index, character) in pattern.char_indices() {
        match character {
            '{' => depth += 1,
            '}' => depth = depth.checked_sub(1)?,
            '/' | '?' | '#' if depth == 0 => {
                pieces.push(&pattern[start..index]);
                start = index + 1;
                if character != '/' {
                    return (depth == 0).then(|| pieces.into_iter().filter(|piece| !piece.is_empty()).collect());
                }
            }
            _ => {}
        }
    }
    pieces.push(&pattern[start..]);
    (depth == 0).then(|| pieces.into_iter().filter(|piece| !piece.is_empty()).collect())
}

/// Literal text and placeholders of one segment, in order.
enum Part<'a> {
    Text(&'a str),
    Braced(&'a str),
    Angled(&'a str),
}

fn segment(piece: &str) -> Option<Value> {
    let parts = parts(piece)?;
    match parts.as_slice() {
        [Part::Braced(inner)] => braced(inner),
        // Rocket's `<rest..>` also matches no segment.
        [Part::Angled(inner)] => match inner.strip_suffix("..") {
            Some(name) => placeholder("catch-all", name, &["optional"]),
            None => placeholder("parameter", inner, &[]),
        },
        [Part::Text(text)] => plain(text),
        // Text mixed with a placeholder accepts only some segments.
        _ => mixed(&parts),
    }
}

fn parts(piece: &str) -> Option<Vec<Part<'_>>> {
    let mut parts = Vec::new();
    let mut rest = piece;
    while !rest.is_empty() {
        let (part, length) = if let Some(inner) = rest.strip_prefix('{') {
            let close = closing_brace(inner)?;
            (Part::Braced(&inner[..close]), close + 2)
        } else if let Some(inner) = rest.strip_prefix('<') {
            let close = inner.find('>')?;
            (Part::Angled(&inner[..close]), close + 2)
        } else {
            let end = rest.find(['{', '<']).unwrap_or(rest.len());
            (Part::Text(&rest[..end]), end)
        };
        parts.push(part);
        rest = &rest[length..];
    }
    Some(parts)
}

/// The index of the `}` that closes a placeholder, past braces its regular expression nests.
fn closing_brace(inner: &str) -> Option<usize> {
    let mut depth = 0usize;
    for (index, character) in inner.char_indices() {
        match character {
            '{' => depth += 1,
            '}' if depth == 0 => return Some(index),
            '}' => depth -= 1,
            _ => {}
        }
    }
    None
}

/// `:name`, `*rest`, or literal text.
fn plain(text: &str) -> Option<Value> {
    if let Some(name) = text.strip_prefix(':') {
        return placeholder("parameter", name, &[]);
    }
    if let Some(name) = text.strip_prefix('*') {
        return placeholder("catch-all", if name.is_empty() { "rest" } else { name }, &[]);
    }
    literal(text)
}

/// `{name}`, the axum remainder `{*rest}`, and actix's `{name:regex}`.
fn braced(inner: &str) -> Option<Value> {
    if let Some(name) = inner.strip_prefix('*') {
        return placeholder("catch-all", name, &[]);
    }
    let Some((name, regex)) = inner.split_once(':') else { return placeholder("parameter", inner, &[]) };
    match regex {
        ".*" => placeholder("catch-all", name, &["optional"]),
        ".+" => placeholder("catch-all", name, &[]),
        _ if spans(regex) => placeholder("catch-all", name, &["optional", "constrained"]),
        _ => placeholder("parameter", name, &["constrained"]),
    }
}

/// One constrained parameter named after the first placeholder, or the rest of the path when one
/// of its regular expressions may match a slash.
fn mixed(parts: &[Part<'_>]) -> Option<Value> {
    let regexes = parts.iter().filter_map(|part| match part {
        Part::Braced(inner) => inner.split_once(':').map(|(_, regex)| regex),
        _ => None,
    });
    let spanning = regexes.into_iter().any(spans);
    let name = parts.iter().find_map(|part| match part {
        Part::Braced(inner) => Some(inner.split(':').next().unwrap_or_default().trim_start_matches('*')),
        Part::Angled(inner) => Some(inner.trim_end_matches("..")),
        Part::Text(_) => None,
    })?;
    match spanning {
        true => placeholder("catch-all", name, &["optional", "constrained"]),
        false => placeholder("parameter", name, &["constrained"]),
    }
}

/// Whether a route regular expression may match a slash: any character, a slash, a negated
/// class, or a class such as `\S` that includes one.
fn spans(regex: &str) -> bool {
    let mut characters = regex.chars().peekable();
    while let Some(character) = characters.next() {
        let spanning = match character {
            '\\' => characters.next().is_some_and(|escaped| matches!(escaped, 'S' | 'W' | 'D' | 'p' | 'P' | '/')),
            '.' | '/' => true,
            '[' => characters.peek() == Some(&'^'),
            _ => false,
        };
        if spanning {
            return true;
        }
    }
    false
}

/// RFC 3986 path characters, which the observation contract requires of names and literals.
fn allowed(text: &str) -> bool {
    !text.is_empty() && text.bytes().all(|byte| byte.is_ascii_alphanumeric() || b"-._~!$&'()*+,;=:@%".contains(&byte))
}

fn placeholder(kind: &str, name: &str, flags: &[&str]) -> Option<Value> {
    let mut segment = json!({"kind": kind, "name": name});
    for flag in flags {
        segment[*flag] = json!(true);
    }
    allowed(name).then_some(segment)
}

/// A literal segment states its own text.
fn literal(piece: &str) -> Option<Value> {
    if piece.contains(['{', '}', '<', '>', '*']) || !allowed(piece) {
        return None;
    }
    Some(json!({"kind": "literal", "value": piece}))
}
