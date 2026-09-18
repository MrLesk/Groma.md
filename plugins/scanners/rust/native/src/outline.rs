use std::collections::{HashMap, HashSet};
use std::path::Path;

use ra_ap_syntax::ast::{self, HasAttrs, HasGenericParams, HasModuleItem, HasName, VisibilityKind};
use ra_ap_syntax::{AstNode, Edition, SyntaxElement, SyntaxKind, SyntaxNode};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::text::line;

#[derive(Deserialize)]
pub struct Input {
    root: String,
    references: Vec<Reference>,
}

#[derive(Deserialize)]
struct Reference {
    file: String,
    symbols: Vec<String>,
}

#[derive(Serialize)]
struct Symbol {
    name: String,
    line: usize,
    visibility: &'static str,
    entry: bool,
}

#[derive(Serialize)]
struct TypeDeclaration {
    #[serde(flatten)]
    symbol: Symbol,
    members: Vec<Symbol>,
}

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
enum Declaration {
    Function(Symbol),
    Type(TypeDeclaration),
}

/// Source outline of each referenced file, parsed alone: no Cargo project or crate graph.
pub fn outline(input: Input) -> anyhow::Result<Value> {
    let mut files = Vec::new();
    for reference in &input.references {
        let text = std::fs::read_to_string(Path::new(&input.root).join(&reference.file))?;
        // A file alone has no crate edition; the 2021 grammar reads current Rust.
        let tree = ast::SourceFile::parse(&text, Edition::Edition2021).tree();
        let outline = Outline { text: &text, symbols: &reference.symbols };
        let declarations = outline.declarations(&top_level(tree.items(), &[]));
        if !declarations.is_empty() {
            files.push(json!({"file": reference.file, "declarations": serde_json::to_value(declarations)?}));
        }
    }
    Ok(Value::Array(files))
}

struct Outline<'a> {
    text: &'a str,
    /// Symbols the Code reference names.
    symbols: &'a [String],
}

impl Outline<'_> {
    fn declarations(&self, items: &[Scoped]) -> Vec<Declaration> {
        // A lookahead, so an impl block written before its type's declaration adds no external entry.
        let declared: HashSet<Vec<String>> =
            items.iter().filter_map(|scoped| Some(scoped.key(&type_name(&scoped.item)?))).collect();
        let mut declarations = Vec::new();
        // The entry that receives every member declared on a type.
        let mut types = HashMap::new();
        for scoped in items {
            let item = &scoped.item;
            if let Some(name) = function_name(item) {
                declarations.push(Declaration::Function(self.symbol(name.syntax(), visibility(item.syntax()))));
            }
            if let Some(name) = type_name(item) {
                let key = scoped.key(&name);
                self.push_type(&mut declarations, &mut types, key, name.syntax(), visibility(item.syntax()));
            }
            // A type declared elsewhere gets one public entry, at its first impl block.
            if let ast::Item::Impl(block) = item
                && let Some((owner, name)) = impl_owner(block, &scoped.module, &declared)
                && !declared.contains(&owner)
            {
                self.push_type(&mut declarations, &mut types, owner, name.syntax(), "public");
            }
        }
        for scoped in items {
            let Some((owner, members)) = self.members(scoped, &declared) else { continue };
            if let Some(Declaration::Type(declaration)) = types.get(&owner).map(|&index| &mut declarations[index]) {
                declaration.members.extend(members);
            }
        }
        declarations
    }

    fn push_type(
        &self,
        declarations: &mut Vec<Declaration>,
        types: &mut HashMap<Vec<String>, usize>,
        key: Vec<String>,
        name: &SyntaxNode,
        visibility: &'static str,
    ) {
        // A type declared twice in one module, such as under different `cfg` conditions, is listed once.
        if types.contains_key(&key) {
            return;
        }
        types.insert(key, declarations.len());
        let symbol = self.symbol(name, visibility);
        declarations.push(Declaration::Type(TypeDeclaration { symbol, members: Vec::new() }));
    }

    /// The methods a trait definition or impl block declares, with the key of their type.
    fn members(&self, scoped: &Scoped, declared: &HashSet<Vec<String>>) -> Option<(Vec<String>, Vec<Symbol>)> {
        let (owner, list, member_visibility) = match &scoped.item {
            ast::Item::Trait(it) => (scoped.key(&it.name()?), it.assoc_item_list(), Some(visibility(it.syntax()))),
            ast::Item::Impl(it) => {
                (impl_owner(it, &scoped.module, declared)?.0, it.assoc_item_list(), it.trait_().map(|_| "public"))
            }
            _ => return None,
        };
        let functions = list.into_iter().flat_map(|list| list.assoc_items()).filter_map(|member| match member {
            ast::AssocItem::Fn(function) if !gated_by_test(&function) => Some(function),
            _ => None,
        });
        let members = functions
            .filter_map(|function| {
                let access = member_visibility.unwrap_or_else(|| visibility(function.syntax()));
                Some(self.symbol(function.name()?.syntax(), access))
            })
            .collect();
        Some((owner, members))
    }

    fn symbol(&self, name: &SyntaxNode, visibility: &'static str) -> Symbol {
        let text = name.text().to_string();
        Symbol {
            line: line(self.text, name.text_range().start()),
            visibility,
            entry: self.symbols.contains(&text),
            name: text,
        }
    }
}

/// An item directly in the file or in an inline `mod` block.
struct Scoped {
    /// The names of the inline modules around the item, outermost first.
    module: Vec<String>,
    item: ast::Item,
}

