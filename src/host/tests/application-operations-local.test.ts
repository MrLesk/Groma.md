import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { allowsCustomLocalCoordinationRoot } from "../../persistence/index.ts";

import {
  conformanceIds,
  exerciseApplicationOperations,
  expectedApplicationOperationsTrace,
  projectComponentSemantics,
} from "../../application/tests/conformance.ts";
import { createDefaultBootstrapRegistry, type HostSurface } from "../index.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function temporaryWorkspace() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "groma-application-local-"));
  roots.push(workspaceRoot);
  if (!allowsCustomLocalCoordinationRoot(process.platform)) return { workspaceRoot };
  const coordinationRoot = await mkdtemp(path.join(tmpdir(), "groma-application-locks-"));
  roots.push(coordinationRoot);
  return { coordinationRoot, workspaceRoot };
}

async function composition(workspace: Awaited<ReturnType<typeof temporaryWorkspace>>) {
  const surface: HostSurface = Object.freeze({
    start: () => ({ completion: Promise.resolve(), stop: async () => {} }),
  });
  const registry = createDefaultBootstrapRegistry({
    ...(workspace.coordinationRoot === undefined
      ? {}
      : { coordinationRoot: workspace.coordinationRoot }),
    entropy: (length) => new Uint8Array(length),
    surface,
  });
  const composed = await registry.compose({ workspaceRoot: workspace.workspaceRoot });
  if (!composed.ok) throw new Error("Default host composition failed");
  return composed.value;
}

