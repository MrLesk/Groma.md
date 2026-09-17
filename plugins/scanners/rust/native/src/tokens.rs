use std::collections::HashMap;

use ra_ap_hir::{Local, PathResolution, Semantics};
use ra_ap_ide_db::RootDatabase;
use ra_ap_syntax::{AstNode, SyntaxKind, SyntaxNode, SyntaxToken, T, ast, ast::HasName};

/// Grouping and separator punctuation is dropped, as in the TypeScript tokenizer,
/// so `(a + b) * c` and `a + b * c` produce the same tokens.
const DROPPED: [SyntaxKind; 12] = [
    T!['('], T![')'], T!['['], T![']'], T!['{'], T!['}'],
    T![,], T![;], T![:], T![::], T![=>], T![->],
];

/// Binding-normalized tokens of one function body. Parameters and other local bindings
/// become `$n` slots in order of first appearance; all other tokens keep their text.
pub fn operation_tokens(
    sema: &Semantics<'_, RootDatabase>,
    function: &ast::Fn,
    body: &ast::BlockExpr,
) -> Vec<String> {
    let mut body_tokens = BodyTokens {
        sema,
        slots: HashMap::new(),
        slot_by_name: HashMap::new(),
        after_dot: false,
        tokens: Vec::new(),
    };
    // Parameters take the first slots without adding tokens, so renamed parameters still match.
    let parameters = function.param_list().into_iter().flat_map(|list| list.params());
    for pattern in parameters.filter_map(|parameter| parameter.pat()) {
        for binding in pattern.syntax().descendants().filter_map(ast::IdentPat::cast) {
            body_tokens.bind(&binding);
        }
    }
    let elements = body.syntax().descendants_with_tokens();
    for token in elements.filter_map(|element| element.into_token()) {
        body_tokens.push(&token);
    }
    body_tokens.tokens
}

struct BodyTokens<'a, 'db> {
    sema: &'a Semantics<'db, RootDatabase>,
    slots: HashMap<Local, usize>,
    /// The latest slot of each local name, for names inside macro arguments.
    slot_by_name: HashMap<String, usize>,
    /// The previous token was a `.`; it joins the member name that follows it.
    after_dot: bool,
    tokens: Vec<String>,
}

impl BodyTokens<'_, '_> {
    fn push(&mut self, token: &SyntaxToken) {
        let kind = token.kind();
        if kind.is_trivia() {
            return;
        }
        let after_dot = std::mem::take(&mut self.after_dot);
        if kind == T![.] {
            // Macro arguments hold `..` as two `.` tokens.
            if after_dot {
                self.tokens.push("..".to_owned());
            } else {
                self.after_dot = true;
            }
            return;
        }
        let text = match kind {
            T!['('] if token.parent().is_some_and(|parent| ast::ArgList::can_cast(parent.kind())) => {
                "call".to_owned()
            }
            _ if DROPPED.contains(&kind) => return,
            SyntaxKind::IDENT if !after_dot => self.identifier(token),
            _ => token.text().to_owned(),
        };
        self.tokens.push(if after_dot { format!(".{text}") } else { text });
    }

    fn identifier(&mut self, token: &SyntaxToken) -> String {
        let text = token.text();
        match token.parent().and_then(|parent| self.local_slot(&parent, text)) {
            Some(slot) => format!("${slot}"),
            None => text.to_owned(),
        }
    }

    /// The slot of the local this identifier binds or reads, if any.
    fn local_slot(&mut self, parent: &SyntaxNode, name: &str) -> Option<usize> {
        match parent.kind() {
            SyntaxKind::NAME => self.bind(&ast::IdentPat::cast(parent.parent()?)?),
            // A local is only read after its binding, so other names need no resolution.
            SyntaxKind::NAME_REF if self.slot_by_name.contains_key(name) => {
                match self.sema.resolve_path(&local_path(parent)?)? {
                    PathResolution::Local(local) => Some(self.slot(local)),
                    _ => None,
                }
            }
            // Macro arguments are raw token trees; names there match earlier bindings by text.
            SyntaxKind::TOKEN_TREE => self.slot_by_name.get(name).copied(),
            _ => None,
        }
    }

    /// The slot of a local binding. Its name refers to that slot in later macro arguments.
    fn bind(&mut self, pattern: &ast::IdentPat) -> Option<usize> {
        let name = pattern.name()?;
        let text = name.text();
        // Without the standard library, the engine reads unresolved names such as `None` or a
        // glob-imported `Less` as bindings. By Rust convention these are variants or constants.
        if text.as_str().starts_with(char::is_uppercase) {
            return None;
        }
        let local = self.sema.to_def(pattern)?;
        let slot = self.slot(local);
        self.slot_by_name.insert(text.as_str().to_owned(), slot);
        Some(slot)
    }

    fn slot(&mut self, local: Local) -> usize {
        let next = self.slots.len();
        *self.slots.entry(local).or_insert(next)
    }
}

/// The single-segment path expression a name reference forms: the only place a local is read.
fn local_path(name_ref: &SyntaxNode) -> Option<ast::Path> {
    let path = ast::PathSegment::cast(name_ref.parent()?)?.parent_path();
    let expression = ast::PathExpr::can_cast(path.syntax().parent()?.kind());
    (expression && path.qualifier().is_none()).then_some(path)
}
