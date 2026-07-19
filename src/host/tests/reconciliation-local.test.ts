import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createObservationSession,
  observationSessionApiVersion,
  parseResourceKey,
  type CompletedObservationSnapshot,
  type ObservationRecord,
  type Result,
  type TransactionOutcome,
} from "../../core/index.ts";
import { createReconciliationOperations } from "../../application/index.ts";
import {
  allowsCustomLocalCoordinationRoot,
  markdownEvidenceLocator,
} from "../../persistence/index.ts";
import { createDefaultBootstrapRegistry, defaultHostBounds, type HostSurface } from "../index.ts";

const roots: string[] = [];
const provenance = Object.freeze([
  Object.freeze({
    fingerprint: "sha256:aaaaaaaaaaaaaaaa",
    resource: "src/index.ts",
    scope: "workspace",
  }),
]);

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.diagnostics.map((item) => item.code).join(", "));
  return result.value;
}

async function temporaryWorkspace() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "groma-reconciliation-local-"));
  roots.push(workspaceRoot);
  if (!allowsCustomLocalCoordinationRoot(process.platform)) return { workspaceRoot };
  const coordinationRoot = await mkdtemp(path.join(tmpdir(), "groma-reconciliation-locks-"));
  roots.push(coordinationRoot);
  return { coordinationRoot, workspaceRoot };
}

async function composition(workspace: Awaited<ReturnType<typeof temporaryWorkspace>>) {
  let entropyValue = 0;
  const surface: HostSurface = Object.freeze({
    start: () => ({ completion: Promise.resolve(), stop: async () => {} }),
  });
  const registry = createDefaultBootstrapRegistry({
    ...(workspace.coordinationRoot === undefined
      ? {}
      : { coordinationRoot: workspace.coordinationRoot }),
    entropy: (length) => new Uint8Array(length).fill(entropyValue++),
    surface,
  });
  const composed = await registry.compose({ workspaceRoot: workspace.workspaceRoot });
  if (!composed.ok) throw new Error("Default host composition failed");
  return composed.value;
}

function candidate(key: string, name: string): ObservationRecord {
  return Object.freeze({
    candidate: Object.freeze({ name, type: "service" }),
    key,
    kind: "component-candidate",
    provenance,
    scope: "workspace",
  });
}

function relationship(key: string, from: string, to: string): ObservationRecord {
  return Object.freeze({
    from: Object.freeze({ key: from, scope: "workspace" }),
    key,
    kind: "relationship",
    provenance,
    relationshipType: "imports",
    scope: "workspace",
    to: Object.freeze({ key: to, scope: "workspace" }),
  });
}

function action(key: string, component: string): ObservationRecord {
  return Object.freeze({
    component: Object.freeze({ key: component, scope: "workspace" }),
    key,
    kind: "action",
    name: "Serve",
    provenance,
    scope: "workspace",
  });
}

function member(kind: "input" | "output", key: string, component: string): ObservationRecord {
  return Object.freeze({
    component: Object.freeze({ key: component, scope: "workspace" }),
    key,
    kind,
    name: key,
    provenance,
    scope: "workspace",
  });
}

function snapshot(
  epoch: string,
  records: readonly ObservationRecord[],
  sourceId = "groma.typescript-bun",
  coverageState: "complete" | "partial" = "complete",
  coverageKinds: readonly ObservationRecord["kind"][] = Object.freeze([
    "action",
    "component-candidate",
    "documentation",
    "input",
    "output",
    "relationship",
  ]),
): CompletedObservationSnapshot {
  const session = valueOf(
    createObservationSession({
      apiVersion: observationSessionApiVersion,
      epoch,
      projectId: "project.local",
      scopes: Object.freeze([Object.freeze({ id: "workspace", resourceRoot: "." })]),
      source: Object.freeze({ id: sourceId, instance: "builtin", version: "1.0.0" }),
    }),
  );
  valueOf(session.submitBatch({ epoch, records, sequence: 1 }));
  return valueOf(
    session.complete({
      coverage: Object.freeze([
        Object.freeze({
          kinds: Object.freeze([...coverageKinds]),
          scope: "workspace",
          state: coverageState,
        }),
      ]),
      epoch,
      sequence: 2,
    }),
  );
}

