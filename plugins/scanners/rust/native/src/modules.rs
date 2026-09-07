use crate::{
    index::{Context, Index, Kind, conditional, is_test, name},
    model::{File, Observation, Relationship, Result},
    source::Sources,
};
use std::{collections::BTreeSet, path::PathBuf};
use syn::{Attribute, Item, UseTree};

fn attribute_path(attrs: &[Attribute]) -> Option<String> {
    attrs.iter().find_map(|attr| {
        if !attr.path().is_ident("path") {
            return None;
        }
        let syn::Meta::NameValue(meta) = &attr.meta else {
            return None;
        };
        let syn::Expr::Lit(value) = &meta.value else {
            return None;
        };
        let syn::Lit::Str(path) = &value.lit else {
            return None;
        };
        Some(path.value())
    })
}
fn module_directory(file: &std::path::Path) -> PathBuf {
    let base = file.parent().unwrap_or(file);
    if file.file_name().and_then(|f| f.to_str()) == Some("mod.rs") {
        base.to_owned()
    } else {
        base.join(file.file_stem().unwrap_or_default())
    }
}
fn module_source(sources: &Sources, context: &Context, item: &syn::ItemMod) -> Result<PathBuf> {
    if let Some(path) = attribute_path(&item.attrs) {
        let base = if context.inline {
            &context.directory
        } else {
            context.file.parent().ok_or("source has no parent")?
        };
        return sources.checked(&base.join(path));
    }
    let file = context.directory.join(format!("{}.rs", name(&item.ident)));
    let directory = context.directory.join(name(&item.ident)).join("mod.rs");
    match (file.is_file(), directory.is_file()) {
        (true, false) => sources.checked(&file),
        (false, true) => sources.checked(&directory),
        (true, true) => Err(format!(
            "ambiguous module source: {}",
            sources.relative(&file)?
        )),
        _ => Err(format!(
            "missing module source: {}",
            sources.relative(&file)?
        )),
    }
}
impl Index {
    pub fn load(&mut self, sources: &mut Sources, observation: &mut Observation) -> Result<()> {
        for i in 0..self.units.len() {
            let target = self.units[i].target.clone();
            let context = Context {
                unit: i,
                module: vec![],
                directory: target
                    .file
                    .parent()
                    .ok_or("target has no parent")?
                    .to_owned(),
                file: target.file,
                inline: false,
                uncertain: target.uncertain,
            };
            self.load_file(sources, &context, &mut vec![], observation)?;
        }
        Ok(())
    }
    fn load_file(
        &mut self,
        sources: &mut Sources,
        context: &Context,
        active: &mut Vec<PathBuf>,
        observation: &mut Observation,
    ) -> Result<()> {
        if active.len() >= 128 || active.contains(&context.file) {
            return Err("cyclic or excessively nested Rust modules".into());
        }
        active.push(context.file.clone());
        let file = sources.relative(&context.file)?;
        let source = sources.read(&context.file)?;
        let tree = syn::parse_file(&source).map_err(|error| format!("{file}: {error}"))?;
        let mut context = context.clone();
        context.uncertain |= conditional(&tree.attrs);
        let scope = self.units[context.unit].target.scope.clone();
        let entry = self.files.entry(file.clone()).or_insert_with(|| {
            (
                scope.clone(),
                File {
                    file: file.clone(),
                    symbols: BTreeSet::new(),
                },
            )
        });
        if entry.0 != scope {
            return Err(format!("multiple packages own source file: {file}"));
        }
        self.items(sources, &context, &tree.items, active, observation)?;
        active.pop();
        Ok(())
    }
    fn items(
        &mut self,
        sources: &mut Sources,
        context: &Context,
        items: &[Item],
        active: &mut Vec<PathBuf>,
        observation: &mut Observation,
    ) -> Result<()> {
        if context.module.len() > 128 {
            return Err("inline module depth exceeded".into());
        }
        for item in items {
            self.item(sources, context, item, active, observation)?;
        }
        Ok(())
    }
    fn item(
        &mut self,
        sources: &mut Sources,
        context: &Context,
        item: &Item,
        active: &mut Vec<PathBuf>,
        observation: &mut Observation,
    ) -> Result<()> {
        match item {
            Item::Fn(item) => {
                self.function(sources, context, &item.sig, &item.block, &item.attrs, true)?
            }
            Item::Mod(item) => self.module(sources, context, item, active, observation)?,
            Item::Use(item) if !is_test(&item.attrs) => {
                self.import(
                    sources,
                    context,
                    &item.tree,
                    vec![],
                    item.leading_colon.is_some(),
                    conditional(&item.attrs),
                )?;
            }
            Item::Struct(item) if !is_test(&item.attrs) => {
                self.symbol(sources, context, &item.ident, "struct")?;
                let fields = item
                    .fields
                    .iter()
                    .filter(|f| matches!(f.ty, syn::Type::BareFn(_)) && !conditional(&f.attrs))
                    .filter_map(|f| f.ident.as_ref().map(name))
                    .collect();
                self.definition(
                    context,
                    name(&item.ident),
                    Kind::Struct(fields),
                    sources.relative(&context.file)?,
                    conditional(&item.attrs),
                );
            }
            Item::Impl(item) if !is_test(&item.attrs) => {
                let mut context = context.clone();
                context.uncertain |= conditional(&item.attrs);
                for member in &item.items {
                    if let syn::ImplItem::Fn(method) = member {
                        self.function(
                            sources,
                            &context,
                            &method.sig,
                            &method.block,
                            &method.attrs,
                            false,
                        )?;
                    }
                }
            }
            Item::Trait(item) if !is_test(&item.attrs) => {
                self.symbol(sources, context, &item.ident, "trait")?;
                self.definition(
                    context,
                    name(&item.ident),
                    Kind::Other,
                    sources.relative(&context.file)?,
                    conditional(&item.attrs),
                );
                for member in &item.items {
                    if let syn::TraitItem::Fn(method) = member
                        && let Some(body) = &method.default
                    {
                        self.function(sources, context, &method.sig, body, &method.attrs, false)?;
                    }
                }
            }
            Item::Enum(item) => self.other(sources, context, &item.ident, "enum")?,
            Item::Type(item) => self.other(sources, context, &item.ident, "type")?,
            Item::Const(item) => self.other(sources, context, &item.ident, "const")?,
            Item::Static(item) => self.other(sources, context, &item.ident, "static")?,
            Item::Union(item) => self.other(sources, context, &item.ident, "union")?,
            Item::Macro(_) | Item::ExternCrate(_) => observation.diagnostic(
                "RUST_UNEXPANDED",
                format!(
                    "{}: macro expansion and extern-crate aliases are not resolved",
                    sources.relative(&context.file)?
                ),
            ),
            _ => {}
        }
        Ok(())
    }
    fn other(
        &mut self,
        sources: &Sources,
        context: &Context,
        ident: &proc_macro2::Ident,
        kind: &str,
    ) -> Result<()> {
        self.symbol(sources, context, ident, kind)?;
        self.definition(
            context,
            name(ident),
            Kind::Other,
            sources.relative(&context.file)?,
            false,
        );
        Ok(())
    }
    fn module(
        &mut self,
        sources: &mut Sources,
        context: &Context,
        item: &syn::ItemMod,
        active: &mut Vec<PathBuf>,
        observation: &mut Observation,
    ) -> Result<()> {
        if is_test(&item.attrs) {
            return Ok(());
        }
        self.symbol(sources, context, &item.ident, "module")?;
        let file = sources.relative(&context.file)?;
        if item.attrs.iter().any(|a| a.path().is_ident("cfg_attr")) {
            observation.diagnostic(
                "RUST_CFG_ATTR_MODULE",
                format!(
                    "{file}: {} module requires configured attribute expansion",
                    item.ident
                ),
            );
            return Ok(());
        }
        let mut child = context.clone();
        child.module.push(name(&item.ident));
        child.uncertain |= conditional(&item.attrs);
        self.definition(
            context,
            name(&item.ident),
            Kind::Module,
            file.clone(),
            child.uncertain,
        );
        if let Some((_, items)) = &item.content {
            child.directory = if let Some(path) = attribute_path(&item.attrs) {
                let base = if context.inline {
                    &context.directory
                } else {
                    context.file.parent().ok_or("source has no parent")?
                };
                base.join(path)
            } else {
                context.directory.join(name(&item.ident))
            };
            child.inline = true;
            return self.items(sources, &child, items, active, observation);
        }
        child.file = match module_source(sources, context, item) {
            Ok(file) => file,
            Err(error) if child.uncertain => {
                observation.diagnostic("RUST_CONDITIONAL_MODULE", error);
                return Ok(());
            }
            Err(error) => return Err(error),
        };
        child.directory = if attribute_path(&item.attrs).is_some() {
            child
                .file
                .parent()
                .ok_or("module file has no parent")?
                .to_owned()
        } else {
            module_directory(&child.file)
        };
        child.inline = false;
        let target = sources.relative(&child.file)?;
        self.load_file(sources, &child, active, observation)?;
        if file != target {
            observation.relationships.insert(Relationship {
                source: file,
                target,
                kind: "rust-module",
            });
        }
        Ok(())
    }
    fn import(
        &mut self,
        sources: &Sources,
        context: &Context,
        tree: &UseTree,
        prefix: Vec<String>,
        absolute: bool,
        uncertain: bool,
    ) -> Result<()> {
        match tree {
            UseTree::Path(item) => {
                let mut prefix = prefix;
                prefix.push(name(&item.ident));
                self.import(sources, context, &item.tree, prefix, absolute, uncertain)?;
            }
            UseTree::Group(group) => {
                for tree in &group.items {
                    self.import(sources, context, tree, prefix.clone(), absolute, uncertain)?;
                }
            }
            UseTree::Name(item) => {
                let mut path = prefix;
                let identifier = if item.ident == "self" {
                    path.last().cloned().unwrap_or_default()
                } else {
                    path.push(name(&item.ident));
                    name(&item.ident)
                };
                self.definition(
                    context,
                    identifier,
                    Kind::Alias {
                        module: context.module.clone(),
                        path,
                        absolute,
                    },
                    sources.relative(&context.file)?,
                    uncertain,
                );
            }
            UseTree::Rename(item) => {
                let mut path = prefix;
                if item.ident != "self" {
                    path.push(name(&item.ident));
                }
                self.definition(
                    context,
                    name(&item.rename),
                    Kind::Alias {
                        module: context.module.clone(),
                        path,
                        absolute,
                    },
                    sources.relative(&context.file)?,
                    uncertain,
                );
            }
            UseTree::Glob(_) => {}
        }
        Ok(())
    }
}
