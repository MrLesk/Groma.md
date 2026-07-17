# Groma Architecture

Groma describes its detailed architecture in the canonical workspace under
[`groma/`](groma/). That workspace is the source of truth for component identity,
containment, intent, inputs, outputs, actions, extension metadata, and ordinary
relationships. This document is a stable entry point, not a second field ledger.

The [Manifesto](MANIFESTO.md) is Groma's constitution and takes precedence over the
canonical blueprint when a product or architectural principle is in question. Public
surface and model behavior are documented beside their implementations under [`src/`](src/).
Presentation follows [the brand guide](brand/README.md) and
[visual style direction](brand/STYLE.md); layout, folding, focus, zoom, and theme remain
disposable projection state rather than canonical meaning.

## Orientation

The self-blueprint contains nine root components:

| Root                           | Orientation                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------- |
| Core                           | Technology-neutral graph, transaction, query, observation, and plugin contracts |
| Official Host                  | Default local composition and bootstrap behavior                                |
| Standard Blueprint Model       | The official recursively composable component vocabulary                        |
| Canonical Persistence          | Deterministic local intent, evidence, alias, journal, and migration state       |
| Projection                     | Reconstructable indexes, bounded queries, and visual projection                 |
| Scanning and Reconciliation    | Blind observation and intent-preserving reconciliation                          |
| Planning and History           | Desired-state overlays, comparison, and historical views                        |
| CLI, Service, and Web Surfaces | Shared operations presented to agents and humans                                |
| Plugin Development             | Public SDK, conformance, and scaffolding                                        |

Each non-root component has exactly one canonical parent. Ordinary relationships are
separate from containment and may cross any root boundary.

## Inspect the Blueprint

Build the public executable before inspecting a source checkout:

```sh
bun run build
./dist/groma
./dist/groma component roots --limit 100
./dist/groma blueprint search "reconciliation" --limit 20
./dist/groma blueprint traverse <component-id> --direction both --depth 2 --limit 20
./dist/groma blueprint export --limit 7
```

An installed distribution uses the same commands with `groma` in place of
`./dist/groma`. Export is explicitly paged: pass each returned cursor unchanged until
`hasMore` is false. Cursors are generation-bound, so a stale result requires restarting
from the first page.

Canonical Markdown is readable for review, but changes to architectural meaning must go
through supported Groma operations. Do not hand-edit generated intent shards or derive
identity from a component name, path, parent, or migration seed key.

## Relationship Declarations

The migration preserves every documented relationship declaration as structured
`groma.md/relationship-declarations` metadata on its owning component. Each record has a
stable declaration key, exact text, and one of three states:

- `edge` means every endpoint is explicit and represented by one or more canonical
  `relates-to` edges whose IDs are recorded on the declaration;
- `constraint` means the text expresses an architectural boundary rather than a graph
  edge;
- `ambiguous` means the documented endpoint is absent, open-ended, or not uniquely
  defensible.

Only `edge` declarations materialize ordinary relationships. Missing or collective
endpoints are never guessed, and constraints never receive synthetic components merely
to make the graph appear complete. The declaration records keep that unresolved or
non-edge meaning visible without creating a second query model.

## Resolve Disagreements

When the blueprint, implementation, or this navigator appears to disagree:

1. Check the Manifesto first. If the disagreement would change one of its principles,
   stop and request an explicit product decision.
2. Inspect the affected component and relationships through bounded public Groma reads.
   Record the stable component, item, declaration, and edge IDs involved.
3. Decide explicitly which layer is wrong: canonical architectural meaning, the current
   implementation, or this high-level navigator. Scanner evidence alone does not replace
   curated intent.
4. Change canonical meaning only through supported Groma operations. Change code when the
   implementation has drifted. Update this navigator only when its high-level orientation
   has become inaccurate.
5. Run the self-blueprint verification and the normal repository checks. If identity or
   endpoint resolution is still ambiguous, fail closed rather than selecting a likely
   match.

The durable coverage check copies the canonical workspace, uses fresh compiled CLI
processes to page a bounded export, verifies the frozen architecture and declaration/edge
correspondence, deletes the disposable projection, rebuilds it, and proves canonical bytes
remain unchanged:

```sh
bun run verify:self-blueprint
bun run check
```
