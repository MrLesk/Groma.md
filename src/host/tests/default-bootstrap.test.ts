import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  allowsCustomLocalCoordinationRoot,
  localTransactionStateLocator,
  markdownIntentLocator,
} from "../../persistence/index.ts";
import {
  canonicalSchemaMigrationApiVersion,
  parseEntityId,
  TransactionEngine,
} from "../../core/index.ts";

import {
  createDefaultBootstrapRegistry,
  defaultHostCapabilityIds,
  runHost,
  type DefaultBootstrapRegistryOptions,
  type HostComposition,
  type HostSurface,
  type HostSurfaceSession,
} from "../index.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function temporaryWorkspace() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "groma-host-composition-"));
  roots.push(workspaceRoot);
  if (!allowsCustomLocalCoordinationRoot(process.platform)) return { workspaceRoot };
  const coordinationRoot = await mkdtemp(path.join(tmpdir(), "groma-host-coordination-"));
  roots.push(coordinationRoot);
  return { coordinationRoot, workspaceRoot };
}

function idleSurface(): HostSurface {
  return {
    start: () =>
      ({
        completion: Promise.resolve(),
        stop: async () => {},
      }) satisfies HostSurfaceSession,
  };
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function directComponentRequest(composition: HostComposition, rawId: string, name: string) {
  const id = parseEntityId(rawId);
  if (!id.ok) throw new Error("invalid direct transaction entity fixture");
  const resource = composition.resourceMapper.resourceForComponent(id.value);
  if (!resource.ok) throw new Error("invalid direct transaction resource fixture");
  const locator = markdownIntentLocator(id.value);
  if (!locator.ok) throw new Error("invalid direct transaction locator fixture");
  return {
    locator: locator.value,
    request: {
      affected: { entities: [id.value], relations: [] },
      context: {
        ownership: { owner: "groma.application", plane: "intent" },
        pinnedComponentIds: [],
      },
      expectedRevisions: [{ expected: null, resource: resource.value }],
      mutation: {
        components: [{ component: { id: id.value, name, type: "domain" }, type: "create" }],
        relationships: [],
      },
    } satisfies Parameters<TransactionEngine["execute"]>[0],
  };
}

describe("default bootstrap registry", () => {
  test("publishes a projection-aware transaction engine for direct plugin commits", async () => {
    const context = await temporaryWorkspace();
    let failProjectionPublication = false;
    const registry = createDefaultBootstrapRegistry({
      ...(context.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: context.coordinationRoot }),
      resourceFaultInjector: (phase, fault) => {
        if (
          failProjectionPublication &&
          phase === "write" &&
          fault?.locator === ".groma-cache/projection-index.json"
        ) {
          throw new Error("injected projection publication failure");
        }
      },
      surface: idleSurface(),
    });
    const composed = await registry.compose({ workspaceRoot: context.workspaceRoot });
    if (!composed.ok) throw new Error("default composition failed");
    expect(await composed.value.workspace.initialize()).toMatchObject({ status: "initialized" });
    expect((await composed.value.projection.rebuild()).ok).toBeTrue();
    expect(composed.value.transactionEngine).toBeInstanceOf(TransactionEngine);
    const id = parseEntityId("ent_00000000000000000000000000000001");
    if (!id.ok) throw new Error("invalid direct transaction entity fixture");
    const resource = composed.value.resourceMapper.resourceForComponent(id.value);
    if (!resource.ok) throw new Error("invalid direct transaction resource fixture");

    const outcome = await composed.value.transactionEngine.execute({
      affected: { entities: [id.value], relations: [] },
      context: {
        ownership: { owner: "groma.application", plane: "intent" },
        pinnedComponentIds: [],
      },
      expectedRevisions: [{ expected: null, resource: resource.value }],
      mutation: {
        components: [
          {
            component: { id: id.value, name: "Direct plugin component", type: "domain" },
            type: "create",
          },
        ],
        relationships: [],
      },
    });
    const stored = JSON.parse(
      await readFile(
        path.join(context.workspaceRoot, ".groma-cache", "projection-index.json"),
        "utf8",
      ),
    ) as {
      readonly entities?: readonly { readonly searchableText?: string }[];
      readonly generation?: number;
    };

    expect(outcome.status).toBe("committed");
    expect(stored.generation).toBe(1);
    expect(
      stored.entities?.some((entity) => entity.searchableText?.includes("direct plugin component")),
    ).toBeTrue();

    failProjectionPublication = true;
    const secondId = parseEntityId("ent_00000000000000000000000000000002");
    if (!secondId.ok) throw new Error("invalid second direct transaction entity fixture");
    const secondResource = composed.value.resourceMapper.resourceForComponent(secondId.value);
    if (!secondResource.ok) throw new Error("invalid second direct transaction resource fixture");
    const secondOutcome = await composed.value.transactionEngine.execute({
      affected: { entities: [secondId.value], relations: [] },
      context: {
        ownership: { owner: "groma.application", plane: "intent" },
        pinnedComponentIds: [],
      },
      expectedRevisions: [{ expected: null, resource: secondResource.value }],
      mutation: {
        components: [
          {
            component: {
              id: secondId.value,
              name: "Canonical despite projection failure",
              type: "domain",
            },
            type: "create",
          },
        ],
        relationships: [],
      },
    });
    const staleProjection = JSON.parse(
      await readFile(
        path.join(context.workspaceRoot, ".groma-cache", "projection-index.json"),
        "utf8",
      ),
    ) as { readonly generation?: number };
    const canonical = await composed.value.transactionProvider.snapshot([]);
    const canonicalState = canonical.state as {
      readonly components?: readonly { readonly payload?: { readonly name?: string } }[];
    };

    expect(secondOutcome.status).toBe("committed");
    expect(staleProjection.generation).toBe(1);
    expect(canonical.generation).toBe(2);
    expect(
      canonicalState.components?.some(
        (component) => component.payload?.name === "Canonical despite projection failure",
      ),
    ).toBeTrue();

    failProjectionPublication = false;
    const repaired = await composed.value.projection.load();
    expect(repaired).toMatchObject({ ok: true, value: { generation: 2 } });
  });

  test("wires process cancellation into local projection loading", async () => {
    const context = await temporaryWorkspace();
    const cancellation = new AbortController();
    const registry = createDefaultBootstrapRegistry({
      ...(context.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: context.coordinationRoot }),
      surface: idleSurface(),
    });
    const composed = await registry.compose({
      cancellation: cancellation.signal,
      workspaceRoot: context.workspaceRoot,
    });
    if (!composed.ok) throw new Error("default composition failed");
    expect(await composed.value.workspace.initialize()).toMatchObject({ status: "initialized" });

    cancellation.abort();
    expect(await composed.value.projection.load()).toMatchObject({
      diagnostics: [
        {
          code: "projection-index-unavailable",
          details: { reason: "projection-load-cancelled" },
        },
      ],
      ok: false,
    });
  });

  test("publishes confirmed direct recoveries without reclassifying canonical success", async () => {
    const context = await temporaryWorkspace();
    let blockedCanonicalLocator: string | undefined;
    let failCanonicalPublication = false;
    let failProjectionPublication = false;
    const registry = createDefaultBootstrapRegistry({
      ...(context.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: context.coordinationRoot }),
      resourceFaultInjector: (phase, fault) => {
        if (
          failCanonicalPublication &&
          phase === "rename" &&
          fault?.locator === blockedCanonicalLocator
        ) {
          throw new Error("injected canonical target publication interruption");
        }
        if (
          failProjectionPublication &&
          phase === "write" &&
          fault?.locator === ".groma-cache/projection-index.json"
        ) {
          throw new Error("injected recovery projection publication failure");
        }
      },
      surface: idleSurface(),
    });
    const composed = await registry.compose({ workspaceRoot: context.workspaceRoot });
    if (!composed.ok) throw new Error("default composition failed");
    expect(await composed.value.workspace.initialize()).toMatchObject({ status: "initialized" });
    expect((await composed.value.projection.rebuild()).ok).toBeTrue();

    const first = directComponentRequest(
      composed.value,
      "ent_00000000000000000000000000000003",
      "Recovered plugin component",
    );
    blockedCanonicalLocator = first.locator;
    failCanonicalPublication = true;
    const uncertain = await composed.value.transactionEngine.execute(first.request);
    expect(uncertain.status).toBe("indeterminate");
    if (uncertain.status !== "indeterminate") throw new Error("expected direct recovery fixture");

    failCanonicalPublication = false;
    const recovered = await composed.value.transactionEngine.recover(uncertain.recovery);
    const recoveredProjection = JSON.parse(
      await readFile(
        path.join(context.workspaceRoot, ".groma-cache", "projection-index.json"),
        "utf8",
      ),
    ) as {
      readonly entities?: readonly { readonly searchableText?: string }[];
      readonly generation?: number;
    };
    expect(recovered.status).toBe("committed");
    expect(recoveredProjection.generation).toBe(1);
    expect(
      recoveredProjection.entities?.some((entity) =>
        entity.searchableText?.includes("recovered plugin component"),
      ),
    ).toBeTrue();

    const second = directComponentRequest(
      composed.value,
      "ent_00000000000000000000000000000004",
      "Recovered despite projection failure",
    );
    blockedCanonicalLocator = second.locator;
    failCanonicalPublication = true;
    const secondUncertain = await composed.value.transactionEngine.execute(second.request);
    expect(secondUncertain.status).toBe("indeterminate");
    if (secondUncertain.status !== "indeterminate") {
      throw new Error("expected second direct recovery fixture");
    }

    failCanonicalPublication = false;
    failProjectionPublication = true;
    const secondRecovered = await composed.value.transactionEngine.recover(
      secondUncertain.recovery,
    );
    const staleProjection = JSON.parse(
      await readFile(
        path.join(context.workspaceRoot, ".groma-cache", "projection-index.json"),
        "utf8",
      ),
    ) as { readonly generation?: number };
    const canonical = await composed.value.transactionProvider.snapshot([]);
    expect(secondRecovered.status).toBe("committed");
    expect(staleProjection.generation).toBe(1);
    expect(canonical.generation).toBe(2);

    failProjectionPublication = false;
    const repaired = await composed.value.projection.load();
    expect(repaired).toMatchObject({ ok: true, value: { generation: 2 } });
    expect(
      repaired.ok &&
        repaired.value.entities.some((entity) =>
          entity.searchableText.includes("recovered despite projection failure"),
        ),
    ).toBeTrue();
  });

  test("composes every 1A capability explicitly with stable shared identity", async () => {
    const context = await temporaryWorkspace();
    let byte = 0;
    const surface = idleSurface();
    const registry = createDefaultBootstrapRegistry({
      ...(context.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: context.coordinationRoot }),
      entropy: (length) => Uint8Array.from({ length }, () => byte++ % 256),
      surface,
    });
    const composed = await registry.compose({ workspaceRoot: context.workspaceRoot });

    expect(composed.ok).toBeTrue();
    if (!composed.ok) return;
    expect(composed.value.surface).not.toBe(surface);
    expect(Object.isFrozen(composed.value.surface)).toBeTrue();
    expect(composed.value.workspace.status()).toEqual({ state: "missing" });
    expect(composed.value.workspace.requireWorkspace()).toMatchObject({
      diagnostics: [{ code: "no-workspace" }],
      ok: false,
    });
    expect(await composed.value.workspace.initialize()).toMatchObject({ status: "initialized" });
    const created = await composed.value.operations.createComponent({
      component: { name: "Projected component", type: "domain" },
    });
    expect(created.status).toBe("committed");
    if (created.status !== "committed") throw new Error("expected committed component fixture");
    const projection = await composed.value.projection.load();
    expect(composed.value.projectionRead as unknown).toBe(composed.value.projection);
    expect(
      created.status === "committed" &&
        projection.ok &&
        projection.value.generation === created.generation,
    ).toBeTrue();
    expect(
      projection.ok &&
        projection.value.entities.some((item) =>
          item.searchableText.includes("projected component"),
        ),
    ).toBeTrue();
    const expectedProjection = projection.ok
      ? projection.value.entities.find((item) =>
          item.searchableText.includes("projected component"),
        )
      : undefined;
    expect(expectedProjection).toBeDefined();
    const queryIdentity = await composed.value.queryEngine.identity();
    if (!queryIdentity.ok) throw new Error("expected graph-query identity");
    expect(
      await composed.value.queryEngine.searchEntities(
        queryIdentity.value,
        { kind: "component", text: "projected component" },
        { limit: 1 },
      ),
    ).toEqual({
      ok: true,
      value: {
        generation: created.generation,
        hasMore: false,
        items: expectedProjection === undefined ? [] : [expectedProjection.entity],
      },
    });
    expect(
      await composed.value.operations.searchBlueprint({
        limit: 1,
        text: "projected component",
      }),
    ).toMatchObject({
      ok: true,
      value: {
        generation: created.generation,
        hasMore: false,
        items: [{ id: created.value.id, name: "Projected component" }],
      },
    });
    const maximumTermSearch = Array.from(
      { length: 32 },
      (_, index) => `a${index.toString(36).padStart(6, "0")}`,
    ).join(" ");
    expect(maximumTermSearch.length).toBe(255);
    expect(
      await composed.value.queryEngine.searchEntities(
        queryIdentity.value,
        { kind: "component", text: maximumTermSearch },
        { limit: 1 },
      ),
    ).toEqual({
      ok: true,
      value: { generation: created.generation, hasMore: false, items: [] },
    });
    expect(composed.value.workspace.requireWorkspace()).toEqual({
      ok: true,
      value: composed.value.operations,
    });
    expect(composed.value.transactionEngine).not.toBe(composed.value.transactionProvider);
    expect(Object.isFrozen(composed.value)).toBeTrue();
    expect(Object.keys(composed.value).sort()).toEqual([
      "graph",
      "invariant",
      "migrations",
      "model",
      "operations",
      "packages",
      "plugins",
      "projection",
      "projectionRead",
      "queries",
      "queryEngine",
      "resourceMapper",
      "resources",
      "snapshotStateDecoder",
      "store",
      "surface",
      "transactionEngine",
      "transactionProvider",
      "workspace",
    ]);
    const pluginInspection = composed.value.plugins?.inspect();
    expect(pluginInspection).toMatchObject({
      apiVersion: "groma.plugin/v1",
      plugins: [
        { id: "official.configuration-parser", phase: 0 },
        { id: "official.resources", phase: 0 },
        { id: "official.configuration-discovery", phase: 0 },
        { id: "official.kernel", phase: 1 },
        { id: "official.model", phase: 1 },
        { id: "official.persistence", phase: 1 },
        { id: "official.projection", phase: 1 },
        { id: "official.query-engine", phase: 1 },
        { id: "official.schema-migrations", phase: 1 },
        { id: "official.application", phase: 1 },
        { id: "official.surface", phase: 1 },
      ],
      state: "running",
    });
    const projectionContracts = (id: string) =>
      pluginInspection?.plugins
        .find((plugin) => plugin.id === id)
        ?.provides.filter((item) => item.id.startsWith("groma.projection-"))
        .map((item) => item.id);
    const projectionRequirements = (id: string) =>
      pluginInspection?.plugins
        .find((plugin) => plugin.id === id)
        ?.requires.filter((item) => item.id.startsWith("groma.projection-"))
        .map((item) => item.id);
    expect(projectionContracts("official.projection")).toEqual([
      defaultHostCapabilityIds.projection,
      defaultHostCapabilityIds.projectionRead,
    ]);
    expect(projectionRequirements("official.application")).toEqual([
      defaultHostCapabilityIds.projection,
    ]);
    expect(
      pluginInspection?.plugins
        .find((plugin) => plugin.id === "official.application")
        ?.requires.map((item) => item.id),
    ).toContain(defaultHostCapabilityIds.queryEngine);
    expect(defaultHostCapabilityIds.operations).toBe("groma.operations/v2");
    expect(defaultHostCapabilityIds.queryEngine).toBe("groma.graph-query/v2");
    expect(composed.value.plugins?.capabilities("groma.operations/v1", "1.0.0")).toEqual([]);
    expect(composed.value.plugins?.capabilities("groma.graph-query/v1", "1.0.0")).toEqual([]);
    expect(projectionRequirements("official.query-engine")).toEqual([
      defaultHostCapabilityIds.projectionRead,
    ]);
    const capabilityIdentities = [
      ["graph", defaultHostCapabilityIds.graph],
      ["invariant", defaultHostCapabilityIds.invariant],
      ["model", defaultHostCapabilityIds.model],
      ["migrations", defaultHostCapabilityIds.schemaMigrationOperations],
      ["operations", defaultHostCapabilityIds.operations],
      ["projection", defaultHostCapabilityIds.projection],
      ["projectionRead", defaultHostCapabilityIds.projectionRead],
      ["queryEngine", defaultHostCapabilityIds.queryEngine],
      ["queries", defaultHostCapabilityIds.queries],
      ["resourceMapper", defaultHostCapabilityIds.resourceMapper],
      ["resources", defaultHostCapabilityIds.resources],
      ["snapshotStateDecoder", defaultHostCapabilityIds.snapshotStateDecoder],
      ["store", defaultHostCapabilityIds.store],
      ["surface", defaultHostCapabilityIds.surface],
      ["transactionEngine", defaultHostCapabilityIds.transactionEngine],
      ["transactionProvider", defaultHostCapabilityIds.transactionProvider],
      ["workspace", defaultHostCapabilityIds.workspace],
    ] as const;
    for (const [field, id] of capabilityIdentities) {
      const providers = composed.value.plugins?.capabilities(id, "1.0.0");
      expect(providers).toHaveLength(1);
      expect(providers?.[0]?.value).toBe(composed.value[field]);
    }
    for (const id of [
      defaultHostCapabilityIds.configurationDiscovery,
      defaultHostCapabilityIds.configurationParser,
    ]) {
      expect(composed.value.plugins?.capabilities(id, "1.0.0")).toHaveLength(1);
    }
  });

  test("reports invalid process context without leaking the supplied path", async () => {
    const surface = idleSurface();
    const registry = createDefaultBootstrapRegistry({ surface });
    const relative = await registry.compose({ workspaceRoot: "relative/private" });

    expect(relative).toEqual({
      diagnostics: [
        {
          code: "invalid-host-process-context",
          message: "Host workspace root must be an absolute path",
        },
      ],
      ok: false,
    });
  });

  test("fails graph reads at the durable checkpoint seam without republishing", async () => {
    const context = await temporaryWorkspace();
    let failCheckpoint = false;
    let writesAfterFault = 0;
    const registry = createDefaultBootstrapRegistry({
      ...(context.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: context.coordinationRoot }),
      resourceFaultInjector: (phase, fault) => {
        if (failCheckpoint && phase === "write") writesAfterFault += 1;
        if (failCheckpoint && phase === "read" && fault?.locator === localTransactionStateLocator) {
          throw new Error("injected checkpoint-specific journal read failure");
        }
      },
      surface: idleSurface(),
    });
    const composed = await registry.compose({ workspaceRoot: context.workspaceRoot });
    if (!composed.ok) throw new Error("default composition failed");
    expect(await composed.value.workspace.initialize()).toMatchObject({ status: "initialized" });
    const created = await composed.value.operations.createComponent({
      component: { name: "Checkpoint component", type: "domain" },
    });
    if (created.status !== "committed") throw new Error("expected committed component fixture");
    const projection = await composed.value.projection.load();
    if (!projection.ok) throw new Error("expected projection fixture");
    const expected = projection.value.entities.find((item) =>
      item.searchableText.includes("checkpoint component"),
    );
    if (expected === undefined) throw new Error("expected projected component fixture");

    failCheckpoint = true;
    expect(await composed.value.queryEngine.identity()).toMatchObject({
      diagnostics: [{ code: "graph-query-unavailable" }],
      ok: false,
    });
    expect(writesAfterFault).toBe(0);

    failCheckpoint = false;
    const queryIdentity = await composed.value.queryEngine.identity();
    if (!queryIdentity.ok) throw new Error("expected graph-query identity");
    expect(
      await composed.value.queryEngine.searchEntities(
        queryIdentity.value,
        { kind: "component", text: "checkpoint component" },
        { limit: 1 },
      ),
    ).toEqual({
      ok: true,
      value: {
        generation: created.generation,
        hasMore: false,
        items: [expected.entity],
      },
    });
  });

  test("preserves an actionable unsupported runtime target diagnostic", async () => {
    const registry = createDefaultBootstrapRegistry({
      surface: idleSurface(),
      target: { architecture: "x64", platform: "freebsd" as never },
    });

    expect(await registry.compose({ workspaceRoot: "/absolute/workspace" })).toEqual({
      diagnostics: [
        {
          code: "unsupported-bootstrap-target",
          message: "Workspace bootstrap does not support this runtime platform or architecture",
        },
      ],
      ok: false,
    });
  });

  test("snapshots mutable bootstrap options before deferred composition", async () => {
    const context = await temporaryWorkspace();
    const surface = idleSurface() as Mutable<HostSurface>;
    const replacementSurface = idleSurface();
    let originalStarts = 0;
    let originalFaultBoundaries = 0;
    let replacedStarts = 0;
    let replacementFaultBoundaries = 0;
    surface.start = () => {
      originalStarts += 1;
      return { completion: Promise.resolve(), stop: async () => {} };
    };
    const options: Mutable<DefaultBootstrapRegistryOptions> = {
      ...(context.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: context.coordinationRoot }),
      entropy: (length) => new Uint8Array(length),
      resourceFaultInjector: () => {
        originalFaultBoundaries += 1;
      },
      surface,
    };
    const registry = createDefaultBootstrapRegistry(options);

    options.coordinationRoot = "relative/private-coordination-root";
    options.entropy = () => {
      throw new Error("/private/replaced-entropy");
    };
    options.resourceFaultInjector = () => {
      replacementFaultBoundaries += 1;
    };
    options.surface = replacementSurface;
    surface.start = () => {
      replacedStarts += 1;
      return { completion: Promise.resolve(), stop: async () => {} };
    };
    const composed = await registry.compose({ workspaceRoot: context.workspaceRoot });

    expect(composed.ok).toBeTrue();
    if (!composed.ok) return;
    expect(composed.value.surface).not.toBe(surface);
    expect(composed.value.surface).not.toBe(replacementSurface);
    const session = await composed.value.surface.start({
      cancellation: new AbortController().signal,
      initialization: Object.freeze({
        initialize: (request) => composed.value.operations.initialize(request),
      }),
      packages: composed.value.packages,
      recovery: { status: "not-required" },
      workspace: composed.value.workspace,
    });
    await session.completion;
    expect(await composed.value.workspace.initialize()).toMatchObject({ status: "initialized" });
    expect({ originalStarts, replacedStarts }).toEqual({ originalStarts: 1, replacedStarts: 0 });
    expect(originalFaultBoundaries).toBeGreaterThan(0);
    expect(replacementFaultBoundaries).toBe(0);
  });

  test("captures the surface start method with one property read", () => {
    let reads = 0;
    const surface = Object.create(null) as HostSurface;
    Object.defineProperty(surface, "start", {
      enumerable: true,
      get: () => {
        reads += 1;
        return () => ({ completion: Promise.resolve(), stop: async () => {} });
      },
    });

    createDefaultBootstrapRegistry({ surface });

    expect(reads).toBe(1);
  });

  test("initializes a missing workspace through the contained application view", async () => {
    const context = await temporaryWorkspace();
    let accessAfter: unknown;
    let accessBefore: unknown;
    let initializationFrozen = false;
    let initializationKeys: PropertyKey[] = [];
    let initializationResult: unknown;
    let initializationView: unknown;
    const registry = createDefaultBootstrapRegistry({
      ...(context.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: context.coordinationRoot }),
      entropy: (length) => new Uint8Array(length),
      surface: {
        start: async (surfaceContext) => {
          initializationView = surfaceContext.initialization;
          initializationFrozen = Object.isFrozen(surfaceContext.initialization);
          initializationKeys = Reflect.ownKeys(surfaceContext.initialization);
          accessBefore = surfaceContext.workspace.requireWorkspace();
          initializationResult = await surfaceContext.initialization.initialize({});
          accessAfter = surfaceContext.workspace.requireWorkspace();
          return { completion: Promise.resolve(), stop: async () => {} };
        },
      },
    });

    const outcome = await runHost({
      context: { workspaceRoot: context.workspaceRoot },
      registry,
      signalSource: { subscribe: () => () => {} },
    });

    expect(outcome).toEqual({ status: "completed" });
    expect(accessBefore).toMatchObject({
      diagnostics: [{ code: "no-workspace" }],
      ok: false,
    });
    expect(initializationResult).toMatchObject({ ok: true, value: { status: "initialized" } });
    expect(accessAfter).toMatchObject({ ok: true });
    if (typeof accessAfter === "object" && accessAfter !== null && "value" in accessAfter) {
      expect(initializationView).not.toBe(accessAfter.value);
      expect(Object.isFrozen(accessAfter.value)).toBeTrue();
    }
    expect({ initializationFrozen, initializationKeys }).toEqual({
      initializationFrozen: true,
      initializationKeys: ["initialize"],
    });
  });

  test("rechecks cancellation after the complete plugin graph starts", async () => {
    const context = await temporaryWorkspace();
    let reads = 0;
    const cancellation = Object.create(null) as AbortSignal;
    Object.defineProperty(cancellation, "aborted", {
      enumerable: true,
      get: () => {
        reads += 1;
        return reads >= 13;
      },
    });
    const registry = createDefaultBootstrapRegistry({
      ...(context.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: context.coordinationRoot }),
      entropy: (length) => new Uint8Array(length),
      surface: idleSurface(),
    });

    const composed = await registry.compose({
      cancellation,
      workspaceRoot: context.workspaceRoot,
    });

    expect(composed).toEqual({
      diagnostics: [
        {
          code: "host-composition-failed",
          message: "Selected plugin startup failed",
        },
      ],
      ok: false,
    });
    expect(reads).toBe(13);
  });

  test("composes plugin migration contributions through the runtime and contains their failures", async () => {
    const context = await temporaryWorkspace();
    await mkdir(path.join(context.workspaceRoot, "groma", "records", "plugin.example"), {
      recursive: true,
    });
    await writeFile(
      path.join(context.workspaceRoot, "groma", "groma.yaml"),
      "schema: groma/v0.1\nplugins:\n  - official.test-schema-migrator\n",
    );
    await writeFile(
      path.join(context.workspaceRoot, "groma", "records", "plugin.example", "state.json"),
      '{"schema":"plugin.example/v0","value":true}\n',
    );
    const registration = Object.freeze({
      manifest: Object.freeze({
        apiVersion: "groma.plugin/v1" as const,
        id: "official.test-schema-migrator",
        phase: 1 as const,
        provides: Object.freeze([
          Object.freeze({
            cardinality: "multiple" as const,
            id: defaultHostCapabilityIds.schemaMigrators,
            version: "1.0.0",
          }),
        ]),
        requires: Object.freeze([]),
        version: "1.0.0",
      }),
      start: () =>
        Object.freeze({
          capabilities: Object.freeze([
            Object.freeze({
              id: defaultHostCapabilityIds.schemaMigrators,
              value: Object.freeze({
                apiVersion: canonicalSchemaMigrationApiVersion,
                id: "plugin.example-schemas",
                migrators: Object.freeze([
                  Object.freeze({
                    fromSchema: "plugin.example/v0",
                    fromVersion: 0,
                    id: "plugin.example-throwing",
                    migrate: () => {
                      throw new Error("plugin failure");
                    },
                    toSchema: "plugin.example/v1",
                    toVersion: 1,
                  }),
                ]),
                schemas: Object.freeze([
                  Object.freeze({ schema: "plugin.example/v0", version: 0 }),
                  Object.freeze({ schema: "plugin.example/v1", version: 1 }),
                ]),
              }),
              version: "1.0.0",
            }),
          ]),
        }),
    });
    const composed = await createDefaultBootstrapRegistry({
      additionalRuntimePlugins: Object.freeze([registration]),
      surface: idleSurface(),
    }).compose({ workspaceRoot: context.workspaceRoot });

    expect(composed.ok).toBeTrue();
    if (!composed.ok || composed.value.migrations === undefined) return;
    expect(await composed.value.migrations.preview()).toMatchObject({
      diagnostics: [{ code: "schema-migrator-threw" }],
      ok: false,
    });
    expect(
      composed.value.plugins?.capabilities(defaultHostCapabilityIds.schemaMigrators, "1.0.0"),
    ).toHaveLength(2);
  });

  test("keeps project-code loading isolated to the trust-gated local package boundary", async () => {
    const hostRoot = path.resolve(import.meta.dir, "..");
    const productionFiles = (await readdir(hostRoot)).filter((file) => file.endsWith(".ts")).sort();
    const sources = await Promise.all(
      productionFiles.map((file) => readFile(path.join(hostRoot, file), "utf8")),
    );
    const production = sources.join("\n");

    expect(production).not.toContain("node:http");
    expect(production).not.toContain("Bun.serve");
    expect(production).not.toContain('from "react"');
    const dynamicLoadingFiles = sources.filter((source) => source.includes("import("));
    expect(dynamicLoadingFiles).toHaveLength(1);
    expect(productionFiles[sources.indexOf(dynamicLoadingFiles[0]!)]).toBe(
      "plugin-module-loader.ts",
    );
    expect(production).toContain("plugin-full-user-permissions-trust-required");
    expect(production).not.toContain("projectPlugin");
  });
});
