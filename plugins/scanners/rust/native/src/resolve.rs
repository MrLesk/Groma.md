use crate::index::{Definition, Index, Kind};

#[derive(Clone)]
pub struct Resolved {
    pub unit: usize,
    pub key: Vec<String>,
    pub definition: Definition,
}
#[derive(Default)]
pub struct Resolution {
    pub items: Vec<Resolved>,
    pub unresolved: bool,
}
impl Resolution {
    fn unknown() -> Self {
        Self {
            items: vec![],
            unresolved: true,
        }
    }
    fn merge(&mut self, other: Self) {
        self.unresolved |= other.unresolved;
        self.items.extend(other.items);
    }
    pub fn functions(&self) -> (Vec<usize>, bool) {
        let mut unknown = self.unresolved;
        let mut functions = vec![];
        for item in &self.items {
            unknown |= item.definition.uncertain;
            match item.definition.kind {
                Kind::Function(function) => functions.push(function),
                _ => unknown = true,
            }
        }
        functions.sort();
        functions.dedup();
        unknown |= functions.is_empty();
        (functions, unknown)
    }
}
impl Index {
    pub fn resolve(
        &self,
        unit: usize,
        module: &[String],
        path: &[String],
        absolute: bool,
    ) -> Resolution {
        self.resolve_depth(unit, module, path, absolute, 0)
    }
    fn resolve_depth(
        &self,
        unit: usize,
        module: &[String],
        path: &[String],
        absolute: bool,
        depth: usize,
    ) -> Resolution {
        if depth >= 64 || path.is_empty() {
            return Resolution::unknown();
        }
        if absolute {
            return self.dependency(unit, path, depth);
        }
        let mut module = module.to_vec();
        let mut rest = path;
        match rest[0].as_str() {
            "crate" => {
                module.clear();
                rest = &rest[1..];
            }
            "self" => {
                rest = &rest[1..];
            }
            "super" => {
                while rest.first().is_some_and(|name| name == "super") {
                    if module.pop().is_none() {
                        return Resolution::unknown();
                    }
                    rest = &rest[1..];
                }
            }
            _ => {}
        }
        if rest.is_empty() {
            return Resolution::unknown();
        }
        let mut key = module.clone();
        key.push(rest[0].clone());
        let Some(definitions) = self.units[unit].definitions.get(&key) else {
            if rest == path {
                return self.dependency(unit, path, depth);
            }
            return Resolution::unknown();
        };
        let mut output = Resolution {
            items: vec![],
            unresolved: definitions.len() != 1 || self.units[unit].target.uncertain,
        };
        for definition in definitions {
            let mut result = match &definition.kind {
                Kind::Alias {
                    module,
                    path,
                    absolute,
                } => {
                    let alias = self.resolve_depth(unit, module, path, *absolute, depth + 1);
                    self.suffix(alias, &rest[1..], depth + 1)
                }
                Kind::Module if rest.len() > 1 => {
                    self.resolve_depth(unit, &key, &rest[1..], false, depth + 1)
                }
                _ if rest.len() == 1 => Resolution {
                    items: vec![Resolved {
                        unit,
                        key: key.clone(),
                        definition: definition.clone(),
                    }],
                    unresolved: false,
                },
                _ => Resolution::unknown(),
            };
            result.unresolved |= definition.uncertain;
            output.merge(result);
        }
        output
    }
    fn suffix(&self, resolved: Resolution, suffix: &[String], depth: usize) -> Resolution {
        if suffix.is_empty() {
            return resolved;
        }
        let mut output = Resolution {
            items: vec![],
            unresolved: resolved.unresolved,
        };
        for item in resolved.items {
            if matches!(item.definition.kind, Kind::Module) {
                let mut next = self.resolve_depth(item.unit, &item.key, suffix, false, depth + 1);
                next.unresolved |= item.definition.uncertain;
                output.merge(next);
            } else {
                output.unresolved = true;
            }
        }
        output
    }
    fn dependency(&self, unit: usize, path: &[String], depth: usize) -> Resolution {
        let Some((dependency, uncertain)) = self.units[unit].dependencies.get(&path[0]) else {
            return Resolution::unknown();
        };
        if path.len() == 1 {
            return Resolution {
                items: vec![Resolved {
                    unit: *dependency,
                    key: vec![],
                    definition: Definition {
                        kind: Kind::Module,
                        uncertain: *uncertain,
                        file: String::new(),
                    },
                }],
                unresolved: *uncertain,
            };
        }
        let mut result = self.resolve_depth(*dependency, &[], &path[1..], false, depth + 1);
        result.unresolved |= *uncertain;
        result
    }
}