function scopedMember(key: string): ObservationRecord {
  return Object.freeze({
    component: Object.freeze({ key: "api", scope: "workspace" }),
    key,
    kind: "input",
    name: key,
    provenance: Object.freeze([
      Object.freeze({
        fingerprint: "sha256:bbbbbbbbbbbbbbbb",
        resource: "contracts/api.ts",
        scope: "contracts",
      }),
    ]),
    scope: "contracts",
  });
}

function scopedSnapshot(
  epoch: string,
  records: readonly ObservationRecord[],
  memberCoverage: "complete" | "partial",
): CompletedObservationSnapshot {
  const session = valueOf(
    createObservationSession({
      apiVersion: observationSessionApiVersion,
      epoch,
      projectId: "project.local",
      scopes: Object.freeze([
        Object.freeze({ id: "contracts", resourceRoot: "contracts" }),
        Object.freeze({ id: "workspace", resourceRoot: "." }),
      ]),
      source: Object.freeze({
        id: "groma.typescript-bun",
        instance: "builtin",
        version: "1.0.0",
      }),
    }),
  );
  valueOf(session.submitBatch({ epoch, records, sequence: 1 }));
  return valueOf(
    session.complete({
      coverage: Object.freeze([
        Object.freeze({
          kinds: Object.freeze(["input" as const]),
          scope: "contracts",
          state: memberCoverage,
        }),
        Object.freeze({
          kinds: Object.freeze(["component-candidate" as const]),
          scope: "workspace",
          state: "complete" as const,
        }),
      ]),
      epoch,
      sequence: 2,
    }),
  );
}

function evidenceResourceMapper() {
  return Object.freeze({
    resourceForEvidence: () => {
      const locator = markdownEvidenceLocator();
      return locator.ok ? parseResourceKey(locator.value) : locator;
    },
  });
}

