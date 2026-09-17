use std::collections::{HashMap, HashSet};
use std::path::Path;

use ra_ap_syntax::ast::{self, HasAttrs, HasGenericParams, HasModuleItem, HasName, VisibilityKind};
use ra_ap_syntax::{AstNode, Edition, SyntaxKind, SyntaxNode};
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
        let declarations = outline.declarations(&top_level(tree.items()));
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
    fn declarations(&self, items: &[ast::Item]) -> Vec<Declaration> {
        // A lookahead, so an impl block written before its type's declaration adds no external entry.
        let declared: HashSet<String> = items.iter().filter_map(type_name).map(|name| name.text().to_string()).collect();
        let mut declarations = Vec::new();
        // The entry that receives every member declared on a type name.
        let mut types = HashMap::new();
        for item in items {
            if let Some(name) = function_name(item) {
                declarations.push(Declaration::Function(self.symbol(name.syntax(), visibility(item.syntax()))));
            }
            if let Some(name) = type_name(item) {
                self.push_type(&mut declarations, &mut types, name.syntax(), visibility(item.syntax()));
            }
            // A type declared in another file gets one public entry, at its first impl block.
            if let ast::Item::Impl(block) = item
                && let Some(name) = impl_type(block)
                && !declared.contains(name.text().as_str())
                && !types.contains_key(name.text().as_str())
            {
                self.push_type(&mut declarations, &mut types, name.syntax(), "public");
            }
        }
        for item in items {
            let Some((owner, members)) = self.members(item) else { continue };
            if let Some(Declaration::Type(declaration)) = types.get(&owner).map(|&index| &mut declarations[index]) {
                declaration.members.extend(members);
            }
        }
        declarations
    }

    fn push_type(
        &self,
        declarations: &mut Vec<Declaration>,
        types: &mut HashMap<String, usize>,
        name: &SyntaxNode,
        visibility: &'static str,
    ) {
        types.entry(name.text().to_string()).or_insert(declarations.len());
        let symbol = self.symbol(name, visibility);
        declarations.push(Declaration::Type(TypeDeclaration { symbol, members: Vec::new() }));
    }

    /// The methods a trait definition or impl block declares, with the name of their type.
    fn members(&self, item: &ast::Item) -> Option<(String, Vec<Symbol>)> {
        let (owner, list, member_visibility) = match item {
            ast::Item::Trait(it) => (it.name()?.text().to_string(), it.assoc_item_list(), Some(visibility(it.syntax()))),
            ast::Item::Impl(it) => (impl_type(it)?.text().to_string(), it.assoc_item_list(), it.trait_().map(|_| "public")),
            _ => return None,
        };
        let functions = list.into_iter().flat_map(|list| list.assoc_items()).filter_map(|member| match member {
            ast::AssocItem::Fn(function) => Some(function),
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

/// Items directly in the file or in inline `mod` blocks, in source order.
fn top_level(items: impl Iterator<Item = ast::Item>) -> Vec<ast::Item> {
    items
        .filter(|item| !gated_by_test(item))
        .flat_map(|item| match &item {
            ast::Item::Module(module) => module.item_list().map_or_else(Vec::new, |list| top_level(list.items())),
            _ => vec![item],
        })
        .collect()
}

/// A `cfg` condition on `test` describes test code, which the scan does not read either.
fn gated_by_test(item: &ast::Item) -> bool {
    let conditions = item.attrs().filter(|attr| attr.path().is_some_and(|path| path.syntax().text() == "cfg"));
    conditions.filter_map(|attr| attr.token_tree()).any(|tree| {
        let mut tokens = tree.syntax().descendants_with_tokens().filter_map(|element| element.into_token());
        tokens.any(|token| token.kind() == SyntaxKind::IDENT && token.text() == "test")
    })
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

/// The type an impl block is for: a path that names a type, not one of the block's generic parameters.
fn impl_type(block: &ast::Impl) -> Option<ast::NameRef> {
    let ast::Type::PathType(path) = block.self_ty()? else {
        return None;
    };
    let name = path.path()?.segment()?.name_ref()?;
    let parameters = block.generic_param_list().into_iter().flat_map(|list| list.type_or_const_params());
    let generic = parameters.filter_map(|parameter| parameter.name()).any(|parameter| parameter.text() == name.text());
    (!generic).then_some(name)
}

fn visibility(item: &SyntaxNode) -> &'static str {
    match item.children().find_map(ast::Visibility::cast).map(|it| it.kind()) {
        Some(VisibilityKind::Pub) => "public",
        Some(VisibilityKind::PubCrate | VisibilityKind::PubSuper | VisibilityKind::In(_)) => "internal",
        Some(VisibilityKind::PubSelf) | None => "private",
    }
}
