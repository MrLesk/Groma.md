import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

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
  const coordinationRoot = await mkdtemp(path.join(tmpdir(), "groma-application-locks-"));
  roots.push(workspaceRoot, coordinationRoot);
  return { coordinationRoot, workspaceRoot };
}

async function composition(workspace: Awaited<ReturnType<typeof temporaryWorkspace>>) {
  const surface: HostSurface = Object.freeze({
    start: () => ({ completion: Promise.resolve(), stop: async () => {} }),
  });
  const registry = createDefaultBootstrapRegistry({
    coordinationRoot: workspace.coordinationRoot,
    entropy: (length) => new Uint8Array(length),
    surface,
  });
  const composed = await registry.compose({ workspaceRoot: workspace.workspaceRoot });
  if (!composed.ok) throw new Error("Default host composition failed");
  return composed.value;
}

describe("official local application operations composition", () => {
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
});
