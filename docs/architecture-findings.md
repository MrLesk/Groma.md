# Architecture findings

Architecture findings are review questions about implementations, not map
collaborations. They do not become C4 elements, containment, or relationship
rows. An ordinary Markdown reader of the architecture tree never sees them.
Groma interprets scanner facts after a scan and shows copies next to the
operations they concern: under Code in How it's built, and in the scan listing.
Exact copies list the other operations by name and file:line; similar copies add
that they are not identical. Token bags stay off the listing. What it does does not dump findings.

The web toolbar's review icon opens **Project review**, showing **Potential duplicates**
across the project. The neutral icon has a dot when findings are available.
Plugin management lives separately in **Settings → Plugins**. Project review filters groups by
component and match type; a component filter retains copies owned elsewhere.
Select a group, then choose two occurrences to compare their source ranges.
Highlighted lines show textual differences, not a new similarity judgment.
Each owned occurrence can open its source or select its component on the map.
Closing the popup restores the underlying inspector and cancels pending
source comparisons. New world payloads replace
the findings and cancel pending comparisons. Views without findings say that
none are available; they do not claim that every project source was compared.

## Ownership

```text
source → scanner tokens (temporary) → core comparison → findings on the annotated world
```

Scanners report named operations, source ranges, and binding-normalized tokens.
They do not decide that duplication is a problem. Core fingerprints those
tokens, groups exact clones and near-duplicates, maps each instance to its
component owner, and lists concrete token differences. Fingerprints stay in
memory for the current process. A scan never writes suspected duplication as
an architecture relationship or merges components.

## What the first rule claims

Local names are slots that follow declarations, including nested scopes.
Operators, literals, property names, and unresolved identifiers remain. Two
bodies that match after that normalization are **structurally duplicated
logic**. Near-matches add the tokens that are not shared. Neither claim
proves that the operations implement one business rule or that they should
share an implementation.

Anonymous callbacks, module initializers, and very small bodies are omitted.
Test files already excluded by the TypeScript scanner are not compared.

## OKF and C4

A finding is supporting knowledge about existing components. OKF readers
understand the architecture without it. C4 still owns actors, systems,
containers, components, and relationships. Groma owns the comparison and the
viewer presentation.
