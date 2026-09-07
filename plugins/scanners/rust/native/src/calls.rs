use crate::{
    index::{Function, Index, name, path},
    model::{Invocation, Observation, Relationship},
    resolve::Resolution,
};
use std::collections::BTreeSet;
use syn::{
    Expr, ExprCall, ExprMethodCall, Item, Pat, Signature,
    spanned::Spanned,
    visit::{self, Visit},
};

#[derive(Default)]
pub struct Locals {
    pub names: BTreeSet<String>,
    pub opaque: bool,
}
impl Locals {
    pub fn in_body(body: &syn::Block) -> Self {
        let mut locals = Self::default();
        locals.visit_block(body);
        locals
    }
    pub fn include_parameters(&mut self, signature: &Signature) {
        for argument in &signature.inputs {
            if let syn::FnArg::Typed(argument) = argument {
                self.visit_pat(&argument.pat);
            }
        }
        for parameter in &signature.generics.params {
            match parameter {
                syn::GenericParam::Type(p) => {
                    self.names.insert(name(&p.ident));
                }
                syn::GenericParam::Const(p) => {
                    self.names.insert(name(&p.ident));
                }
                _ => {}
            }
        }
    }
}
impl<'ast> Visit<'ast> for Locals {
    fn visit_pat_ident(&mut self, pattern: &'ast syn::PatIdent) {
        self.names.insert(name(&pattern.ident));
        visit::visit_pat_ident(self, pattern);
    }
    fn visit_item(&mut self, item: &'ast Item) {
        match item {
            Item::Fn(item) => {
                self.names.insert(name(&item.sig.ident));
            }
            Item::Const(item) => {
                self.names.insert(name(&item.ident));
            }
            Item::Static(item) => {
                self.names.insert(name(&item.ident));
            }
            // Block-local imports and item namespaces need lexical scope analysis.
            _ => self.opaque = true,
        }
    }
    fn visit_macro(&mut self, _: &'ast syn::Macro) {
        self.opaque = true;
    }
    fn visit_expr_unsafe(&mut self, _: &'ast syn::ExprUnsafe) {
        self.opaque = true;
    }
}
pub fn unparenthesize(mut expression: &Expr) -> &Expr {
    loop {
        expression = match expression {
            Expr::Paren(paren) => &paren.expr,
            Expr::Group(group) => &group.expr,
            _ => return expression,
        };
    }
}
pub fn expression(
    index: &Index,
    function: &Function,
    locals: &Locals,
    expression: &Expr,
) -> Resolution {
    let Expr::Path(expr) = unparenthesize(expression) else {
        return Resolution {
            items: vec![],
            unresolved: true,
        };
    };
    let segments = path(&expr.path);
    let explicit = expr.path.leading_colon.is_some()
        || segments
            .first()
            .is_some_and(|s| matches!(s.as_str(), "crate" | "self" | "super"));
    if expr.qself.is_some()
        || (!explicit
            && (locals.opaque || segments.first().is_some_and(|n| locals.names.contains(n))))
    {
        return Resolution {
            items: vec![],
            unresolved: true,
        };
    }
    index.resolve(
        function.unit,
        &function.module,
        &segments,
        expr.path.leading_colon.is_some(),
    )
}
pub struct Calls<'a> {
    pub calls: Vec<&'a ExprCall>,
    pub methods: Vec<&'a ExprMethodCall>,
}
impl<'a> Calls<'a> {
    pub fn in_body(body: &'a syn::Block) -> Self {
        let mut calls = Self {
            calls: vec![],
            methods: vec![],
        };
        calls.visit_block(body);
        calls
    }
}
impl<'ast> Visit<'ast> for Calls<'ast> {
    fn visit_expr_call(&mut self, expr: &'ast ExprCall) {
        self.calls.push(expr);
        visit::visit_expr_call(self, expr);
    }
    fn visit_expr_method_call(&mut self, expr: &'ast ExprMethodCall) {
        self.methods.push(expr);
        visit::visit_expr_method_call(self, expr);
    }
    fn visit_item(&mut self, _: &'ast Item) {}
    fn visit_expr_closure(&mut self, _: &'ast syn::ExprClosure) {}
    fn visit_expr_async(&mut self, _: &'ast syn::ExprAsync) {}
    fn visit_expr_const(&mut self, _: &'ast syn::ExprConst) {}
}
impl Index {
    pub fn evidence(&self, observation: &mut Observation) {
        observation.operations = self
            .functions
            .iter()
            .map(|function| function.operation.clone())
            .collect();
        for function in &self.functions {
            let mut locals = Locals::in_body(&function.body);
            locals.include_parameters(&function.signature);
            let calls = Calls::in_body(&function.body);
            for call in calls.calls {
                let resolved = expression(self, function, &locals, &call.func);
                let (targets, unresolved) = resolved.functions();
                let invocation = Invocation {
                    source: function.operation.id.clone(),
                    targets: targets
                        .iter()
                        .map(|i| self.functions[*i].operation.id.clone())
                        .collect(),
                    unresolved: unresolved || function.uncertain,
                    line: call.span().start().line,
                    member: None,
                    binding: None,
                };
                for target in &targets {
                    let file = &self.functions[*target].operation.file;
                    if *file != function.operation.file && !invocation.unresolved {
                        observation.relationships.insert(Relationship {
                            source: function.operation.file.clone(),
                            target: file.clone(),
                            kind: "rust-canonical-call",
                        });
                    }
                }
                self.callbacks(
                    function,
                    &locals,
                    call,
                    &targets,
                    invocation.unresolved,
                    observation,
                );
                observation.invocations.push(invocation);
            }
            for call in calls.methods {
                observation.invocations.push(Invocation {
                    source: function.operation.id.clone(),
                    targets: vec![],
                    unresolved: true,
                    line: call.span().start().line,
                    member: Some(name(&call.method)),
                    binding: None,
                });
            }
        }
        self.import_evidence(observation);
        observation.diagnostic("RUST_ANALYSIS_SCOPE", String::from("Syntax scope: unresolved call observations are retained; no type inference, trait dispatch, closure/async-block bodies, macro expansion, cfg evaluation, build scripts or generated OUT_DIR code. Tests/examples/benches are not targets."));
    }
}
impl Index {
    fn import_evidence(&self, observation: &mut Observation) {
        for (unit, data) in self.units.iter().enumerate() {
            for (key, definitions) in &data.definitions {
                for definition in definitions {
                    if !matches!(definition.kind, crate::index::Kind::Alias { .. }) {
                        continue;
                    }
                    let resolved =
                        self.resolve(unit, &key[..key.len() - 1], &key[key.len() - 1..], false);
                    if resolved.unresolved {
                        continue;
                    }
                    for target in resolved.items {
                        let file = target.definition.file;
                        if file != definition.file && self.files.contains_key(&file) {
                            observation.relationships.insert(Relationship {
                                source: definition.file.clone(),
                                target: file,
                                kind: "rust-import",
                            });
                        }
                    }
                }
            }
        }
    }
}
pub fn simple_parameter(argument: &syn::FnArg) -> Option<&syn::TypePath> {
    let syn::FnArg::Typed(argument) = argument else {
        return None;
    };
    let Pat::Ident(pattern) = argument.pat.as_ref() else {
        return None;
    };
    if pattern.mutability.is_some() || pattern.by_ref.is_some() || pattern.subpat.is_some() {
        return None;
    }
    let syn::Type::Path(ty) = argument.ty.as_ref() else {
        return None;
    };
    if ty.qself.is_some() {
        return None;
    }
    Some(ty)
}