describe("local completed-snapshot reconciliation", () => {
  test("composes the built-in scanner directly into atomic reconciliation", async () => {
    const workspace = await temporaryWorkspace();
    await mkdir(path.join(workspace.workspaceRoot, "src"));
    await writeFile(
      path.join(workspace.workspaceRoot, "package.json"),
      JSON.stringify({ name: "self-scan-fixture" }),
    );
    await writeFile(
      path.join(workspace.workspaceRoot, "src", "index.ts"),
      "export function serve() { return 'ready'; }\n",
    );
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });
    const project = await host.projects.add({
      coverage: [{ id: "workspace", resourceRoot: "." }],
      name: "Fixture",
      scanners: [{ configuration: { include: ["src"] }, id: "official.typescript" }],
      source: ".",
    });
    expect(project.ok).toBeTrue();
    if (!project.ok) return;
    const started = await host.scanners.start({
      projectId: project.value.id,
      scannerId: "official.typescript",
    });
    expect(started.ok).toBeTrue();
    if (!started.ok) return;
    expect(await started.value.completion).toMatchObject({ status: "completed" });
    const components = await host.operations.listComponents({ limit: 10 });
    expect(components.ok).toBeTrue();
    if (!components.ok) return;
    expect(components.value.items.length).toBeGreaterThan(0);
    expect(
      await readFile(path.join(workspace.workspaceRoot, "groma", "evidence.md"), "utf8"),
    ).toContain("official.typescript");
  });

  test("publishes stable automatic identity and makes an equivalent rescan a byte no-op", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });

    const first = await host.reconciliation.reconcile(
      snapshot("epoch-1", [candidate("api", "API")]),
    );
    expect(first).toMatchObject({ ok: true, value: { status: "committed" } });
    if (!first.ok || first.value.status === "indeterminate") return;
    const firstPage = await host.operations.listComponents({ limit: 10 });
    expect(firstPage.ok).toBeTrue();
    if (!firstPage.ok) return;
    expect(firstPage.value.items).toHaveLength(1);
    const firstComponent = firstPage.value.items[0]!;
    const evidencePath = path.join(workspace.workspaceRoot, "groma", "evidence.md");
    const firstEvidence = await readFile(evidencePath, "utf8");
    const firstDetail = await host.operations.getComponent({
      id: firstComponent.component.id,
      relationships: { limit: 10 },
    });
    expect(firstDetail.ok).toBeTrue();
    if (!firstDetail.ok) return;
    expect(firstDetail.value.evidence).toEqual([
      {
        binding: { key: "api", present: true, scope: "workspace" },
        coverage: [
          {
            kinds: [
              "action",
              "component-candidate",
              "documentation",
              "input",
              "output",
              "relationship",
            ],
            scope: "workspace",
            state: "complete",
          },
        ],
        projectId: "project.local",
        records: [candidate("api", "API")],
        scanner: { id: "groma.typescript-bun", instance: "builtin", version: "1.0.0" },
      },
    ]);
    expect(await readFile(evidencePath, "utf8")).toBe(firstEvidence);

    const restartedBeforeRepeat = await composition(workspace);
    expect(await restartedBeforeRepeat.workspace.recover()).toMatchObject({ ok: true });
    const repeated = await restartedBeforeRepeat.reconciliation.reconcile(
      snapshot("epoch-2", [candidate("api", "API")]),
    );
    expect(repeated).toEqual({
      ok: true,
      value: { generation: first.value.generation, status: "unchanged" },
    });
    expect(await readFile(evidencePath, "utf8")).toBe(firstEvidence);

    const renamed = await host.reconciliation.reconcile(
      snapshot("epoch-3", [candidate("api", "Public API")]),
    );
    expect(renamed).toMatchObject({ ok: true, value: { status: "committed" } });
    const renamedPage = await host.operations.listComponents({ limit: 10 });
    expect(renamedPage.ok).toBeTrue();
    if (!renamedPage.ok) return;
    expect(renamedPage.value.items[0]?.component).toMatchObject({
      id: firstComponent.component.id,
      name: "Public API",
    });

    const restarted = await composition(workspace);
    expect(await restarted.workspace.recover()).toMatchObject({ ok: true });
    const afterRestart = await restarted.operations.listComponents({ limit: 10 });
    expect(afterRestart.ok).toBeTrue();
    if (!afterRestart.ok) return;
    expect(afterRestart.value.items[0]?.component.id).toBe(firstComponent.component.id);

    const evidenceBeforeRemoval = await readFile(evidencePath, "utf8");
    expect(
      await restarted.operations.removeComponent({
        expectedRevision: afterRestart.value.items[0]!.revision,
        id: firstComponent.component.id,
      }),
    ).toMatchObject({ status: "committed" });
    expect(
      await restarted.reconciliation.reconcile(
        snapshot("epoch-4", [candidate("api", "Public API")]),
      ),
    ).toMatchObject({
      diagnostics: [{ code: "reconciliation-binding-missing" }],
      ok: false,
    });
    expect(await readFile(evidencePath, "utf8")).toBe(evidenceBeforeRemoval);
  });

  test("keeps curated detail empty and resolves automatic evidence through an alias", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });
    expect(
      await host.reconciliation.reconcile(
        snapshot("epoch-alias", [candidate("observed", "Observed")]),
      ),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    const page = await host.operations.listComponents({ limit: 10 });
    expect(page.ok).toBeTrue();
    if (!page.ok) return;
    const observed = page.value.items[0]!;
    const curatedId = "ent_ffffffffffffffffffffffffffffffff";
    const curated = await host.operations.createComponent({
      component: { id: curatedId, intent: "Curated meaning", name: "Curated" },
    });
    expect(curated).toMatchObject({ status: "committed" });
    const curatedDetail = await host.operations.getComponent({
      id: curatedId,
      relationships: { limit: 1 },
    });
    expect(curatedDetail).toMatchObject({ ok: true, value: { evidence: [] } });

    const merged = await host.operations.mergeComponent({
      expectedRevision: observed.revision,
      obsolete: observed.component.id,
      survivor: curatedId,
    });
    expect(merged).toMatchObject({ status: "committed" });
    const throughAlias = await host.operations.getComponent({
      id: observed.component.id,
      relationships: { limit: 1 },
    });
    expect(throughAlias.ok).toBeTrue();
    if (!throughAlias.ok) return;
    expect(throughAlias.value.item.component).toMatchObject({
      id: curatedId,
      intent: "Curated meaning",
    });
    expect(throughAlias.value.evidence).toMatchObject([
      {
        binding: { key: "observed", present: true, scope: "workspace" },
        projectId: "project.local",
      },
    ]);

    const evidencePath = path.join(workspace.workspaceRoot, "groma", "evidence.md");
    const validEvidence = await readFile(evidencePath, "utf8");
    const malformedEvidence = validEvidence.replace('"version": 1', '"version": 2');
    expect(malformedEvidence).not.toBe(validEvidence);
    await writeFile(evidencePath, malformedEvidence);
    expect(
      await host.operations.getComponent({ id: curatedId, relationships: { limit: 1 } }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-evidence-state" }], ok: false });
  });

  test("rejects a snapshot beyond the single-transaction component envelope", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });
    const records = Array.from({ length: defaultHostBounds.maxEmbeddedItems + 1 }, (_, index) =>
      candidate(`component-${index}`, `Component ${index}`),
    );
    expect(await host.reconciliation.reconcile(snapshot("epoch-limit", records))).toMatchObject({
      diagnostics: [{ code: "reconciliation-component-limit" }],
      ok: false,
    });
    expect(
      await Bun.file(path.join(workspace.workspaceRoot, "groma", "evidence.md")).exists(),
    ).toBeFalse();
  });

  test("replans when a direct curated edit races revision confirmation", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });
    expect(
      await host.reconciliation.reconcile(snapshot("epoch-1", [candidate("api", "API")])),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    const components = await host.operations.listComponents({ limit: 10 });
    expect(components.ok).toBeTrue();
    if (!components.ok) return;
    const id = components.value.items[0]!.component.id;
    const intentPath = path.join(
      workspace.workspaceRoot,
      "groma",
      "intent",
      id.slice(4, 6),
      `${id}.md`,
    );
    const providerSnapshot = host.transactionProvider.snapshot.bind(host.transactionProvider);
    let snapshotCalls = 0;
    let executionCalls = 0;
    let entropyValue = 128;
    const raced = createReconciliationOperations({
      bounds: {
        maxComponents: defaultHostBounds.maxEmbeddedItems,
        maxEmbeddedItems: defaultHostBounds.maxEmbeddedItems,
        maxRecords: defaultHostBounds.maxComponents * defaultHostBounds.maxEmbeddedItems,
        maxRelationships: defaultHostBounds.maxRelationshipMutations,
        maxSnapshotAttempts: defaultHostBounds.maxSnapshotAttempts,
        maxSources: defaultHostBounds.maxComponents,
        maxTransactionDataDepth: defaultHostBounds.maxRequestDataDepth,
        maxTransactionDataValues: defaultHostBounds.maxSnapshotStateValues,
      },
      entropy: (length) => new Uint8Array(length).fill(entropyValue++),
      evidenceResourceMapper: evidenceResourceMapper(),
      resourceMapper: host.resourceMapper,
      snapshotStateDecoder: host.snapshotStateDecoder,
      transactionExecution: Object.freeze({
        execute: async (request: Parameters<typeof host.transactionEngine.execute>[0]) => {
          executionCalls += 1;
          return executionCalls === 1
            ? (Object.freeze({
                diagnostics: Object.freeze([
                  Object.freeze({ code: "fixture-conflict", message: "retry" }),
                ]),
                status: "conflict",
              }) as TransactionOutcome)
            : host.transactionEngine.execute(request);
        },
      }),
      transactionProvider: Object.freeze({
        snapshot: async (resources) => {
          snapshotCalls += 1;
          if (snapshotCalls === 2) {
            const before = await readFile(intentPath, "utf8");
            const after = before.replace("name: API", "name: Curated directly");
            expect(after).not.toBe(before);
            await writeFile(intentPath, after);
          }
          return providerSnapshot(resources);
        },
      }),
    });
    expect(
      await raced.reconcile(snapshot("epoch-2", [candidate("api", "Scanner rename")])),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    expect(snapshotCalls).toBe(4);
    expect(executionCalls).toBe(2);
    const afterRace = await host.operations.getComponent({ id, relationships: { limit: 1 } });
    expect(afterRace.ok).toBeTrue();
    if (!afterRace.ok) return;
    expect(afterRace.value.item.component.name).toBe("Curated directly");
  });

  test("preserves curated meaning, omissions, and other sources while references fail closed", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });
    expect(
      await host.reconciliation.reconcile(
        snapshot("epoch-1", [
          candidate("api", "API"),
          candidate("data", "Data"),
          relationship("api-data", "api", "data"),
        ]),
      ),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    const initial = await host.operations.listComponents({ limit: 10 });
    expect(initial.ok).toBeTrue();
    if (!initial.ok) return;
    const api = initial.value.items.find((item) => item.component.name === "API")!;
    const data = initial.value.items.find((item) => item.component.name === "Data")!;
    const initialApi = await host.operations.getComponent({
      id: api.component.id,
      relationships: { limit: 10 },
    });
    expect(initialApi.ok).toBeTrue();
    if (!initialApi.ok) return;
    const relationId = initialApi.value.relationships.items[0]!.relationship.id;
    const curated = await host.operations.updateComponent({
      expectedRevision: api.revision,
      id: api.component.id,
      patch: {
        inputs: [{ "example.test/note": "curated", id: "curated-input" }],
        intent: "Curated intent",
        name: "Customer API",
      },
    });
    expect(curated).toMatchObject({ status: "committed" });

    expect(
      await host.reconciliation.reconcile(
        snapshot(
          "epoch-partial",
          [candidate("api", "Renamed by scanner")],
          "groma.typescript-bun",
          "partial",
        ),
      ),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    const afterPartial = await host.operations.getComponent({
      id: api.component.id,
      relationships: { limit: 10 },
    });
    expect(afterPartial.ok).toBeTrue();
    if (!afterPartial.ok) return;
    expect(afterPartial.value.relationships.items).toHaveLength(1);

    expect(
      await host.reconciliation.reconcile(
        snapshot("epoch-2", [
          candidate("api", "Renamed by scanner"),
          member("input", "observed-input", "api"),
        ]),
      ),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    const afterCompleteOmission = await host.operations.getComponent({
      id: api.component.id,
      relationships: { limit: 10 },
    });
    expect(afterCompleteOmission.ok).toBeTrue();
    if (!afterCompleteOmission.ok) return;
    expect(afterCompleteOmission.value.relationships.items).toHaveLength(0);
    const staleRelationship = await host.reconciliation.reconcile(
      snapshot("epoch-stale-relation", [
        candidate("api", "Renamed by scanner"),
        relationship("api-data", "api", "data"),
      ]),
    );
    expect(staleRelationship).toMatchObject({
      diagnostics: [{ code: "unresolved-observation-reference" }],
      ok: false,
    });
    expect(
      await host.reconciliation.reconcile(
        snapshot("other-1", [candidate("api", "Other API")], "other.scanner"),
      ),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    const after = await host.operations.listComponents({ limit: 10 });
    expect(after.ok).toBeTrue();
    if (!after.ok) return;
    expect(after.value.items.map((item) => item.component.id)).toContain(data.component.id);
    expect(after.value.items.map((item) => item.component.name)).toEqual([
      "Customer API",
      "Data",
      "Other API",
    ]);
    expect(
      after.value.items.find((item) => item.component.id === api.component.id)?.component,
    ).toMatchObject({
      inputs: [{ extensions: { "example.test/note": "curated" }, id: "curated-input" }],
      intent: "Curated intent",
      name: "Customer API",
    });

    const beforeRejected = await readFile(
      path.join(workspace.workspaceRoot, "groma", "evidence.md"),
      "utf8",
    );
    const rejected = await host.reconciliation.reconcile(
      snapshot("epoch-3", [candidate("api", "API"), relationship("broken", "api", "missing")]),
    );
    expect(rejected).toMatchObject({
      diagnostics: [{ code: "unresolved-observation-reference" }],
      ok: false,
    });
    expect(await readFile(path.join(workspace.workspaceRoot, "groma", "evidence.md"), "utf8")).toBe(
      beforeRejected,
    );

    const rejectedMember = await host.reconciliation.reconcile(
      snapshot("epoch-member", [candidate("api", "API"), action("serve", "missing")]),
    );
    expect(rejectedMember).toMatchObject({
      diagnostics: [{ code: "unresolved-observation-reference" }],
      ok: false,
    });
    expect(await readFile(path.join(workspace.workspaceRoot, "groma", "evidence.md"), "utf8")).toBe(
      beforeRejected,
    );

    expect(
      await host.reconciliation.reconcile(
        snapshot("epoch-4", [
          candidate("api", "API"),
          candidate("data", "Data"),
          relationship("api-data", "api", "data"),
        ]),
      ),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    const reappeared = await host.operations.listComponents({ limit: 10 });
    expect(reappeared.ok).toBeTrue();
    if (!reappeared.ok) return;
    expect(
      reappeared.value.items.find((item) => item.component.name === "Data")?.component.id,
    ).toBe(data.component.id);
    const reappearedApi = await host.operations.getComponent({
      id: api.component.id,
      relationships: { limit: 10 },
    });
    expect(reappearedApi.ok).toBeTrue();
    if (!reappearedApi.ok) return;
    expect(reappearedApi.value.relationships.items[0]?.relationship.id).toBe(relationId);
  });

  test("counts retained and refreshed members in one component bound", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });
    const inputs = Array.from({ length: defaultHostBounds.maxEmbeddedItems }, (_, index) =>
      member("input", `input-${index}`, "api"),
    );
    expect(
      await host.reconciliation.reconcile(
        snapshot("epoch-inputs", [candidate("api", "API"), ...inputs]),
      ),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    const evidencePath = path.join(workspace.workspaceRoot, "groma", "evidence.md");
    const before = await readFile(evidencePath, "utf8");
    const outputs = Array.from({ length: defaultHostBounds.maxEmbeddedItems }, (_, index) =>
      member("output", `output-${index}`, "api"),
    );
    expect(
      await host.reconciliation.reconcile(
        snapshot(
          "epoch-outputs",
          [candidate("api", "API"), ...outputs],
          "groma.typescript-bun",
          "complete",
          ["component-candidate", "output"],
        ),
      ),
    ).toMatchObject({ diagnostics: [{ code: "reconciliation-item-limit" }], ok: false });
    expect(await readFile(evidencePath, "utf8")).toBe(before);
  });

  test("retains member evidence according to the member observation scope", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });
    expect(
      await host.reconciliation.reconcile(
        scopedSnapshot(
          "epoch-complete",
          [candidate("api", "API"), scopedMember("contract")],
          "complete",
        ),
      ),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    expect(
      await host.reconciliation.reconcile(
        scopedSnapshot("epoch-partial", [candidate("api", "API")], "partial"),
      ),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    const components = await host.operations.listComponents({ limit: 10 });
    expect(components.ok).toBeTrue();
    if (!components.ok) return;
    expect(components.value.items[0]?.component.inputs).toMatchObject([
      { id: "observation:contracts:contract", name: "contract" },
    ]);

    expect(
      await host.reconciliation.reconcile(
        scopedSnapshot(
          "epoch-partial-observed",
          [candidate("api", "API"), scopedMember("request")],
          "partial",
        ),
      ),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    const afterObservedPartial = await host.operations.listComponents({ limit: 10 });
    expect(afterObservedPartial.ok).toBeTrue();
    if (!afterObservedPartial.ok) return;
    expect(afterObservedPartial.value.items[0]?.component.inputs).toMatchObject([
      { id: "observation:contracts:contract", name: "contract" },
      { id: "observation:contracts:request", name: "request" },
    ]);
    const detail = await host.operations.getComponent({
      id: afterObservedPartial.value.items[0]!.component.id,
      relationships: { limit: 1 },
    });
    expect(detail.ok).toBeTrue();
    if (!detail.ok) return;
    expect(detail.value.evidence[0]?.coverage).toEqual([
      { kinds: ["input"], scope: "contracts", state: "partial" },
      { kinds: ["component-candidate"], scope: "workspace", state: "complete" },
    ]);
    expect(detail.value.evidence[0]?.records.map((record) => record.scope)).toEqual([
      "contracts",
      "workspace",
    ]);
  });

  test("advances automatic component ownership only for values applied to canonical state", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });
    expect(
      await host.reconciliation.reconcile(snapshot("epoch-1", [candidate("api", "API")])),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    const initial = await host.operations.listComponents({ limit: 10 });
    expect(initial.ok).toBeTrue();
    if (!initial.ok) return;
    const api = initial.value.items[0]!;
    expect(
      await host.operations.updateComponent({
        expectedRevision: api.revision,
        id: api.component.id,
        patch: {
          inputs: [{ "example.test/note": "curated", id: "curated-input" }],
          name: "Customer API",
        },
      }),
    ).toMatchObject({ status: "committed" });
    const observed = snapshot("epoch-2", [
      candidate("api", "Public API"),
      member("input", "request", "api"),
    ]);
    expect(await host.reconciliation.reconcile(observed)).toMatchObject({
      ok: true,
      value: { status: "committed" },
    });
    const curated = await host.operations.getComponent({
      id: api.component.id,
      relationships: { limit: 1 },
    });
    expect(curated.ok).toBeTrue();
    if (!curated.ok) return;
    expect(curated.value.item.component).toMatchObject({
      inputs: [{ extensions: { "example.test/note": "curated" }, id: "curated-input" }],
      name: "Customer API",
    });
    expect(
      await host.operations.updateComponent({
        expectedRevision: curated.value.item.revision,
        id: api.component.id,
        patch: { inputs: null, name: "API" },
      }),
    ).toMatchObject({ status: "committed" });
    expect(await host.reconciliation.reconcile(observed)).toMatchObject({
      ok: true,
      value: { status: "committed" },
    });
    const relinquished = await host.operations.getComponent({
      id: api.component.id,
      relationships: { limit: 1 },
    });
    expect(relinquished.ok).toBeTrue();
    if (!relinquished.ok) return;
    expect(relinquished.value.item.component).toMatchObject({
      inputs: [{ id: "observation:workspace:request", name: "request" }],
      name: "Public API",
    });
  });

  test("keeps curated relationship ownership at the last applied projection", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });
    expect(
      await host.reconciliation.reconcile(
        snapshot("epoch-1", [
          candidate("api", "API"),
          candidate("cache", "Cache"),
          candidate("data", "Data"),
          relationship("api-dependency", "api", "data"),
        ]),
      ),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    const components = await host.operations.listComponents({ limit: 10 });
    expect(components.ok).toBeTrue();
    if (!components.ok) return;
    const api = components.value.items.find((item) => item.component.name === "API")!;
    const cache = components.value.items.find((item) => item.component.name === "Cache")!;
    const data = components.value.items.find((item) => item.component.name === "Data")!;
    const initial = await host.operations.getComponent({
      id: api.component.id,
      relationships: { limit: 10 },
    });
    expect(initial.ok).toBeTrue();
    if (!initial.ok) return;
    const relation = initial.value.relationships.items[0]!.relationship;
    expect(
      await host.operations.updateComponent({
        expectedRevision: initial.value.item.revision,
        id: api.component.id,
        patch: {},
        relationships: {
          upsert: [
            {
              description: "Curated dependency",
              id: relation.id,
              target: data.component.id,
              type: relation.type,
            },
          ],
        },
      }),
    ).toMatchObject({ status: "committed" });
    const movedObservation = snapshot("epoch-2", [
      candidate("api", "API"),
      candidate("cache", "Cache"),
      candidate("data", "Data"),
      relationship("api-dependency", "api", "cache"),
    ]);
    expect(await host.reconciliation.reconcile(movedObservation)).toMatchObject({
      ok: true,
      value: { status: "committed" },
    });
    const curated = await host.operations.getComponent({
      id: api.component.id,
      relationships: { limit: 10 },
    });
    expect(curated.ok).toBeTrue();
    if (!curated.ok) return;
    expect(curated.value.relationships.items[0]?.relationship).toMatchObject({
      description: "Curated dependency",
      target: data.component.id,
    });
    expect(
      await host.operations.updateComponent({
        expectedRevision: curated.value.item.revision,
        id: api.component.id,
        patch: {},
        relationships: {
          upsert: [{ id: relation.id, target: data.component.id, type: relation.type }],
        },
      }),
    ).toMatchObject({ status: "committed" });
    expect(await host.reconciliation.reconcile(movedObservation)).toMatchObject({
      ok: true,
      value: { status: "committed" },
    });
    const relinquished = await host.operations.getComponent({
      id: api.component.id,
      relationships: { limit: 10 },
    });
    expect(relinquished.ok).toBeTrue();
    if (!relinquished.ok) return;
    expect(relinquished.value.relationships.items[0]?.relationship).toMatchObject({
      target: cache.component.id,
    });
    expect(relinquished.value.relationships.items[0]?.relationship.description).toBeUndefined();
  });

  test("does not resurrect a curated relationship after explicit removal", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });
    expect(
      await host.reconciliation.reconcile(
        snapshot("epoch-1", [
          candidate("api", "API"),
          candidate("data", "Data"),
          relationship("api-data", "api", "data"),
        ]),
      ),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    const components = await host.operations.listComponents({ limit: 10 });
    expect(components.ok).toBeTrue();
    if (!components.ok) return;
    const api = components.value.items.find((item) => item.component.name === "API")!;
    const data = components.value.items.find((item) => item.component.name === "Data")!;
    const exact = await host.operations.getComponent({
      id: api.component.id,
      relationships: { limit: 10 },
    });
    expect(exact.ok).toBeTrue();
    if (!exact.ok) return;
    const relation = exact.value.relationships.items[0]!.relationship;
    expect(
      await host.operations.updateComponent({
        expectedRevision: exact.value.item.revision,
        id: api.component.id,
        patch: {},
        relationships: {
          upsert: [
            {
              description: "Curated dependency",
              id: relation.id,
              target: data.component.id,
              type: relation.type,
            },
          ],
        },
      }),
    ).toMatchObject({ status: "committed" });
    expect(
      await host.reconciliation.reconcile(
        snapshot("epoch-2", [candidate("api", "API"), candidate("data", "Data")]),
      ),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    const curated = await host.operations.getComponent({
      id: api.component.id,
      relationships: { limit: 10 },
    });
    expect(curated.ok).toBeTrue();
    if (!curated.ok) return;
    expect(curated.value.relationships.items[0]?.relationship.description).toBe(
      "Curated dependency",
    );
    expect(
      await host.operations.updateComponent({
        expectedRevision: curated.value.item.revision,
        id: api.component.id,
        patch: {},
        relationships: { remove: [relation.id] },
      }),
    ).toMatchObject({ status: "committed" });
    const before = await readFile(
      path.join(workspace.workspaceRoot, "groma", "evidence.md"),
      "utf8",
    );
    expect(
      await host.reconciliation.reconcile(
        snapshot("epoch-3", [
          candidate("api", "API"),
          candidate("data", "Data"),
          relationship("api-data", "api", "data"),
        ]),
      ),
    ).toMatchObject({
      diagnostics: [{ code: "reconciliation-binding-missing" }],
      ok: false,
    });
    expect(await readFile(path.join(workspace.workspaceRoot, "groma", "evidence.md"), "utf8")).toBe(
      before,
    );
  });

  test("preserves an indeterminate transaction recovery outcome", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });
    const reconciliation = createReconciliationOperations({
      bounds: {
        maxComponents: defaultHostBounds.maxEmbeddedItems,
        maxEmbeddedItems: defaultHostBounds.maxEmbeddedItems,
        maxRecords: defaultHostBounds.maxRequestDataValues,
        maxRelationships: defaultHostBounds.maxRelationshipMutations,
        maxSnapshotAttempts: defaultHostBounds.maxSnapshotAttempts,
        maxSources: defaultHostBounds.maxComponents,
        maxTransactionDataDepth: defaultHostBounds.maxRequestDataDepth,
        maxTransactionDataValues: defaultHostBounds.maxSnapshotStateValues,
      },
      entropy: (length) => new Uint8Array(length),
      evidenceResourceMapper: evidenceResourceMapper(),
      resourceMapper: host.resourceMapper,
      snapshotStateDecoder: host.snapshotStateDecoder,
      transactionExecution: Object.freeze({
        execute: async () =>
          Object.freeze({
            diagnostics: Object.freeze([
              Object.freeze({ code: "transaction-outcome-indeterminate", message: "Recover" }),
            ]),
            recovery: Object.freeze({
              baseGeneration: 0,
              generation: 0,
              resources: Object.freeze([]),
              token: "fixture-recovery",
            }),
            status: "indeterminate",
          }) as unknown as TransactionOutcome,
      }),
      transactionProvider: host.transactionProvider,
    });
    const outcome = await reconciliation.reconcile(
      snapshot("epoch-indeterminate", [candidate("api", "API")]),
    );
    expect(outcome).toMatchObject({
      ok: true,
      value: {
        recovery: { token: "fixture-recovery" },
        status: "indeterminate",
      },
    });
  });

  test("rejects a present null evidence payload instead of resetting bindings", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });
    const canonicalRoot = path.join(workspace.workspaceRoot, "groma");
    await writeFile(
      path.join(canonicalRoot, "evidence.md"),
      '# Groma Evidence\n\n```json\n{"evidence":null,"schema":"groma/evidence/v0.1"}\n```\n',
    );
    const before = await readdir(canonicalRoot, { recursive: true });
    expect(
      await host.reconciliation.reconcile(snapshot("epoch-null", [candidate("api", "API")])),
    ).toMatchObject({
      diagnostics: [{ code: "reconciliation-snapshot-failed" }],
      ok: false,
    });
    expect(await readdir(canonicalRoot, { recursive: true })).toEqual(before);
  });
});
