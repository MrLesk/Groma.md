use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};

pub type Result<T> = std::result::Result<T, String>;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Observation {
    pub schema_version: u8,
    pub scanner: Identity,
    pub complete: bool,
    pub root: Root,
    pub scopes: Vec<Scope>,
    pub files: Vec<File>,
    pub placements: Vec<Placement>,
    pub relationships: BTreeSet<Relationship>,
    pub operations: Vec<Operation>,
    pub invocations: Vec<Invocation>,
    pub diagnostics: BTreeSet<Diagnostic>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Identity {
    pub language: &'static str,
    pub engine: &'static str,
    pub engine_version: &'static str,
}
#[derive(Serialize)]
pub struct Root {
    pub kind: &'static str,
    pub name: String,
    pub file: String,
}
#[derive(Serialize)]
pub struct Scope {
    pub id: String,
    pub name: String,
}
#[derive(Serialize, Default)]
pub struct File {
    pub file: String,
    pub symbols: BTreeSet<Symbol>,
}
#[derive(Serialize, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct Symbol {
    pub id: String,
    pub name: String,
    pub kind: String,
}
#[derive(Serialize)]
pub struct Placement {
    pub file: String,
    pub scope: String,
}
#[derive(Serialize, PartialEq, Eq, PartialOrd, Ord)]
pub struct Relationship {
    pub source: String,
    pub target: String,
    pub kind: &'static str,
}
#[derive(Serialize, PartialEq, Eq, PartialOrd, Ord)]
pub struct Diagnostic {
    pub severity: &'static str,
    pub code: &'static str,
    pub message: String,
}
#[derive(Serialize, Clone)]
pub struct Operation {
    pub id: String,
    pub file: String,
    pub name: String,
}
#[derive(Serialize, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct Binding {
    pub file: String,
    pub line: usize,
}
#[derive(Serialize, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct Invocation {
    pub source: String,
    pub targets: Vec<String>,
    pub unresolved: bool,
    pub line: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub member: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub binding: Option<Binding>,
}
impl Observation {
    pub fn new(name: String, manifest: String) -> Self {
        Self {
            schema_version: 1,
            scanner: Identity {
                language: "rust",
                engine: "syn-syntax",
                engine_version: "2.0.106/groma-0.1.0",
            },
            complete: true,
            root: Root {
                kind: "cargo-source-set",
                name,
                file: manifest,
            },
            scopes: vec![],
            files: vec![],
            placements: vec![],
            relationships: BTreeSet::new(),
            operations: vec![],
            invocations: vec![],
            diagnostics: BTreeSet::new(),
        }
    }
    pub fn diagnostic(&mut self, code: &'static str, message: impl Into<String>) {
        self.diagnostics.insert(Diagnostic {
            severity: "warning",
            code,
            message: message.into(),
        });
    }
    pub fn finish(&mut self, files: BTreeMap<String, (String, File)>) {
        for (file, (scope, evidence)) in files {
            self.placements.push(Placement { file, scope });
            self.files.push(evidence);
        }
        self.scopes.sort_by(|a, b| a.id.cmp(&b.id));
        self.operations.sort_by(|a, b| a.id.cmp(&b.id));
        self.invocations.sort();
        self.invocations.dedup();
    }
}
