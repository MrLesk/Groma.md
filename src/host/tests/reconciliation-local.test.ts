import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createObservationSession,
  observationSessionApiVersion,
  parseResourceKey,
  type CompletedObservationSnapshot,
  type ComponentCandidateStructuralSignals,
  type ObservationRecord,
  type Result,
  type TransactionOutcome,
} from "../../core/index.ts";
import { createReconciliationOperations } from "../../application/index.ts";
import {
  allowsCustomLocalCoordinationRoot,
  jsonEvidenceIndexLocator,
  jsonEvidenceSourceLocator,
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

function candidate(
  key: string,
  name: string,
  signals?: ComponentCandidateStructuralSignals,
): ObservationRecord {
  return Object.freeze({
    candidate: Object.freeze({ name, type: "service" }),
    key,
    kind: "component-candidate",
    provenance,
    scope: "workspace",
    ...(signals === undefined ? {} : { signals: Object.freeze({ ...signals }) }),
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

function contains(key: string, from: string, to: string): ObservationRecord {
  return Object.freeze({
    from: Object.freeze({ key: from, scope: "workspace" }),
    key,
    kind: "relationship",
    provenance,
    relationshipType: "contains",
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
      const locator = jsonEvidenceIndexLocator();
      return locator.ok ? parseResourceKey(locator.value) : locator;
    },
    resourceForEvidenceSource: (sourceKey: string) => {
      const locator = jsonEvidenceSourceLocator(sourceKey);
      return locator.ok ? parseResourceKey(locator.value) : locator;
    },
  });
}

function evidenceIndexPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, "groma", "evidence", "index.json");
}

function evidenceSourcePath(
  workspaceRoot: string,
  sourceId = "groma.typescript-bun",
  sourceInstance = "builtin",
): string {
  const sourceKey = JSON.stringify(["project.local", sourceId, sourceInstance]);
  const locator = jsonEvidenceSourceLocator(sourceKey);
  if (!locator.ok) throw new Error("test evidence source locator is invalid");
  return path.join(workspaceRoot, ...String(locator.value).split("/"));
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
    const evidenceFiles = await readdir(path.join(workspace.workspaceRoot, "groma", "evidence"));
    const sourceFiles = evidenceFiles.filter((file) => file !== "index.json");
    expect(sourceFiles).toHaveLength(1);
    expect(
      await readFile(
        path.join(workspace.workspaceRoot, "groma", "evidence", sourceFiles[0]!),
        "utf8",
      ),
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
    const evidencePath = evidenceSourcePath(workspace.workspaceRoot);
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

  test("builds hierarchy, scale, and sharing from observed containment alone", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });

    const reconciled = await host.reconciliation.reconcile(
      snapshot("epoch-structure", [
        candidate("root", "Product"),
        candidate("area", "Area"),
        candidate("leaf", "Leaf"),
        candidate("lib", "Library", { reuseBreadth: 4 }),
        contains("c1", "root", "area"),
        contains("c2", "area", "leaf"),
      ]),
    );
    expect(reconciled).toMatchObject({ ok: true, value: { status: "committed" } });

    const listed = await host.operations.listComponents({ limit: 20 });
    expect(listed.ok).toBeTrue();
    if (!listed.ok) return;
    const byName = new Map(
      listed.value.items.map((item) => [item.component.name, item.component] as const),
    );
    const root = byName.get("Product")!;
    const area = byName.get("Area")!;
    const leaf = byName.get("Leaf")!;
    const library = byName.get("Library")!;

    // Depth in the observed structure places every component on the ladder.
    expect(root).toMatchObject({ scale: "system" });
    expect(area).toMatchObject({ parent: root.id, scale: "domain" });
    expect(leaf).toMatchObject({ parent: area.id, scale: "part" });
    // Breadth of use is coupling, so it marks sharing and never a scale.
    expect(library.scale).toBeUndefined();
    expect(library).toMatchObject({ shared: true });
    expect(library.parent).toBeUndefined();

    // Containment observations are structure, not ordinary relationships.
    const detail = await host.operations.getComponent({
      id: root.id,
      relationships: { limit: 10 },
    });
    expect(detail.ok).toBeTrue();
    if (!detail.ok) return;
    expect(detail.value.relationships.items).toHaveLength(0);

    // Curated structure wins and a rescan never fights it.
    const moved = await host.operations.updateComponent({
      expectedRevision: listed.value.items.find((item) => item.component.id === leaf.id)!.revision,
      id: leaf.id,
      patch: { scale: "element" },
    });
    expect(moved).toMatchObject({ status: "committed" });
    expect(
      await host.reconciliation.reconcile(
        snapshot("epoch-structure-again", [
          candidate("root", "Product"),
          candidate("area", "Area"),
          candidate("leaf", "Leaf"),
          candidate("lib", "Library", { reuseBreadth: 4 }),
          contains("c1", "root", "area"),
          contains("c2", "area", "leaf"),
        ]),
      ),
    ).toMatchObject({ ok: true, value: { status: "unchanged" } });
    const after = await host.operations.getComponent({ id: leaf.id, relationships: { limit: 1 } });
    expect(after.ok).toBeTrue();
    if (!after.ok) return;
    expect(after.value.item.component).toMatchObject({ scale: "element" });
  });

  test("fails closed when observed containment claims one component for two containers", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });
    expect(
      await host.reconciliation.reconcile(
        snapshot("epoch-ambiguous", [
          candidate("a", "A"),
          candidate("b", "B"),
          candidate("shared", "Shared"),
          contains("c1", "a", "shared"),
          contains("c2", "b", "shared"),
        ]),
      ),
    ).toMatchObject({
      diagnostics: [{ code: "observed-containment-ambiguous" }],
      ok: false,
    });
    expect(await host.operations.listComponents({ limit: 10 })).toMatchObject({
      ok: true,
      value: { items: [] },
    });
  });

  test("keeps structural scale proposals in evidence and reports curation drift without mutating intent", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });

    const partSignals = Object.freeze({ exportCount: 12, fileCount: 20, reuseBreadth: 3 });
    expect(
      await host.reconciliation.reconcile(
        snapshot("epoch-scale-proposal", [candidate("api", "API", partSignals)]),
      ),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    const listed = await host.operations.listComponents({ limit: 10 });
    expect(listed.ok).toBeTrue();
    if (!listed.ok) return;
    const automatic = listed.value.items[0]!;
    expect(automatic.component.scale).toBeUndefined();
    expect(
      await host.operations.getComponent({
        id: automatic.component.id,
        relationships: { limit: 10 },
      }),
    ).toMatchObject({
      ok: true,
      value: {
        evidence: [
          {
            scale: {
              derivation: "groma/structural-scale/v1",
              proposal: "part",
              status: "proposed",
            },
          },
        ],
        item: { component: { id: automatic.component.id } },
      },
    });

    expect(
      await host.operations.updateComponent({
        expectedRevision: automatic.revision,
        id: automatic.component.id,
        patch: { scale: "part" },
      }),
    ).toMatchObject({ status: "committed", value: { scale: "part" } });
    expect(
      await host.reconciliation.reconcile(
        snapshot("epoch-scale-aligned", [candidate("api", "API", partSignals)]),
      ),
    ).toMatchObject({ ok: true, value: { status: "unchanged" } });
    expect(
      await host.operations.getComponent({
        id: automatic.component.id,
        relationships: { limit: 10 },
      }),
    ).toMatchObject({
      ok: true,
      value: {
        evidence: [{ scale: { curated: "part", proposal: "part", status: "aligned" } }],
        item: { component: { scale: "part" } },
      },
    });

    const domainSignals = Object.freeze({ exportCount: 80, fileCount: 80, reuseBreadth: 10 });
    expect(
      await host.reconciliation.reconcile(
        snapshot("epoch-scale-drift", [candidate("api", "API", domainSignals)]),
      ),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    expect(
      await host.operations.getComponent({
        id: automatic.component.id,
        relationships: { limit: 10 },
      }),
    ).toMatchObject({
      ok: true,
      value: {
        evidence: [{ scale: { curated: "part", proposal: "domain", status: "drift" } }],
        item: { component: { scale: "part" } },
      },
    });
  });

  test("leaves a threshold-straddling automatic component unscaled", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });
    expect(
      await host.reconciliation.reconcile(
        snapshot("epoch-scale-ambiguous", [
          candidate("api", "API", { fileCount: 80, reuseBreadth: 1 }),
        ]),
      ),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    const listed = await host.operations.listComponents({ limit: 10 });
    expect(listed.ok).toBeTrue();
    if (!listed.ok) return;
    const automatic = listed.value.items[0]!;
    expect(automatic.component.scale).toBeUndefined();
    expect(
      await host.operations.getComponent({
        id: automatic.component.id,
        relationships: { limit: 10 },
      }),
    ).toMatchObject({
      ok: true,
      value: {
        evidence: [
          {
            scale: {
              candidates: ["domain", "element"],
              status: "ambiguous",
            },
          },
        ],
        item: { component: { id: automatic.component.id } },
      },
    });
  });

  test("keeps curated detail empty and resolves automatic evidence through an alias", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });
    expect(
      await host.reconciliation.reconcile(
        snapshot("epoch-alias", [candidate("observed", "Observed"), candidate("stale", "Stale")]),
      ),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    const page = await host.operations.listComponents({ limit: 10 });
    expect(page.ok).toBeTrue();
    if (!page.ok) return;
    const observed = page.value.items.find((item) => item.component.name === "Observed")!;
    const stale = page.value.items.find((item) => item.component.name === "Stale")!;
    const curatedId = "ent_ffffffffffffffffffffffffffffffff";
    const curated = await host.operations.createComponent({
      component: { id: curatedId, intent: "Curated meaning", name: "Curated" },
    });
    expect(curated).toMatchObject({ status: "committed" });
    expect(
      await host.operations.removeComponent({
        expectedRevision: stale.revision,
        id: stale.component.id,
      }),
    ).toMatchObject({ status: "committed" });
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

    const evidencePath = evidenceSourcePath(workspace.workspaceRoot);
    const validEvidence = await readFile(evidencePath, "utf8");
    const malformedEvidence = validEvidence.replace(
      /"sourceKey": "[^"]*(?:\\.[^"]*)*"/,
      '"sourceKey": null',
    );
    expect(malformedEvidence).not.toBe(validEvidence);
    await writeFile(evidencePath, malformedEvidence);
    expect(
      await host.operations.getComponent({ id: curatedId, relationships: { limit: 1 } }),
    ).toMatchObject({ diagnostics: [{ code: "provider-snapshot-failed" }], ok: false });
  });

  test("migrates an observed component binding through a curated merge on rescan", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });
    const records = Object.freeze([
      candidate("observed", "Observed"),
      candidate("dependency", "Dependency"),
      candidate("replacement", "Replacement"),
      action("serve", "observed"),
      relationship("observed-dependency", "observed", "dependency"),
    ]);
    expect(await host.reconciliation.reconcile(snapshot("epoch-merge", records))).toMatchObject({
      ok: true,
      value: { status: "committed" },
    });
    const automatic = await host.operations.listComponents({ limit: 10 });
    expect(automatic.ok).toBeTrue();
    if (!automatic.ok) return;
    const observed = automatic.value.items.find((item) => item.component.name === "Observed")!;
    const dependency = automatic.value.items.find((item) => item.component.name === "Dependency")!;
    const replacement = automatic.value.items.find(
      (item) => item.component.name === "Replacement",
    )!;
    const curatedId = "ent_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    expect(
      await host.operations.createComponent({
        component: { id: curatedId, intent: "Curated meaning", name: "Curated" },
      }),
    ).toMatchObject({ status: "committed" });
    expect(
      await host.operations.mergeComponent({
        expectedRevision: observed.revision,
        obsolete: observed.component.id,
        survivor: curatedId,
      }),
    ).toMatchObject({ status: "committed", value: { id: curatedId } });

    const evidencePath = evidenceSourcePath(workspace.workspaceRoot);
    const beforeRescan = await readFile(evidencePath, "utf8");
    const rescanned = await host.reconciliation.reconcile(snapshot("epoch-merge-rescan", records));
    expect(rescanned).toMatchObject({ ok: true, value: { status: "committed" } });
    if (!rescanned.ok || rescanned.value.status !== "committed") return;
    const migratedEvidence = await readFile(evidencePath, "utf8");
    expect(migratedEvidence).not.toBe(beforeRescan);
    expect(migratedEvidence).toContain(`"componentId": "${curatedId}"`);
    expect(migratedEvidence).not.toContain(`"componentId": "${observed.component.id}"`);

    const throughAlias = await host.operations.getComponent({
      id: observed.component.id,
      relationships: { limit: 10 },
    });
    expect(throughAlias.ok).toBeTrue();
    if (!throughAlias.ok) return;
    expect(throughAlias.value.item.component).toMatchObject({
      id: curatedId,
      intent: "Curated meaning",
      name: "Curated",
    });
    expect(throughAlias.value.evidence).toMatchObject([
      {
        binding: { key: "observed", present: true },
        records: expect.arrayContaining([
          expect.objectContaining({ key: "observed", kind: "component-candidate" }),
          expect.objectContaining({ key: "serve", kind: "action" }),
          expect.objectContaining({ key: "observed-dependency", kind: "relationship" }),
        ]),
      },
    ]);
    expect(throughAlias.value.relationships.items).toMatchObject([
      { relationship: { source: curatedId, target: dependency.component.id, type: "imports" } },
    ]);
    const listed = await host.operations.listComponents({ limit: 10 });
    expect(listed.ok).toBeTrue();
    if (!listed.ok) return;
    expect(listed.value.items.map((item) => item.component.name).sort()).toEqual([
      "Curated",
      "Dependency",
      "Replacement",
    ]);

    const changedRecords = Object.freeze([
      candidate("observed", "Observed"),
      candidate("dependency", "Dependency"),
      candidate("replacement", "Replacement"),
      action("serve", "observed"),
      relationship("observed-dependency", "observed", "replacement"),
    ]);
    const changed = await host.reconciliation.reconcile(
      snapshot("epoch-merge-relationship-change", changedRecords),
    );
    expect(changed).toMatchObject({ ok: true, value: { status: "committed" } });
    if (!changed.ok || changed.value.status !== "committed") return;
    const afterChange = await host.operations.getComponent({
      id: observed.component.id,
      relationships: { limit: 10 },
    });
    expect(afterChange).toMatchObject({
      ok: true,
      value: {
        relationships: {
          items: [{ relationship: { source: curatedId, target: replacement.component.id } }],
        },
      },
    });
    const changedEvidence = await readFile(evidencePath, "utf8");
    const repeated = await host.reconciliation.reconcile(
      snapshot("epoch-merge-repeat", changedRecords),
    );
    expect(repeated).toEqual({
      ok: true,
      value: { generation: changed.value.generation, status: "unchanged" },
    });
    expect(await readFile(evidencePath, "utf8")).toBe(changedEvidence);
    const restarted = await composition(workspace);
    expect(await restarted.workspace.recover()).toMatchObject({ ok: true });
    expect(
      await restarted.operations.getComponent({
        id: observed.component.id,
        relationships: { limit: 10 },
      }),
    ).toMatchObject({
      ok: true,
      value: {
        evidence: [{ binding: { key: "observed" } }],
        item: { component: { id: curatedId, intent: "Curated meaning" } },
      },
    });
  });

  test("rejects a rescan when two source bindings resolve to one survivor", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });
    const records = Object.freeze([candidate("left", "Left"), candidate("right", "Right")]);
    expect(await host.reconciliation.reconcile(snapshot("epoch-collision", records))).toMatchObject(
      {
        ok: true,
        value: { status: "committed" },
      },
    );
    const automatic = await host.operations.listComponents({ limit: 10 });
    expect(automatic.ok).toBeTrue();
    if (!automatic.ok) return;
    const left = automatic.value.items.find((item) => item.component.name === "Left")!;
    const right = automatic.value.items.find((item) => item.component.name === "Right")!;
    expect(
      await host.operations.mergeComponent({
        expectedRevision: left.revision,
        obsolete: left.component.id,
        survivor: right.component.id,
      }),
    ).toMatchObject({ status: "committed" });
    const evidencePath = evidenceSourcePath(workspace.workspaceRoot);
    const evidenceBeforeRescan = await readFile(evidencePath, "utf8");
    expect(
      await host.reconciliation.reconcile(snapshot("epoch-collision-rescan", records)),
    ).toMatchObject({
      diagnostics: [{ code: "reconciliation-binding-ambiguous" }],
      ok: false,
    });
    expect(await readFile(evidencePath, "utf8")).toBe(evidenceBeforeRescan);
  });

  test("rejects a rescan when a binding resolves to another source's target", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });
    expect(
      await host.reconciliation.reconcile(
        snapshot("epoch-left", [candidate("left", "Left")], "scanner.left"),
      ),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    expect(
      await host.reconciliation.reconcile(
        snapshot("epoch-right", [candidate("right", "Right")], "scanner.right"),
      ),
    ).toMatchObject({ ok: true, value: { status: "committed" } });
    const automatic = await host.operations.listComponents({ limit: 10 });
    expect(automatic.ok).toBeTrue();
    if (!automatic.ok) return;
    const left = automatic.value.items.find((item) => item.component.name === "Left")!;
    const right = automatic.value.items.find((item) => item.component.name === "Right")!;
    expect(
      await host.operations.mergeComponent({
        expectedRevision: left.revision,
        obsolete: left.component.id,
        survivor: right.component.id,
      }),
    ).toMatchObject({ status: "committed" });
    const evidencePath = evidenceSourcePath(workspace.workspaceRoot, "scanner.left");
    const evidenceBeforeRescan = await readFile(evidencePath, "utf8");
    expect(
      await host.reconciliation.reconcile(
        snapshot("epoch-left-rescan", [candidate("left", "Left")], "scanner.left"),
      ),
    ).toMatchObject({
      diagnostics: [{ code: "reconciliation-binding-ambiguous" }],
      ok: false,
    });
    expect(await readFile(evidencePath, "utf8")).toBe(evidenceBeforeRescan);
  });

  test("rejects a snapshot beyond the single-transaction component envelope", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });
    const records = Array.from({ length: defaultHostBounds.maxComponents + 1 }, (_, index) =>
      candidate(`component-${index}`, `Component ${index}`),
    );
    expect(await host.reconciliation.reconcile(snapshot("epoch-limit", records))).toMatchObject({
      diagnostics: [{ code: "reconciliation-component-limit" }],
      ok: false,
    });
    expect(await Bun.file(evidenceIndexPath(workspace.workspaceRoot)).exists()).toBeFalse();
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
    const intentDocument = await host.store.read(id);
    if (!intentDocument.ok) throw new Error(intentDocument.diagnostics[0]?.message);
    const intentPath = path.join(
      workspace.workspaceRoot,
      ...String(intentDocument.value.locator).split("/"),
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
      graph: host.graph,
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
    expect(snapshotCalls).toBe(6);
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

    const beforeRejected = await readFile(evidenceSourcePath(workspace.workspaceRoot), "utf8");
    const rejected = await host.reconciliation.reconcile(
      snapshot("epoch-3", [candidate("api", "API"), relationship("broken", "api", "missing")]),
    );
    expect(rejected).toMatchObject({
      diagnostics: [{ code: "unresolved-observation-reference" }],
      ok: false,
    });
    expect(await readFile(evidenceSourcePath(workspace.workspaceRoot), "utf8")).toBe(
      beforeRejected,
    );

    const rejectedMember = await host.reconciliation.reconcile(
      snapshot("epoch-member", [candidate("api", "API"), action("serve", "missing")]),
    );
    expect(rejectedMember).toMatchObject({
      diagnostics: [{ code: "unresolved-observation-reference" }],
      ok: false,
    });
    expect(await readFile(evidenceSourcePath(workspace.workspaceRoot), "utf8")).toBe(
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
    const evidencePath = evidenceSourcePath(workspace.workspaceRoot);
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
    const before = await readFile(evidenceSourcePath(workspace.workspaceRoot), "utf8");
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
    expect(await readFile(evidenceSourcePath(workspace.workspaceRoot), "utf8")).toBe(before);
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
      graph: host.graph,
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

  test("keeps bindings from a legacy fenced evidence file and converts on the next write", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });

    const first = await host.reconciliation.reconcile(
      snapshot("epoch-legacy-1", [candidate("api", "API")]),
    );
    expect(first).toMatchObject({ ok: true, value: { status: "committed" } });
    const firstPage = await host.operations.listComponents({ limit: 10 });
    expect(firstPage.ok).toBeTrue();
    if (!firstPage.ok) return;
    const boundId = firstPage.value.items[0]!.component.id;

    const canonicalRoot = path.join(workspace.workspaceRoot, "groma");
    const sourcePath = evidenceSourcePath(workspace.workspaceRoot);
    const sourceDocument = JSON.parse(await readFile(sourcePath, "utf8")) as {
      source: unknown;
    };
    const jsonBody = `${JSON.stringify(
      {
        evidence: { sources: [sourceDocument.source], version: 1 },
        schema: "groma/evidence/v0.1",
      },
      null,
      2,
    )}\n`;
    await rm(path.join(canonicalRoot, "evidence"), { recursive: true });
    await writeFile(
      path.join(canonicalRoot, "evidence.md"),
      `# Groma Evidence\n\n\`\`\`json\n${jsonBody.trimEnd()}\n\`\`\`\n`,
    );

    const restarted = await composition(workspace);
    const repeat = await restarted.reconciliation.reconcile(
      snapshot("epoch-legacy-2", [candidate("api", "API"), candidate("web", "Web")]),
    );
    expect(repeat).toMatchObject({ ok: true, value: { status: "committed" } });
    const repeatPage = await restarted.operations.listComponents({ limit: 10 });
    expect(repeatPage.ok).toBeTrue();
    if (!repeatPage.ok) return;
    expect(repeatPage.value.items).toHaveLength(2);
    expect(repeatPage.value.items.map((item) => item.component.id)).toContain(boundId);
    const converted = await readFile(sourcePath, "utf8");
    expect(converted.startsWith("{")).toBeTrue();
    expect(converted).toContain('"key": "api"');
    expect(await Bun.file(evidenceIndexPath(workspace.workspaceRoot)).exists()).toBeTrue();
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
