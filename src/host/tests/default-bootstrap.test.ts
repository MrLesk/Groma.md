import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { allowsCustomLocalCoordinationRoot } from "../../persistence/index.ts";

import {
  createDefaultBootstrapRegistry,
  defaultHostCapabilityIds,
  runHost,
  type DefaultBootstrapRegistryOptions,
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

describe("default bootstrap registry", () => {
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
    expect(composed.value.workspace.requireWorkspace()).toEqual({
      ok: true,
      value: composed.value.operations,
    });
    expect(composed.value.transactionEngine).not.toBe(composed.value.transactionProvider);
    expect(Object.isFrozen(composed.value)).toBeTrue();
    expect(Object.keys(composed.value).sort()).toEqual([
      "graph",
      "invariant",
      "model",
      "operations",
      "plugins",
      "queries",
      "resourceMapper",
      "resources",
      "snapshotStateDecoder",
      "store",
      "surface",
      "transactionEngine",
      "transactionProvider",
      "workspace",
    ]);
    expect(composed.value.plugins?.inspect()).toMatchObject({
      apiVersion: "groma.plugin/v1",
      plugins: [
        { id: "official.resources", phase: 0 },
        { id: "official.kernel", phase: 1 },
        { id: "official.model", phase: 1 },
        { id: "official.persistence", phase: 1 },
        { id: "official.application", phase: 1 },
        { id: "official.surface", phase: 1 },
      ],
      state: "running",
    });
    const capabilityIdentities = [
      ["graph", defaultHostCapabilityIds.graph],
      ["invariant", defaultHostCapabilityIds.invariant],
      ["model", defaultHostCapabilityIds.model],
      ["operations", defaultHostCapabilityIds.operations],
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
          message: "Built-in plugin startup was cancelled",
        },
      ],
      ok: false,
    });
    expect(reads).toBe(13);
  });

  test("contains no server, React, dynamic plugin, or project-code loading path", async () => {
    const hostRoot = path.resolve(import.meta.dir, "..");
    const productionFiles = (await readdir(hostRoot)).filter((file) => file.endsWith(".ts")).sort();
    const sources = await Promise.all(
      productionFiles.map((file) => readFile(path.join(hostRoot, file), "utf8")),
    );
    const production = sources.join("\n");

    expect(production).not.toContain("node:http");
    expect(production).not.toContain("Bun.serve");
    expect(production).not.toContain('from "react"');
    expect(production).not.toContain("import(");
    expect(production).not.toContain("projectPlugin");
  });
});