impl Scoped {
    /// A declared type's identity in the file: its module path and name.
    fn key(&self, name: &ast::Name) -> Vec<String> {
        [self.module.clone(), vec![name.text().to_string()]].concat()
    }
}

/// Items directly in the file or in inline `mod` blocks, in source order.
fn top_level(items: impl Iterator<Item = ast::Item>, module: &[String]) -> Vec<Scoped> {
    items
        .filter(|item| !gated_by_test(item))
        .flat_map(|item| match &item {
            ast::Item::Module(inline) => match (inline.name(), inline.item_list()) {
                (Some(name), Some(list)) => top_level(list.items(), &[module, &[name.text().to_string()]].concat()),
                _ => Vec::new(),
            },
            _ => vec![Scoped { module: module.to_vec(), item }],
        })
        .collect()
}

/// Test code, which the scan does not read either: an item whose `cfg` condition requires `test`.
fn gated_by_test(node: &impl HasAttrs) -> bool {
    let conditions = node.attrs().filter(|attr| attr.path().is_some_and(|path| path.syntax().text() == "cfg"));
    let mut predicates = conditions.filter_map(|attr| attr.token_tree()).map(|tree| arguments(&tree));
    predicates.any(|arguments| arguments.first().is_some_and(|predicate| requires_test(predicate)))
}

/// `test` itself, or `all(...)` with an argument that requires `test`.
fn requires_test(predicate: &[SyntaxElement]) -> bool {
    let named = |element: &SyntaxElement, name: &str| element.as_token().is_some_and(|token| token.text() == name);
    match predicate {
        [condition] => named(condition, "test"),
        [condition, nested] if named(condition, "all") => {
            let tree = nested.as_node().cloned().and_then(ast::TokenTree::cast);
            tree.is_some_and(|tree| arguments(&tree).iter().any(|argument| requires_test(argument)))
        }
        _ => false,
    }
}

/// The comma-separated arguments inside a parenthesized token tree.
fn arguments(tree: &ast::TokenTree) -> Vec<Vec<SyntaxElement>> {
    let elements: Vec<SyntaxElement> = tree
        .syntax()
        .children_with_tokens()
        .filter(|element| !element.kind().is_trivia())
        .filter(|element| !matches!(element.kind(), SyntaxKind::L_PAREN | SyntaxKind::R_PAREN))
        .collect();
    let groups = elements.split(|element| element.kind() == SyntaxKind::COMMA);
    groups.filter(|group| !group.is_empty()).map(<[_]>::to_vec).collect()
}

/// A top-level fn, or a closure written directly as a `const` or `static` value.
fn function_name(item: &ast::Item) -> Option<ast::Name> {
    match item {
        ast::Item::Fn(it) => it.name(),
        ast::Item::Const(it) if matches!(it.body(), Some(ast::Expr::ClosureExpr(_))) => it.name(),
        ast::Item::Static(it) if matches!(it.body(), Some(ast::Expr::ClosureExpr(_))) => it.name(),
        _ => None,
    }
}

/// Structs, enums, unions and traits; type and trait aliases are not types in the outline.
fn type_name(item: &ast::Item) -> Option<ast::Name> {
    match item {
        ast::Item::Struct(it) => it.name(),
        ast::Item::Enum(it) => it.name(),
        ast::Item::Union(it) => it.name(),
        ast::Item::Trait(it) => it.name(),
        _ => None,
    }
}

/// The type an impl block is for and its name. The path is read from the block's module: `self` and
/// `super` step through the file's modules, and the rest is looked up from that module outward, so a
/// module that imports its parent's names still reaches them. A path naming no type the file declares
/// is keyed by that rest. A `crate` path is never resolved, because a file parsed alone does not know
/// its module path. A generic parameter is not a type.
fn impl_owner(
    block: &ast::Impl,
    module: &[String],
    declared: &HashSet<Vec<String>>,
) -> Option<(Vec<String>, ast::NameRef)> {
    let ast::Type::PathType(path) = block.self_ty()? else {
        return None;
    };
    let segments: Vec<ast::NameRef> = path.path()?.segments().map(|segment| segment.name_ref()).collect::<Option<_>>()?;
    let written: Vec<String> = segments.iter().map(|segment| segment.text().to_string()).collect();
    let parameters = block.generic_param_list().into_iter().flat_map(|list| list.type_or_const_params());
    let first = written.first()?;
    if parameters.filter_map(|parameter| parameter.name()).any(|parameter| parameter.text() == first.as_str()) {
        return None;
    }
    Some((owner_key(module, &written, declared), segments.last()?.clone()))
}

fn owner_key(module: &[String], written: &[String], declared: &HashSet<Vec<String>>) -> Vec<String> {
    let mut base = module.to_vec();
    let mut path = written;
    while let Some((first, rest)) = path.split_first() {
        match first.as_str() {
            "self" => {}
            "super" if !base.is_empty() => {
                base.pop();
            }
            _ => break,
        }
        path = rest;
    }
    let mut candidates = (0..=base.len()).rev().map(|depth| [&base[..depth], path].concat());
    candidates.find(|key| declared.contains(key)).unwrap_or_else(|| path.to_vec())
}

fn visibility(item: &SyntaxNode) -> &'static str {
    match item.children().find_map(ast::Visibility::cast).map(|it| it.kind()) {
        Some(VisibilityKind::Pub) => "public",
        Some(VisibilityKind::PubCrate | VisibilityKind::PubSuper | VisibilityKind::In(_)) => "internal",
        Some(VisibilityKind::PubSelf) | None => "private",
    }
}
