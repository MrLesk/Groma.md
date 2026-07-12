import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createApplicationOperations } from "../../application/index.ts";
import {
  conformanceIds,
  createStatefulSemanticInitializer,
  exerciseApplicationOperations,
  expectedApplicationOperationsTrace,
  projectComponentSemantics,
} from "../../application/tests/conformance.ts";
import {
  BoundedQueryContracts,
  GraphKernel,
  TransactionEngine,
  parseEntityId,
  parseResourceKey,
} from "../../core/index.ts";
import {
  createLocalResourceProvider,
  createLocalTransactionJournal,
  createMarkdownIntentStore,
  createMarkdownIntentTransactionAdapter,
  markdownIntentLocator,
} from "../../persistence/index.ts";
import {
  createStandardModelCapability,
  createStandardModelInvariant,
} from "../../standard-model/index.ts";

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
  const resources = await createLocalResourceProvider({
    ...workspace,
    staleLockMilliseconds: 1,
  });
  const model = createStandardModelCapability();
  const store = createMarkdownIntentStore({ model, resources });
  const provider = createLocalTransactionJournal({
    adapter: createMarkdownIntentTransactionAdapter({ model, store }),
    resources,
  });
  const engine = new TransactionEngine({
    maxAffectedIdentities: 100,
    maxRequestDataDepth: 30,
    maxRequestDataValues: 10_000,
    maxSnapshotStateDepth: 30,
    maxSnapshotStateValues: 100_000,
    provider,
  });
  const registered = engine.registerInvariant(
    createStandardModelInvariant({
      maxComponentMutations: 100,
      maxComponents: 1_000,
      maxOwnerCharacters: 100,
      maxPinnedComponentIds: 100,
      maxRelationshipMutations: 100,
      maxRelationships: 1_000,
    }),
  );
  if (!registered.ok) throw new Error("Standard Model invariant registration failed");
  const semanticInitialization = createStatefulSemanticInitializer();
  let entityCounter = 1_000;
  let relationCounter = 1_000;
  const graph = new GraphKernel({
    idSource: {
      nextEntityId: () => `ent_${(entityCounter++).toString(16).padStart(32, "0")}`,
      nextRelationId: () => `rel_${(relationCounter++).toString(16).padStart(32, "0")}`,
    },
    maxPageSize: 100,
  });
  const api = createApplicationOperations({
    bounds: {
      maxComponents: 1_000,
      maxDiagnosticCount: 100,
      maxEmbeddedItems: 100,
      maxRelationshipMutations: 100,
      maxRelationships: 1_000,
      maxRequestDataDepth: 30,
      maxRequestDataValues: 10_000,
      maxSnapshotStateDepth: 30,
      maxSnapshotStateValues: 100_000,
    },
    graph,
    initialization: semanticInitialization.capability,
    maxSnapshotAttempts: 3,
    model,
    queries: new BoundedQueryContracts({
      maxAnchorCharacters: 256,
      maxCursorCharacters: 2_048,
      maxPageSize: 20,
      maxQueryContextCharacters: 512,
    }),
    resourceMapper: {
      resourceForComponent: (value) => {
        const id = parseEntityId(value);
        if (!id.ok) return id;
        const locator = markdownIntentLocator(id.value);
        return locator.ok ? parseResourceKey(locator.value) : locator;
      },
    },
    transactionExecution: engine,
    transactionProvider: provider,
  });
  return { api, initialization: semanticInitialization, provider, resources, store };
}

describe("official local application operations composition", () => {
  test("matches in-memory semantics and survives a complete restart", async () => {
    const workspace = await temporaryWorkspace();
    const first = await composition(workspace);
    const trace = await exerciseApplicationOperations(first.api);
    expect(trace).toEqual(expectedApplicationOperationsTrace);
    expect(first.initialization.snapshot()).toEqual({
      components: [],
      generation: 0,
      relationships: [],
      state: "initialized",
    });

    const restarted = await composition(workspace);
    const finalPage = await restarted.api.listComponents({ limit: 20 });
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

    const relationshipRead = await restarted.api.getComponent({
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