describe("official local application operations composition", () => {
  test("atomically persists merge aliases and resolves chained references after restart", async () => {
    const workspace = await temporaryWorkspace();
    const first = await composition(workspace);
    expect(await first.operations.initialize({})).toMatchObject({ ok: true });

    const survivor = await first.operations.createComponent({
      component: { id: conformanceIds.rootB, name: "Survivor", type: "domain" },
    });
    const finalSurvivor = await first.operations.createComponent({
      component: { id: conformanceIds.serviceB, name: "Final survivor", type: "service" },
    });
    const obsolete = await first.operations.createComponent({
      component: { id: conformanceIds.rootA, name: "Obsolete", type: "domain" },
      relationships: [
        {
          id: conformanceIds.crossBranch,
          target: conformanceIds.rootB,
          type: "depends-on",
        },
      ],
    });
    const child = await first.operations.createComponent({
      component: {
        id: conformanceIds.nestedService,
        name: "Child",
        parent: conformanceIds.rootA,
        type: "service",
      },
    });
    const observer = await first.operations.createComponent({
      component: { id: conformanceIds.serviceA, name: "Observer", type: "service" },
      relationships: [
        {
          id: conformanceIds.sibling,
          target: conformanceIds.rootA,
          type: "observes",
        },
      ],
    });
    for (const result of [survivor, finalSurvivor, obsolete, child, observer]) {
      expect(result.status).toBe("committed");
    }
    if (obsolete.status !== "committed") return;
    const obsoleteRevision = obsolete.revisions.find(
      (entry) => entry.componentId === conformanceIds.rootA,
    )?.revision;
    if (obsoleteRevision === null || obsoleteRevision === undefined) {
      throw new Error("missing obsolete revision");
    }

    const firstMerge = await first.operations.mergeComponent({
      expectedRevision: obsoleteRevision,
      obsolete: conformanceIds.rootA,
      survivor: conformanceIds.rootB,
    });
    expect(firstMerge).toMatchObject({ status: "committed" });
    if (firstMerge.status !== "committed") return;
    expect(String(firstMerge.value.id)).toBe(conformanceIds.rootB);
    const survivorRevision = firstMerge.revisions.find(
      (entry) => entry.componentId === conformanceIds.rootB,
    )?.revision;
    if (survivorRevision === null || survivorRevision === undefined) {
      throw new Error("missing survivor revision");
    }

    const secondMerge = await first.operations.mergeComponent({
      expectedRevision: survivorRevision,
      obsolete: conformanceIds.rootB,
      survivor: conformanceIds.serviceB,
    });
    expect(secondMerge).toMatchObject({ status: "committed" });
    if (secondMerge.status !== "committed") return;
    expect(String(secondMerge.value.id)).toBe(conformanceIds.serviceB);

    const restarted = await composition(workspace);
    expect(await restarted.workspace.recover()).toMatchObject({ ok: true });
    const readThroughOldest = await restarted.operations.getComponent({
      id: conformanceIds.rootA,
      relationships: { limit: 10 },
    });
    expect(readThroughOldest.ok).toBeTrue();
    if (!readThroughOldest.ok) return;
    expect(String(readThroughOldest.value.item.component.id)).toBe(conformanceIds.serviceB);
    expect(
      readThroughOldest.value.relationships.items.map((item) => ({
        id: String(item.relationship.id),
        source: String(item.relationship.source),
        target: String(item.relationship.target),
      })),
    ).toEqual([
      {
        id: conformanceIds.crossBranch,
        source: conformanceIds.serviceB,
        target: conformanceIds.serviceB,
      },
    ]);

    const children = await restarted.operations.listChildren({
      limit: 10,
      parent: conformanceIds.rootA,
    });
    expect(children.ok).toBeTrue();
    if (!children.ok) return;
    expect(children.value.items.map((item) => String(item.component.id))).toEqual([
      conformanceIds.nestedService,
    ]);
    const observerRead = await restarted.operations.getComponent({
      id: conformanceIds.serviceA,
      relationships: { limit: 10 },
    });
    expect(observerRead.ok).toBeTrue();
    if (!observerRead.ok) return;
    expect(String(observerRead.value.relationships.items[0]?.relationship.target)).toBe(
      conformanceIds.serviceB,
    );

    const laterBinding = await restarted.operations.createComponent({
      component: {
        id: conformanceIds.module,
        name: "Later binding",
        parent: conformanceIds.rootA,
        type: "module",
      },
      relationships: [
        {
          id: "rel_000000000000000000000000000000cb",
          target: conformanceIds.rootA,
          type: "depends-on",
        },
      ],
    });
    expect(laterBinding).toMatchObject({
      status: "committed",
      value: { parent: conformanceIds.serviceB },
    });

    const restartedAgain = await composition(workspace);
    const canonicalStore = await restartedAgain.store.load();
    expect(canonicalStore.ok).toBeTrue();
    if (!canonicalStore.ok) return;
    expect(canonicalStore.value.entities.map((entity) => String(entity.id))).toContain(
      conformanceIds.nestedService,
    );
    const laterChildren = await restartedAgain.operations.listChildren({
      limit: 10,
      parent: conformanceIds.rootA,
    });
    expect(laterChildren.ok).toBeTrue();
    if (!laterChildren.ok) return;
    expect(laterChildren.value.items.map((item) => String(item.component.id))).toEqual([
      conformanceIds.module,
      conformanceIds.nestedService,
    ]);
    const laterRead = await restartedAgain.operations.getComponent({
      id: conformanceIds.module,
      relationships: { limit: 10 },
    });
    expect(laterRead.ok).toBeTrue();
    if (!laterRead.ok) return;
    expect(String(laterRead.value.item.component.parent)).toBe(conformanceIds.serviceB);
    expect(String(laterRead.value.relationships.items[0]?.relationship.target)).toBe(
      conformanceIds.serviceB,
    );
    const laterIntent = await readFile(
      path.join(
        workspace.workspaceRoot,
        "groma",
        "intent",
        conformanceIds.module.slice(4, 6),
        `${conformanceIds.module}.md`,
      ),
      "utf8",
    );
    expect(laterIntent).toContain(`parent: ${conformanceIds.serviceB}`);
    expect(laterIntent).toContain(`target: ${conformanceIds.serviceB}`);
    const survivorIntent = await readFile(
      path.join(
        workspace.workspaceRoot,
        "groma",
        "intent",
        conformanceIds.serviceB.slice(4, 6),
        `${conformanceIds.serviceB}.md`,
      ),
      "utf8",
    );
    expect(survivorIntent).toContain(`target: ${conformanceIds.serviceB}`);

    expect(await readFile(path.join(workspace.workspaceRoot, "groma", "aliases.md"), "utf8")).toBe(
      `---\nschema: groma/aliases/v0.1\naliases:\n  - source: ${conformanceIds.rootA}\n    target: ${conformanceIds.rootB}\n  - source: ${conformanceIds.rootB}\n    target: ${conformanceIds.serviceB}\n---\n`,
    );
    expect(
      await Bun.file(
        path.join(
          workspace.workspaceRoot,
          "groma",
          "intent",
          conformanceIds.rootA.slice(4, 6),
          `${conformanceIds.rootA}.md`,
        ),
      ).exists(),
    ).toBeFalse();
  });

  test("rejects invalid and ambiguous supersession without changing canonical state", async () => {
    const workspace = await temporaryWorkspace();
    const first = await composition(workspace);
    expect(await first.operations.initialize({})).toMatchObject({ ok: true });
    const obsolete = await first.operations.createComponent({
      component: { id: conformanceIds.rootA, name: "Obsolete" },
    });
    const survivor = await first.operations.createComponent({
      component: { id: conformanceIds.rootB, name: "Survivor" },
    });
    const alternative = await first.operations.createComponent({
      component: { id: conformanceIds.serviceB, name: "Alternative" },
    });
    expect(obsolete.status).toBe("committed");
    expect(survivor.status).toBe("committed");
    expect(alternative.status).toBe("committed");
    if (obsolete.status !== "committed" || survivor.status !== "committed") return;
    const obsoleteRevision = obsolete.revisions[0]?.revision;
    const survivorRevision = survivor.revisions[0]?.revision;
    if (
      obsoleteRevision === null ||
      obsoleteRevision === undefined ||
      survivorRevision === null ||
      survivorRevision === undefined
    ) {
      throw new Error("missing component revision");
    }
    const merged = await first.operations.mergeComponent({
      expectedRevision: obsoleteRevision,
      obsolete: conformanceIds.rootA,
      survivor: conformanceIds.rootB,
    });
    expect(merged.status).toBe("committed");
    if (merged.status !== "committed") return;
    const aliasPath = path.join(workspace.workspaceRoot, "groma", "aliases.md");
    const before = await readFile(aliasPath, "utf8");

    const rejected = [
      await first.operations.mergeComponent({
        expectedRevision: survivorRevision,
        obsolete: conformanceIds.rootB,
        survivor: conformanceIds.rootB,
      }),
      await first.operations.mergeComponent({
        expectedRevision: survivorRevision,
        obsolete: conformanceIds.rootB,
        survivor: "ent_ffffffffffffffffffffffffffffffff",
      }),
      await first.operations.mergeComponent({
        expectedRevision: survivorRevision,
        obsolete: conformanceIds.rootB,
        survivor: conformanceIds.rootA,
      }),
      await first.operations.mergeComponent({
        expectedRevision: survivorRevision,
        obsolete: conformanceIds.rootA,
        survivor: conformanceIds.serviceB,
      }),
      await first.operations.removeComponent({
        expectedRevision: survivorRevision,
        id: conformanceIds.rootB,
      }),
    ];
    expect(rejected.map((result) => result.status)).toEqual([
      "validation-rejected",
      "validation-rejected",
      "validation-rejected",
      "validation-rejected",
      "validation-rejected",
    ]);
    expect(
      rejected.map((result) =>
        result.status === "validation-rejected" ? result.diagnostics[0]?.code : "",
      ),
    ).toEqual([
      "self-component-alias",
      "missing-component-alias-target",
      "component-alias-cycle",
      "ambiguous-component-supersession",
      "component-is-alias-target",
    ]);
    expect(await readFile(aliasPath, "utf8")).toBe(before);
    const unchanged = await first.operations.getComponent({
      id: conformanceIds.rootB,
      relationships: { limit: 1 },
    });
    expect(unchanged.ok).toBeTrue();
    if (!unchanged.ok) return;
    expect(Number(unchanged.value.generation)).toBe(Number(merged.generation));
    expect(unchanged.value.item.revision).toBe(survivorRevision);
  });

  test("matches in-memory semantics and survives a complete restart", async () => {
    const workspace = await temporaryWorkspace();
    const first = await composition(workspace);
    const trace = await exerciseApplicationOperations(first.operations);
    expect(trace).toEqual(expectedApplicationOperationsTrace);
    expect(first.workspace.status()).toEqual({ state: "ready" });

    const restarted = await composition(workspace);
    expect(await restarted.workspace.recover()).toMatchObject({ ok: true });
    const finalPage = await restarted.operations.listComponents({ limit: 20 });
    expect(finalPage.ok).toBe(true);
    if (!finalPage.ok) return;
    expect(Number(finalPage.value.generation)).toBe(trace.final.generation);
    expect(finalPage.value.items.every((item) => item.revision.length > 0)).toBe(true);
    const restartedComponents = finalPage.value.items.map(({ component }) =>
      projectComponentSemantics(component),
    );
    expect(JSON.stringify(restartedComponents)).toBe(JSON.stringify(trace.final.components));
    expect(finalPage.value.items.map((item) => String(item.component.id))).toEqual([
      conformanceIds.rootA,
      conformanceIds.rootB,
      conformanceIds.serviceA,
      conformanceIds.serviceB,
      conformanceIds.nestedService,
    ]);

    const relationshipRead = await restarted.operations.getComponent({
      id: conformanceIds.serviceA,
      relationships: { limit: 20 },
    });
    expect(relationshipRead.ok && relationshipRead.value.relationships.items).toEqual([]);

    const markdown = await restarted.store.load();
    expect(markdown.ok).toBe(true);
    if (!markdown.ok) return;
    expect(markdown.value.documents).toHaveLength(5);
    expect(markdown.value.entities.map((entity) => String(entity.id))).toEqual(
      finalPage.value.items.map((item) => String(item.component.id)),
    );
    expect(markdown.value.relations).toEqual([]);
  });

  test("commits and recovers components whose aggregate items exceed the per-component bound", async () => {
    const workspace = await temporaryWorkspace();
    const first = await composition(workspace);
    expect(await first.operations.initialize({})).toMatchObject({ ok: true });
    const items = (prefix: string, length = 60) =>
      Array.from({ length }, (_, index) => ({
        id: `${prefix}-${String(index).padStart(2, "0")}`,
      }));

    const firstMutation = await first.operations.createComponent({
      component: {
        id: conformanceIds.rootA,
        inputs: items("first"),
        type: "domain",
      },
    });
    const secondMutation = await first.operations.createComponent({
      component: {
        id: conformanceIds.rootB,
        inputs: items("second"),
        type: "domain",
      },
    });
    expect(firstMutation.status).toBe("committed");
    expect(secondMutation.status).toBe("committed");

    const initialRead = await first.operations.listComponents({ limit: 2 });
    expect(initialRead.ok).toBeTrue();
    if (!initialRead.ok) return;
    expect(initialRead.value.items.map(({ component }) => component.inputs?.length)).toEqual([
      60, 60,
    ]);

    const restarted = await composition(workspace);
    expect(await restarted.workspace.recover()).toMatchObject({ ok: true });
    const restartedRead = await restarted.operations.listComponents({ limit: 2 });
    expect(restartedRead.ok).toBeTrue();
    if (!restartedRead.ok) return;
    expect(restartedRead.value.items.map(({ component }) => component.inputs?.length)).toEqual([
      60, 60,
    ]);
    expect(
      restartedRead.value.items.flatMap(({ component }) =>
        (component.inputs ?? []).map((item) => item.id),
      ),
    ).toHaveLength(120);
  });

  test("rejects an oversized final sparse component without bricking restart", async () => {
    const workspace = await temporaryWorkspace();
    const first = await composition(workspace);
    expect(await first.operations.initialize({})).toMatchObject({ ok: true });
    const items = (prefix: string, length = 60) =>
      Array.from({ length }, (_, index) => ({
        id: `${prefix}-${String(index).padStart(2, "0")}`,
      }));
    const created = await first.operations.createComponent({
      component: {
        id: conformanceIds.rootA,
        inputs: items("input"),
        type: "domain",
      },
    });
    expect(created.status).toBe("committed");
    if (created.status !== "committed") return;
    const revision = created.revisions[0]?.revision;
    if (revision === null || revision === undefined) throw new Error("missing create revision");

    const rejected = await first.operations.updateComponent({
      expectedRevision: revision,
      id: conformanceIds.rootA,
      patch: { outputs: items("output") },
    });
    expect(rejected.status).toBe("validation-rejected");
    expect(rejected.status === "validation-rejected" && rejected.diagnostics[0]?.code).toBe(
      "application-bound-exceeded",
    );
    const unchanged = await first.operations.getComponent({
      id: conformanceIds.rootA,
      relationships: { limit: 1 },
    });
    expect(unchanged.ok).toBeTrue();
    if (!unchanged.ok) return;
    expect(unchanged.value.generation).toBe(created.generation);
    expect(unchanged.value.item.revision).toBe(revision);
    expect(unchanged.value.item.component.inputs).toHaveLength(60);
    expect(unchanged.value.item.component.outputs).toBeUndefined();

    const restarted = await composition(workspace);
    expect(await restarted.workspace.recover()).toMatchObject({ ok: true });
    const restartedRead = await restarted.operations.getComponent({
      id: conformanceIds.rootA,
      relationships: { limit: 1 },
    });
    expect(restartedRead.ok).toBeTrue();
    if (!restartedRead.ok) return;
    expect(restartedRead.value.generation).toBe(created.generation);
    expect(restartedRead.value.item.revision).toBe(revision);
    expect(restartedRead.value.item.component.inputs).toHaveLength(60);
    expect(restartedRead.value.item.component.outputs).toBeUndefined();

    const atLimit = await restarted.operations.updateComponent({
      expectedRevision: restartedRead.value.item.revision,
      id: conformanceIds.rootA,
      patch: { outputs: items("accepted-output", 40) },
    });
    expect(atLimit.status).toBe("committed");
    if (atLimit.status !== "committed") return;
    expect(atLimit.value.inputs).toHaveLength(60);
    expect(atLimit.value.outputs).toHaveLength(40);
    const atLimitRevision = atLimit.revisions[0]?.revision;
    if (atLimitRevision === null || atLimitRevision === undefined) {
      throw new Error("missing at-limit update revision");
    }

    const atLimitRestart = await composition(workspace);
    expect(await atLimitRestart.workspace.recover()).toMatchObject({ ok: true });
    const atLimitRead = await atLimitRestart.operations.getComponent({
      id: conformanceIds.rootA,
      relationships: { limit: 1 },
    });
    expect(atLimitRead.ok).toBeTrue();
    if (!atLimitRead.ok) return;
    expect(atLimitRead.value.item.component.inputs).toHaveLength(60);
    expect(atLimitRead.value.item.component.outputs).toHaveLength(40);

    const replaced = await atLimitRestart.operations.updateComponent({
      expectedRevision: atLimitRevision,
      id: conformanceIds.rootA,
      patch: { inputs: null, outputs: items("replacement-output", 100) },
    });
    expect(replaced.status).toBe("committed");
    if (replaced.status !== "committed") return;
    expect(replaced.value.inputs).toBeUndefined();
    expect(replaced.value.outputs).toHaveLength(100);

    const finalRestart = await composition(workspace);
    expect(await finalRestart.workspace.recover()).toMatchObject({ ok: true });
    const finalRead = await finalRestart.operations.getComponent({
      id: conformanceIds.rootA,
      relationships: { limit: 1 },
    });
    expect(finalRead.ok).toBeTrue();
    if (!finalRead.ok) return;
    expect(finalRead.value.item.component.inputs).toBeUndefined();
    expect(finalRead.value.item.component.outputs).toHaveLength(100);
  });
});
