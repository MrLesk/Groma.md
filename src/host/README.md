# Host

Host is Groma's composition root. It connects the built-in providers, local project resources,
Standard Model, application operations, scanner runtime, and CLI surface without moving canonical
meaning into adapters.

The current default composition supports the built-in TypeScript/Bun scanner only. Local plugin
package discovery, acquisition, scaffolding, trust ledgers, dynamic module loading, and SDK
certification are deliberately absent.

## Scan runtime

One configured scan is bounded by project coverage, resource limits, observation limits, and a
maximum duration. The scanner receives only its blind project-resource capability and configuration.
The runtime buffers observations in a finite in-memory session and invokes the consumer only with a
successfully completed snapshot. Failure, cancellation, timeout, incomplete coverage, or malformed
output invokes no consumer and leaves the last published blueprint untouched.

There is no durable provisional scan state, observation journal, restart replay, recovery lane,
heartbeat lease, or quarantine. `recover()` reports no pending work because incomplete work is
discarded. Canonical publication remains the responsibility of the atomic application/persistence
transaction path.

## Trust boundary

Host validates capability presence and ordinary result shapes, owns cancellation, and cleans up the
plugin graph. Plugins are trusted code in the same process. Proxy traps, Promise-species attacks, and
global-intrinsic mutation are not contained. Stronger isolation requires a future explicit product
decision and a process boundary.
