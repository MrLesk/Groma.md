use crate::{
    calls::{Calls, Locals, expression, simple_parameter, unparenthesize},
    index::{Function, Index, Kind, name, path},
    model::{Binding, Invocation, Observation},
};
use syn::{Expr, ExprCall, FnArg, Member, Pat, spanned::Spanned};

struct CallbackContext<'a> {
    caller: &'a Function,
    caller_locals: &'a Locals,
    callee: &'a Function,
    body_locals: &'a Locals,
    binding_line: usize,
}
fn invoked_field(call: &ExprCall, parameter: &str) -> Option<String> {
    let Expr::Field(field) = unparenthesize(&call.func) else {
        return None;
    };
    let Expr::Path(base) = unparenthesize(&field.base) else {
        return None;
    };
    if base.qself.is_some()
        || base.path.segments.len() != 1
        || name(&base.path.segments[0].ident) != parameter
    {
        return None;
    }
    let Member::Named(member) = &field.member else {
        return None;
    };
    Some(name(member))
}
impl Index {
    pub fn callbacks(
        &self,
        caller: &Function,
        locals: &Locals,
        supplied: &ExprCall,
        targets: &[usize],
        unresolved: bool,
        observation: &mut Observation,
    ) {
        // A precise binding must select a synchronous implementation, not a signature or future body.
        if unresolved || targets.len() != 1 || locals.opaque {
            return;
        }
        let callee = &self.functions[targets[0]];
        if callee.uncertain
            || callee.signature.asyncness.is_some()
            || callee.signature.unsafety.is_some()
            || !callee.signature.generics.params.is_empty()
        {
            return;
        }
        let body_locals = Locals::in_body(&callee.body);
        if body_locals.opaque {
            return;
        }
        let context = CallbackContext {
            caller,
            caller_locals: locals,
            callee,
            body_locals: &body_locals,
            binding_line: supplied.span().start().line,
        };
        for (parameter, argument) in callee.signature.inputs.iter().zip(&supplied.args) {
            self.callback_argument(&context, parameter, argument, observation);
        }
    }
    fn callback_argument(
        &self,
        context: &CallbackContext,
        parameter: &FnArg,
        argument: &Expr,
        observation: &mut Observation,
    ) {
        let CallbackContext {
            caller,
            caller_locals,
            callee,
            body_locals,
            binding_line,
        } = context;
        let Some(ty) = simple_parameter(parameter) else {
            return;
        };
        let FnArg::Typed(parameter) = parameter else {
            return;
        };
        let Pat::Ident(pattern) = parameter.pat.as_ref() else {
            return;
        };
        let parameter_name = name(&pattern.ident);
        if body_locals.names.contains(&parameter_name) {
            return;
        }
        let Expr::Struct(literal) = unparenthesize(argument) else {
            return;
        };
        if literal.rest.is_some() || literal.qself.is_some() {
            return;
        }
        let head = literal
            .path
            .segments
            .first()
            .map(|segment| name(&segment.ident));
        if literal.path.leading_colon.is_none()
            && head
                .as_ref()
                .is_some_and(|head| caller_locals.names.contains(head))
        {
            return;
        }
        let parameter_type = self.resolve(
            callee.unit,
            &callee.module,
            &path(&ty.path),
            ty.path.leading_colon.is_some(),
        );
        let argument_type = self.resolve(
            caller.unit,
            &caller.module,
            &path(&literal.path),
            literal.path.leading_colon.is_some(),
        );
        if parameter_type.unresolved
            || argument_type.unresolved
            || parameter_type.items.len() != 1
            || argument_type.items.len() != 1
        {
            return;
        }
        let expected = &parameter_type.items[0];
        let actual = &argument_type.items[0];
        if expected.unit != actual.unit
            || expected.key != actual.key
            || expected.definition.uncertain
            || actual.definition.uncertain
        {
            return;
        }
        let Kind::Struct(fields) = &expected.definition.kind else {
            return;
        };
        for call in Calls::in_body(&callee.body).calls {
            let Some(member) = invoked_field(call, &parameter_name) else {
                continue;
            };
            if !fields.contains(&member) {
                continue;
            }
            let Some(field) = literal.fields.iter().find(
                |field| matches!(&field.member, Member::Named(ident) if name(ident) == member),
            ) else {
                continue;
            };
            let resolved = expression(self, caller, caller_locals, &field.expr);
            let (targets, unresolved) = resolved.functions();
            observation.invocations.push(Invocation {
                source: callee.operation.id.clone(),
                targets: targets
                    .iter()
                    .map(|i| self.functions[*i].operation.id.clone())
                    .collect(),
                unresolved,
                line: call.span().start().line,
                member: Some(member),
                binding: Some(Binding {
                    file: caller.operation.file.clone(),
                    line: *binding_line,
                }),
            });
        }
    }
}
