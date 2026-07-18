import { defineScanner, type ObservationRecord, type Scanner } from "groma/plugin-sdk";

const record: ObservationRecord = {
  candidate: { name: "API" },
  key: "api",
  kind: "component-candidate",
  provenance: [
    {
      fingerprint: "sha256:aaaaaaaaaaaaaaaa",
      resource: "src/index.ts",
      scope: "app",
    },
  ],
  scope: "app",
};

export const conformingScanner: Scanner = defineScanner({
  async scan(request) {
    if (request.cancellation.isCancellationRequested()) {
      return {
        diagnostics: [{ code: "scanner-cancelled", message: "Scanner was cancelled" }],
        ok: false,
      };
    }
    const source = await request.resources.read({
      maxBytes: 4_096,
      resource: "src/index.ts",
      scope: "app",
    });
    if (!source.ok) return source;
    const batch = request.observations.submitBatch({
      epoch: request.session.epoch,
      records: [record],
      sequence: 1,
    });
    if (!batch.ok) return batch;
    return request.observations.complete({
      coverage: [
        {
          kinds: ["component-candidate"],
          scope: "app",
          state: "partial",
        },
      ],
      epoch: request.session.epoch,
      sequence: 2,
    });
  },
});
