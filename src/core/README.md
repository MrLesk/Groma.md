# Core

Core owns Groma's technology-neutral contracts:

- opaque stable identities and aliases;
- bounded graph data and deterministic query envelopes;
- finite scanner observation sessions;
- atomic semantic transaction contracts;
- phased built-in plugin composition;
- diagnostics and committed-generation events.

Core has no filesystem, scanner-language, CLI, renderer, or layout knowledge.

An observation session accepts bounded batches for declared coverage and exposes a snapshot only
after successful completion. Failed, cancelled, malformed, contradictory, or incomplete sessions
produce no completed snapshot. Provisional batches and heartbeats are process-local coordination,
not durable canonical state.

Transactions validate one complete proposed state and publish one committed-generation event only
after the provider confirms the atomic write. An uncertain result stays indeterminate. Stable IDs
are never derived from names, paths, parents, or scanner locators.

Runtime values are ordinary trusted same-process JavaScript values. Core still validates supported
plain data shapes, explicit bounds, exact identities, and deterministic ordering; it does not try to
survive deliberate mutation of language intrinsics by an in-process plugin.
