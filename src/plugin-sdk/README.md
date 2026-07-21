# Scanner SDK

The public SDK is a narrow facade for implementing Groma's blind scanner contract. It exposes the
Core plugin registration types, scanner capability, bounded project-resource requests, cancellation,
and the one-way observation sink.

A scanner receives only declared source coverage and scanner configuration. It cannot read canonical
intent, previous evidence, reconciliation bindings, projections, or visual state. It must report
partial evidence or no claim when syntax is ambiguous.

The SDK does not provide package manifests, acquisition, scaffolding, trust policy, conformance
certification, or dynamic loading. The current Host composes only the built-in TypeScript/Bun scanner.

An independent local producer can submit one already-complete snapshot without loading as a runtime
plugin. First add its scanner ID to a registered project, then write the SDK's
`CompletedObservationSnapshot` shape as one bounded JSON document:

```json
{
  "apiVersion": "groma.observation/v1",
  "coverage": [{ "kinds": ["component-candidate"], "scope": "workspace", "state": "complete" }],
  "epoch": "epoch_example_0000000000000000000000000",
  "projectId": "project.default",
  "records": [
    {
      "candidate": { "name": "Orders", "type": "service" },
      "key": "component.orders",
      "kind": "component-candidate",
      "provenance": [
        {
          "fingerprint": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "resource": "src/orders.ts",
          "scope": "workspace"
        }
      ],
      "scope": "workspace"
    }
  ],
  "scopes": [{ "id": "workspace", "resourceRoot": "." }],
  "source": { "id": "example.scanner", "instance": "default", "version": "1.0.0" }
}
```

Submit it with `groma scan --input observations.json` or `groma scan --stdin`. Project, scanner,
and scope declarations must exactly match local registration. Groma canonicalizes the whole value
through the finite-session contract before using the same atomic reconciliation path as a built-in
scanner. Use a distinct scanner ID: external input cannot replace evidence owned by a loaded runtime
scanner provider. Invalid or incomplete input publishes nothing. This is a local completed-snapshot
handoff, not a streaming or remote transport.
