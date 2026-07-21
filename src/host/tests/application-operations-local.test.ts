import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  test("filters every bounded component read before pagination and binds filters into cursors", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });
    const components = [
      {
        id: conformanceIds.rootA,
        name: "Match root A",
        scale: "domain" as const,
        shared: true,
      },
      {
        id: conformanceIds.rootB,
        name: "Match root B",
        scale: "domain" as const,
        shared: true,
      },
      {
        id: conformanceIds.serviceA,
        name: "Match service A",
        parent: conformanceIds.rootA,
        scale: "part" as const,
        shared: true,
      },
      {
        id: conformanceIds.serviceB,
        name: "Match service B",
        parent: conformanceIds.rootA,
        scale: "part" as const,
        shared: false,
      },
      {
        id: conformanceIds.nestedService,
        name: "Match nested service",
        parent: conformanceIds.rootA,
        scale: "part" as const,
        shared: true,
      },
      {
        id: conformanceIds.module,
        name: "Match unscaled module",
        parent: conformanceIds.rootA,
      },
    ];
    for (const component of components) {
      expect(await host.operations.createComponent({ component })).toMatchObject({
        status: "committed",
      });
    }

    const first = await host.operations.listComponents({
      limit: 1,
      scale: "domain",
      shared: true,
    });
    expect(first).toMatchObject({
      ok: true,
      value: { hasMore: true, items: [{ component: { id: conformanceIds.rootA } }] },
    });
    if (!first.ok || first.value.nextCursor === undefined) throw new Error("expected cursor");
    expect(
      await host.operations.listComponents({
        cursor: first.value.nextCursor,
        limit: 1,
        scale: "domain",
        shared: true,
      }),
    ).toMatchObject({
      ok: true,
      value: { hasMore: false, items: [{ component: { id: conformanceIds.rootB } }] },
    });
    expect(
      await host.operations.listComponents({
        cursor: first.value.nextCursor,
        limit: 1,
        scale: "domain",
        shared: false,
      }),
    ).toMatchObject({ diagnostics: [{ code: "cursor-query-mismatch" }], ok: false });
    expect(
      await host.operations.listRoots({ limit: 10, scale: "domain", shared: true }),
    ).toMatchObject({
      ok: true,
      value: {
        items: [
          { component: { id: conformanceIds.rootA } },
          { component: { id: conformanceIds.rootB } },
        ],
      },
    });
    expect(
      await host.operations.listChildren({
        limit: 10,
        parent: conformanceIds.rootA,
        scale: "part",
        shared: false,
      }),
    ).toMatchObject({
      ok: true,
      value: { items: [{ component: { id: conformanceIds.serviceB } }] },
    });

    const search = await host.operations.searchBlueprint({
      limit: 1,
      scale: "part",
      shared: true,
      text: "match",
    });
    expect(search).toMatchObject({
      ok: true,
      value: { hasMore: true, items: [{ id: conformanceIds.serviceA }] },
    });
    if (!search.ok || search.value.nextCursor === undefined) throw new Error("expected cursor");
    expect(
      await host.operations.searchBlueprint({
        cursor: search.value.nextCursor,
        limit: 1,
        scale: "part",
        shared: true,
        text: "match",
      }),
    ).toMatchObject({
      ok: true,
      value: { hasMore: false, items: [{ id: conformanceIds.nestedService }] },
    });

    expect(
      await host.operations.listComponents({ limit: 1, scale: "team" as never }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-component-scale" }], ok: false });
    expect(
      await host.operations.searchBlueprint({ limit: 1, shared: "yes" as never, text: "match" }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-component-shared" }], ok: false });
  });

  test("recovers and serves canonical state alongside incidental operating-system metadata", async () => {
    const workspace = await temporaryWorkspace();
    const first = await composition(workspace);
    expect(await first.operations.initialize({})).toMatchObject({ ok: true });
    expect(
      await first.operations.createComponent({
        component: { id: conformanceIds.rootA, name: "Platform", type: "system" },
      }),
    ).toMatchObject({ status: "committed" });
    expect(
      await first.operations.createComponent({
        component: {
          id: conformanceIds.serviceA,
          name: "API",
          parent: conformanceIds.rootA,
          type: "service",
        },
      }),
    ).toMatchObject({ status: "committed" });
    const canonicalRoot = path.join(workspace.workspaceRoot, "groma");
    await mkdir(path.join(canonicalRoot, "intent"), { recursive: true });
    await Promise.all([
      writeFile(path.join(canonicalRoot, ".DS_Store"), "finder"),
      writeFile(path.join(canonicalRoot, "components", ".DS_Store"), "finder"),
      writeFile(path.join(canonicalRoot, "components", "Platform", "Thumbs.db"), "explorer"),
      writeFile(path.join(canonicalRoot, "intent", "desktop.ini"), "shell"),
    ]);

    const restarted = await composition(workspace);

    expect(await restarted.workspace.recover()).toMatchObject({ ok: true });
    const components = await restarted.operations.listComponents({ limit: 10 });
    expect(components.ok).toBeTrue();
    if (!components.ok) return;
    expect(components.value.items.map((item) => String(item.component.id))).toEqual([
      conformanceIds.rootA,
      conformanceIds.serviceA,
    ]);
  });

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

    const renamedSurvivor = await first.operations.updateComponent({
      expectedRevision: survivorRevision,
      id: conformanceIds.rootB,
      patch: { name: "Renamed survivor" },
    });
    expect(renamedSurvivor).toMatchObject({ status: "committed" });
    if (renamedSurvivor.status !== "committed") return;
    expect(renamedSurvivor.revisions.map((entry) => entry.componentId)).toEqual([
      conformanceIds.rootB,
      conformanceIds.serviceA,
      conformanceIds.nestedService,
    ]);
    const renamedSurvivorRevision = renamedSurvivor.revisions.find(
      (entry) => entry.componentId === conformanceIds.rootB,
    )?.revision;
    if (renamedSurvivorRevision === null || renamedSurvivorRevision === undefined) {
      throw new Error("missing renamed survivor revision");
    }
    const afterAliasRename = await first.store.load();
    if (!afterAliasRename.ok) throw new Error(afterAliasRename.diagnostics[0]?.message);
    const childDocument = afterAliasRename.value.documents.find(
      (document) => document.entity.id === conformanceIds.nestedService,
    );
    const observerDocument = afterAliasRename.value.documents.find(
      (document) => document.entity.id === conformanceIds.serviceA,
    );
    if (childDocument === undefined || observerDocument === undefined) {
      throw new Error("missing alias-dependent document");
    }
    expect(new TextDecoder().decode(childDocument.bytes)).toContain(
      `[Renamed survivor](groma:component/${conformanceIds.rootA})`,
    );
    expect(new TextDecoder().decode(observerDocument.bytes)).toContain(
      `[Renamed survivor](groma:component/${conformanceIds.rootB}?relationship=${conformanceIds.sibling})`,
    );

    const secondMerge = await first.operations.mergeComponent({
      expectedRevision: renamedSurvivorRevision,
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
    const laterDocument = canonicalStore.value.documents.find(
      (document) => document.entity.id === conformanceIds.module,
    );
    const survivorDocument = canonicalStore.value.documents.find(
      (document) => document.entity.id === conformanceIds.serviceB,
    );
    expect(laterDocument).toBeDefined();
    expect(survivorDocument).toBeDefined();
    if (laterDocument === undefined || survivorDocument === undefined) return;
    const laterIntent = await readFile(
      path.join(workspace.workspaceRoot, ...String(laterDocument.locator).split("/")),
      "utf8",
    );
    expect(laterIntent).toContain(`[Final survivor](groma:component/${conformanceIds.serviceB})`);
    expect(laterIntent).toContain(
      `groma:component/${conformanceIds.serviceB}?relationship=rel_000000000000000000000000000000cb`,
    );
    const survivorIntent = await readFile(
      path.join(workspace.workspaceRoot, ...String(survivorDocument.locator).split("/")),
      "utf8",
    );
    expect(survivorIntent).toContain(`groma:component/${conformanceIds.serviceB}?relationship=`);

    expect(await readFile(path.join(workspace.workspaceRoot, "groma", "aliases.md"), "utf8")).toBe(
      `---\nschema: groma/aliases/v0.1\naliases:\n  - source: ${conformanceIds.rootA}\n    target: ${conformanceIds.rootB}\n  - source: ${conformanceIds.rootB}\n    target: ${conformanceIds.serviceB}\n---\n`,
    );
    expect(
      canonicalStore.value.documents.some(
        (document) => document.entity.id === conformanceIds.rootA,
      ),
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

  // This regression deliberately runs the complete semantic workflow through local persistence
  // and a restart. Keep a finite CI allowance above Bun's 5s unit default.
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
  }, 20_000);

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

  test("moves renamed and reparented component subtrees in one logical operation", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });

    const platform = await host.operations.createComponent({
      component: { id: conformanceIds.rootA, name: "Platform" },
    });
    const archive = await host.operations.createComponent({
      component: { id: conformanceIds.rootB, name: "Archive" },
    });
    const orders = await host.operations.createComponent({
      component: {
        id: conformanceIds.serviceA,
        name: "Orders",
        parent: conformanceIds.rootA,
      },
    });
    const worker = await host.operations.createComponent({
      component: {
        id: conformanceIds.nestedService,
        name: "Worker",
        parent: conformanceIds.serviceA,
      },
    });
    for (const result of [platform, archive, orders, worker]) {
      expect(result).toMatchObject({ status: "committed" });
    }
    if (platform.status !== "committed" || orders.status !== "committed") return;
    const platformRevision = platform.revisions.find(
      (entry) => entry.componentId === conformanceIds.rootA,
    )?.revision;
    if (platformRevision == null) throw new Error("missing revision");

    const renamed = await host.operations.updateComponent({
      expectedRevision: platformRevision,
      id: conformanceIds.rootA,
      patch: { name: "Commerce" },
    });
    expect(renamed).toMatchObject({ status: "committed" });
    if (renamed.status !== "committed") return;
    const renamedOrdersRevision = renamed.revisions.find(
      (entry) => entry.componentId === conformanceIds.serviceA,
    )?.revision;
    if (renamedOrdersRevision == null) throw new Error("missing renamed child revision");
    const afterRename = await host.store.load();
    if (!afterRename.ok) throw new Error(afterRename.diagnostics[0]?.message);
    expect(afterRename.value.documents.map((document) => String(document.locator))).toEqual([
      "groma/components/Commerce.md",
      "groma/components/Archive.md",
      "groma/components/Commerce/Orders.md",
      "groma/components/Commerce/Orders/Worker.md",
    ]);
    const ordersDocument = afterRename.value.documents.find(
      (document) => document.entity.id === conformanceIds.serviceA,
    );
    if (ordersDocument === undefined) throw new Error("missing Orders document");
    expect(new TextDecoder().decode(ordersDocument.bytes)).toContain(
      `[Commerce](groma:component/${conformanceIds.rootA})`,
    );

    expect(
      await host.operations.reparentComponent({
        expectedRevision: renamedOrdersRevision,
        id: conformanceIds.serviceA,
        parent: conformanceIds.rootB,
      }),
    ).toMatchObject({ status: "committed" });
    const restarted = await composition(workspace);
    expect(await restarted.workspace.recover()).toMatchObject({ ok: true });
    const afterReparent = await restarted.store.load();
    if (!afterReparent.ok) throw new Error(afterReparent.diagnostics[0]?.message);
    expect(afterReparent.value.documents.map((document) => String(document.locator))).toEqual([
      "groma/components/Commerce.md",
      "groma/components/Archive.md",
      "groma/components/Archive/Orders.md",
      "groma/components/Archive/Orders/Worker.md",
    ]);
  });

  test("refreshes incoming readable relationship labels when a target is renamed", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });

    const payments = await host.operations.createComponent({
      component: { id: conformanceIds.serviceB, name: "Payments" },
    });
    const api = await host.operations.createComponent({
      component: { id: conformanceIds.serviceA, name: "API" },
      relationships: [
        {
          id: conformanceIds.crossBranch,
          target: conformanceIds.serviceB,
          type: "uses",
        },
      ],
    });
    expect(payments).toMatchObject({ status: "committed" });
    expect(api).toMatchObject({ status: "committed" });
    if (payments.status !== "committed") return;
    const paymentsRevision = payments.revisions.find(
      (entry) => entry.componentId === conformanceIds.serviceB,
    )?.revision;
    if (paymentsRevision == null) throw new Error("missing Payments revision");

    const renamed = await host.operations.updateComponent({
      expectedRevision: paymentsRevision,
      id: conformanceIds.serviceB,
      patch: { name: "Billing" },
    });
    expect(renamed).toMatchObject({ status: "committed" });
    if (renamed.status !== "committed") return;
    expect(renamed.revisions.map((entry) => entry.componentId)).toEqual([
      conformanceIds.serviceA,
      conformanceIds.serviceB,
    ]);
    const loaded = await host.store.load();
    if (!loaded.ok) throw new Error(loaded.diagnostics[0]?.message);
    const apiDocument = loaded.value.documents.find(
      (document) => document.entity.id === conformanceIds.serviceA,
    );
    if (apiDocument === undefined) throw new Error("missing API document");
    expect(new TextDecoder().decode(apiDocument.bytes)).toContain(
      `[Billing](groma:component/${conformanceIds.serviceB}?relationship=${conformanceIds.crossBranch})`,
    );
  });

  test("fails closed when a component scale would be coarser than its parent", async () => {
    const workspace = await temporaryWorkspace();
    const host = await composition(workspace);
    expect(await host.operations.initialize({})).toMatchObject({ ok: true });

    const parent = await host.operations.createComponent({
      component: { id: conformanceIds.rootA, name: "Persistence", scale: "part", type: "service" },
    });
    expect(parent).toMatchObject({ status: "committed" });

    const coarser = await host.operations.createComponent({
      component: { id: conformanceIds.serviceA, parent: conformanceIds.rootA, scale: "domain" },
    });
    expect(coarser).toMatchObject({
      diagnostics: [{ code: "component-scale-coarser-than-parent" }],
      status: "validation-rejected",
    });

    const nested = await host.operations.createComponent({
      component: { id: conformanceIds.serviceA, parent: conformanceIds.rootA, scale: "part" },
    });
    expect(nested).toMatchObject({ status: "committed" });

    const unscaled = await host.operations.createComponent({
      component: { id: conformanceIds.serviceB, parent: conformanceIds.rootA },
    });
    expect(unscaled).toMatchObject({ status: "committed" });

    const parentRevision = (
      parent as { revisions: readonly { componentId: string; revision: string | null }[] }
    ).revisions.find((entry) => entry.componentId === conformanceIds.rootA)?.revision;
    if (parentRevision == null) throw new Error("expected a committed parent revision");
    const finer = await host.operations.updateComponent({
      expectedRevision: parentRevision,
      id: conformanceIds.rootA,
      patch: { scale: "element" },
    });
    expect(finer).toMatchObject({
      diagnostics: [{ code: "component-scale-coarser-than-parent" }],
      status: "validation-rejected",
    });
  });
});
