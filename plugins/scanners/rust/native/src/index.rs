use crate::{
    cargo::Target,
    model::{File, Operation, Result, Symbol},
    source::Sources,
};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::PathBuf,
};
use syn::{Attribute, Block, Signature, spanned::Spanned};

#[derive(Clone)]
pub enum Kind {
    Function(usize),
    Module,
    Alias {
        module: Vec<String>,
        path: Vec<String>,
        absolute: bool,
    },
    Struct(BTreeSet<String>),
    Other,
}
#[derive(Clone)]
pub struct Definition {
    pub kind: Kind,
    pub uncertain: bool,
    pub file: String,
}
pub struct Unit {
    pub target: Target,
    pub definitions: BTreeMap<Vec<String>, Vec<Definition>>,
    pub dependencies: BTreeMap<String, (usize, bool)>,
}
pub struct Function {
    pub operation: Operation,
    pub unit: usize,
    pub module: Vec<String>,
    pub signature: Signature,
    pub body: Block,
    pub uncertain: bool,
}
pub struct Index {
    pub units: Vec<Unit>,
    pub functions: Vec<Function>,
    pub files: BTreeMap<String, (String, File)>,
}
#[derive(Clone)]
pub struct Context {
    pub unit: usize,
    pub module: Vec<String>,
    pub file: PathBuf,
    pub directory: PathBuf,
    pub inline: bool,
    pub uncertain: bool,
}
pub fn name(id: &proc_macro2::Ident) -> String {
    id.to_string().trim_start_matches("r#").into()
}
pub fn path(path: &syn::Path) -> Vec<String> {
    path.segments
        .iter()
        .map(|segment| name(&segment.ident))
        .collect()
}
pub fn conditional(attrs: &[Attribute]) -> bool {
    attrs.iter().any(|attr| {
        let built_in = [
            "doc",
            "allow",
            "warn",
            "deny",
            "forbid",
            "inline",
            "cold",
            "must_use",
            "deprecated",
            "no_mangle",
            "export_name",
            "repr",
            "derive",
            "no_std",
            "no_main",
            "recursion_limit",
            "type_length_limit",
            "path",
            "test",
            "non_exhaustive",
            "track_caller",
            "link",
            "link_name",
            "unsafe",
        ];
        attr.path()
            .get_ident()
            .is_none_or(|id| !built_in.contains(&id.to_string().as_str()))
    })
}
pub fn is_test(attrs: &[Attribute]) -> bool {
    attrs.iter().any(|attr| {
        if attr.path().is_ident("test") {
            return true;
        }
        match &attr.meta {
            syn::Meta::List(list) if list.path.is_ident("cfg") => list.tokens.to_string() == "test",
            _ => false,
        }
    })
}
impl Index {
    pub fn new(targets: Vec<Target>) -> Self {
        let mut units: Vec<Unit> = targets
            .into_iter()
            .map(|target| Unit {
                target,
                definitions: BTreeMap::new(),
                dependencies: BTreeMap::new(),
            })
            .collect();
        let libraries: BTreeMap<String, (usize, String)> = units
            .iter()
            .enumerate()
            .filter(|(_, unit)| unit.target.library)
            .map(|(i, unit)| (unit.target.scope.clone(), (i, unit.target.name.clone())))
            .collect();
        for unit in &mut units {
            for (alias, (scope, conditional)) in &unit.target.dependencies {
                if let Some((i, _)) = libraries.get(scope) {
                    unit.dependencies.insert(alias.clone(), (*i, *conditional));
                }
            }
            if !unit.target.library
                && let Some((i, alias)) = libraries.get(&unit.target.scope)
            {
                unit.dependencies.insert(alias.clone(), (*i, false));
            }
        }
        Self {
            units,
            functions: vec![],
            files: BTreeMap::new(),
        }
    }
    pub fn definition(
        &mut self,
        context: &Context,
        identifier: String,
        kind: Kind,
        file: String,
        uncertain: bool,
    ) {
        let mut key = context.module.clone();
        key.push(identifier);
        self.units[context.unit]
            .definitions
            .entry(key)
            .or_default()
            .push(Definition {
                kind,
                uncertain: uncertain || context.uncertain,
                file,
            });
    }
    pub fn symbol(
        &mut self,
        sources: &Sources,
        context: &Context,
        identifier: &proc_macro2::Ident,
        kind: &str,
    ) -> Result<()> {
        let file = sources.relative(&context.file)?;
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
        let start = identifier.span().start();
        entry.1.symbols.insert(Symbol {
            id: format!("{file}:{}:{}:{kind}", start.line, start.column),
            name: name(identifier),
            kind: kind.into(),
        });
        Ok(())
    }
    pub fn function(
        &mut self,
        sources: &Sources,
        context: &Context,
        signature: &Signature,
        body: &Block,
        attrs: &[Attribute],
        free: bool,
    ) -> Result<()> {
        if is_test(attrs) {
            return Ok(());
        }
        self.symbol(sources, context, &signature.ident, "function")?;
        let start = signature.span().start();
        let file = sources.relative(&context.file)?;
        let operation = Operation {
            id: format!(
                "{}:{file}:{}:{}",
                self.units[context.unit].target.id, start.line, start.column
            ),
            file: file.clone(),
            name: name(&signature.ident),
        };
        if free {
            self.definition(
                context,
                name(&signature.ident),
                Kind::Function(self.functions.len()),
                file,
                conditional(attrs),
            );
        }
        self.functions.push(Function {
            operation,
            unit: context.unit,
            module: context.module.clone(),
            signature: signature.clone(),
            body: body.clone(),
            uncertain: context.uncertain || conditional(attrs),
        });
        Ok(())
    }
}
