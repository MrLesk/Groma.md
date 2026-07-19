# Application

Application composes Groma use cases from Core capabilities and the Standard Model. It owns semantic
operation order, transaction preparation, snapshot reads, and bounded query routing. It does not own
storage formats, project paths, scanner syntax, CLI rendering, or visual layout.

Canonical mutations preserve intent/evidence separation and go through the shared transaction
engine. Application reads use the same bounded query contracts whether the provider is the local
canonical store or a disposable projection.

Reconciliation accepts one completed observation snapshot, resolves only exact source-owned
bindings, and prepares evidence plus Standard Model mutations as one transaction. It preserves
curated fields by changing a scanner-derived value only while the canonical value still matches the
previous observation. Partial coverage never turns an omission into deletion.

Capability results are copied as ordinary bounded plain data. The Host is a trusted same-process
composition; accessor, Proxy, Promise-species, and mutable-intrinsic attack containment are not a
supported boundary. Validation still fails closed for malformed, oversized, ambiguous, or
unsupported canonical values.

There is no schema-migration application surface before a real incompatible release requires one.
