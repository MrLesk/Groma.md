# Application

Application composes Groma use cases from Core capabilities and the Standard Model. It owns semantic
operation order, transaction preparation, snapshot reads, and bounded query routing. It does not own
storage formats, project paths, scanner syntax, CLI rendering, or visual layout.

Canonical mutations preserve intent/evidence separation and go through the shared transaction
engine. Application reads use the same bounded query contracts whether the provider is the local
canonical store or a disposable projection.

An exact component read keeps canonical meaning and supporting scan evidence separate in one
generation-locked result. Evidence detail includes its source binding, coverage, observations, and
provenance; a curated-only component has an empty evidence list.

Reconciliation accepts one completed observation snapshot, resolves only exact source-owned
bindings, and prepares evidence plus Standard Model mutations as one transaction. It preserves
curated fields by changing a scanner-derived value only while the canonical value still matches the
previous observation. Partial coverage never turns an omission into deletion.

The versioned structural-scale derivation belongs to reconciliation, not scanners. Each observed
numeric count independently maps through workspace-pinned thresholds; only unanimous counts produce
a proposal. Straddling counts remain ambiguous. Proposals stay in evidence, exact component reads
compare them with curated scale to report alignment or drift, and rescans never write intent scale.

When a supported component merge supersedes an observed identity with a curated component,
reconciliation follows the canonical alias and migrates the source-owned binding and relationship
projections to the survivor. Later scans continue to refresh evidence without replacing curated
intent or recreating the automatic component.

Capability results are copied as ordinary bounded plain data. The Host is a trusted same-process
composition; accessor, Proxy, Promise-species, and mutable-intrinsic attack containment are not a
supported boundary. Validation still fails closed for malformed, oversized, ambiguous, or
unsupported canonical values.

There is no schema-migration application surface before a real incompatible release requires one.
