# Organization-scale verification

Groma keeps this proof outside the normal `check` and first-run paths:

```sh
bun run verify:organization-scale
```

The verifier composes existing production boundaries rather than introducing a benchmark
framework. It submits 500,000 distinct provenance-bearing observations in bounded batches,
reconciles the complete snapshot, round-trips their stable keys through 256 deterministically
named evidence source shards, rebuilds a 1,000-component/4,000-relationship projection, pages the
complete catalog, and exercises search, traversal, detail, current-level rendering, focus, and
progressive child-page retention. It also compares the same bounded semantic/rendering slice in a
small and large projection.

## Supported boundary

This is a deterministic local synthetic proof of the existing observation, reconciliation,
JSON-evidence, projection, query, and browser-model composition. It covers one complete
500,000-record documentation observation session and representative wide, deep, and connected
component topologies. It does not claim arbitrary scanner semantics, production organization
topologies, concurrent writers, browser DOM performance, or an organization-wide canvas.

## Preliminary run evidence

On 2026-07-21, an Apple Silicon local run reached reconciliation of the 500,000-record snapshot
but stopped before evidence serialization and projection verification because the verifier's
initial 5,000,000-value transaction-copy envelope was too small. The failed run took 18.99 seconds
and `/usr/bin/time -l` reported a maximum resident set size of 9,586,786,304 bytes (9,142.7 MiB).
This identifies repeated in-memory snapshot validation/copying as the first bottleneck; storage
fanout, query latency, and browser retention were not measured by that run.

The verifier now gives the transaction copy a 10,000,000-value ceiling and reports the underlying
diagnostic if reconciliation fails. Per product-owner instruction, the adjusted proof was not run,
so its final metrics remain unverified.

## Decisions

- Evidence shards: retain deterministic one-shard-per-source hashing and the 256-source
  representative fanout. The failed run produced no evidence that more fanout would address the
  first bottleneck, so no production shard default or storage schema changes here.
- Browser retained nodes: do not freeze or change a retained-node limit. The verifier records nodes
  retained after bounded child pages and nodes drawn in main/focus layers for the separate
  End-of-Iteration-4 decision, but the adjusted measurement was not run.
- Event batching: do not change it. This proof yielded no completed event-batching measurement.
- Canonical semantics: the only production correction passes the configured reconciliation record
  ceiling into observation revalidation. It changes no identity, evidence, reconciliation,
  projection, query, or rendering meaning.

Status: **unverified by product-owner instruction**. Do not treat the preliminary failed run as a
completed scale certification.
