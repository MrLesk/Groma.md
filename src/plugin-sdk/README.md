# Scanner SDK

The public SDK is a narrow facade for implementing Groma's blind scanner contract. It exposes the
Core plugin registration types, scanner capability, bounded project-resource requests, cancellation,
and the one-way observation sink.

A scanner receives only declared source coverage and scanner configuration. It cannot read canonical
intent, previous evidence, reconciliation bindings, projections, or visual state. It must report
partial evidence or no claim when syntax is ambiguous.

The SDK does not provide package manifests, acquisition, scaffolding, trust policy, conformance
certification, or dynamic loading. The current Host composes only the built-in TypeScript/Bun scanner.
