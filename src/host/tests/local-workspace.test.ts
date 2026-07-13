import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createApplicationSnapshotStateDecoder,
  type ApplicationOperations,
} from "../../application/index.ts";
import { GraphKernel, parseGraphGeneration, type TransactionProvider } from "../../core/index.ts";
import {
  allowsCustomLocalCoordinationRoot,
  createLocalResourceProvider,
  type LocalResourceProvider,
} from "../../persistence/index.ts";
import {
  createLocalWorkspaceCapability as createWorkspaceCapability,
  defaultWorkspaceDocument,
  type LocalWorkspaceCapabilityOptions,
  type WorkspaceAccessCapability,
  workspaceConfigurationLocator,
} from "../index.ts";
import { isHostProxy } from "../runtime-validation.ts";
import { createStandardModelCapability } from "../../standard-model/index.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function temporaryWorkspace() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "groma-host-workspace-"));
  roots.push(workspaceRoot);
  if (!allowsCustomLocalCoordinationRoot(process.platform)) return { workspaceRoot };
  const coordinationRoot = await mkdtemp(path.join(tmpdir(), "groma-host-locks-"));
  roots.push(coordinationRoot);
  return { coordinationRoot, workspaceRoot };
}

function operations(): ApplicationOperations {
  return Object.freeze({ marker: "operations" }) as unknown as ApplicationOperations;
}

function provider(
  snapshot: TransactionProvider["snapshot"],
): Pick<TransactionProvider, "snapshot"> {
  return { snapshot };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function generation(value: number) {
  const parsed = parseGraphGeneration(value);
  if (!parsed.ok) throw new Error("invalid test generation");
  return parsed.value;
}

const emptySnapshot = () => ({
  generation: 0,
  revisions: [],
  state: { components: [], relationships: [] },
});

const stateModel = createStandardModelCapability();
const stateDecoder = createApplicationSnapshotStateDecoder({
  bounds: {
    maxComponents: 100_000,
    maxDiagnosticCount: 100,
    maxEmbeddedItems: 100_000,
    maxRelationships: 100_000,
    maxSnapshotStateDepth: 30,
    maxSnapshotStateValues: 100_000,
  },
  graph: new GraphKernel({
    idSource: {
      nextEntityId: () => "ent_00000000000000000000000000000001",
      nextRelationId: () => "rel_00000000000000000000000000000001",
    },
    maxPageSize: 100,
  }),
  isProxy: isHostProxy,
  model: stateModel,
});

function createLocalWorkspaceCapability(
  options: Omit<LocalWorkspaceCapabilityOptions, "stateDecoder">,
) {
  return createWorkspaceCapability({ ...options, stateDecoder });
}

describe("local workspace capability", () => {
  test("keeps initialization available without creating workspace files on discovery", async () => {
    const roots = await temporaryWorkspace();
    const resources = await createLocalResourceProvider(roots);
    const workspace = await createLocalWorkspaceCapability({
      operations,
      transactionProvider: provider(emptySnapshot),
      resources,
    });

    expect(workspace.status()).toEqual({ state: "missing" });
    expect(workspace.requireWorkspace()).toEqual({
      diagnostics: [
        {
          code: "no-workspace",
          message: "This operation requires an initialized Groma workspace",
        },
      ],
      ok: false,
    });
    expect(await Array.fromAsync(new Bun.Glob("**/*").scan(roots.workspaceRoot))).toEqual([]);
  });

  test("exposes only frozen status, diagnostic, access, and recovery snapshots", async () => {
    const missingRoots = await temporaryWorkspace();
    const missing = await createLocalWorkspaceCapability({
      operations,
      transactionProvider: provider(emptySnapshot),
      resources: await createLocalResourceProvider(missingRoots),
    });

    const configuredRoots = await temporaryWorkspace();
    await Bun.write(
      path.join(configuredRoots.workspaceRoot, "groma", "groma.yaml"),
      defaultWorkspaceDocument,
    );
    const configured = await createLocalWorkspaceCapability({
      operations,
      transactionProvider: provider(emptySnapshot),
      resources: await createLocalResourceProvider(configuredRoots),
    });

    const conflictRoots = await temporaryWorkspace();
    await Bun.write(
      path.join(conflictRoots.workspaceRoot, "groma", "groma.yaml"),
      "schema: hostile/v9\n",
    );
    const conflict = await createLocalWorkspaceCapability({
      operations,
      transactionProvider: provider(emptySnapshot),
      resources: await createLocalResourceProvider(conflictRoots),
    });

    const providerRoots = await temporaryWorkspace();
    const providerBase = await createLocalResourceProvider(providerRoots);
    const providerConflict = await createLocalWorkspaceCapability({
      operations,
      transactionProvider: provider(emptySnapshot),
      resources: new Proxy(providerBase, {
        get(target, property) {
          if (property === "read") return async () => null as never;
          const value = target[property as keyof LocalResourceProvider];
          return typeof value === "function" ? value.bind(target) : value;
        },
      }),
    });

    for (const entry of [
      { accessCode: "no-workspace", expected: "missing", workspace: missing },
      {
        accessCode: "workspace-recovery-required",
        expected: "configured",
        workspace: configured,
      },
      {
        accessCode: "workspace-configuration-conflict",
        expected: "conflict",
        workspace: conflict,
      },
      {
        accessCode: "workspace-configuration-provider-failure",
        expected: "conflict",
        workspace: providerConflict,
      },
    ] as const) {
      const status = entry.workspace.status();
      expect(Object.isFrozen(status), entry.expected).toBeTrue();
      expect(Reflect.set(status as object, "state", "ready"), entry.expected).toBeFalse();
      expect(entry.workspace.status().state, entry.expected).toBe(entry.expected);
      expect(entry.workspace.requireWorkspace(), entry.expected).toMatchObject({
        diagnostics: [{ code: entry.accessCode }],
        ok: false,
      });
      if (status.state === "conflict") {
        expect(Object.isFrozen(status.diagnostic)).toBeTrue();
        expect(Reflect.set(status.diagnostic as object, "code", "mutated")).toBeFalse();
        expect(entry.workspace.status()).toMatchObject({
          diagnostic: { code: entry.accessCode },
          state: "conflict",
        });
      }
    }

    const conflictOutcome = await conflict.initialize();
    expect(Object.isFrozen(conflictOutcome)).toBeTrue();
    expect(
      "diagnostics" in conflictOutcome && Object.isFrozen(conflictOutcome.diagnostics),
    ).toBeTrue();
    expect(
      "diagnostics" in conflictOutcome && Object.isFrozen(conflictOutcome.diagnostics[0]),
    ).toBeTrue();

    const missingRecovery = await missing.recover();
    expect(Object.isFrozen(missingRecovery)).toBeTrue();
    expect(!missingRecovery.ok && Object.isFrozen(missingRecovery.diagnostics)).toBeTrue();
    expect(!missingRecovery.ok && Object.isFrozen(missingRecovery.diagnostics[0])).toBeTrue();

    const recovered = await configured.recover();
    expect(recovered.ok).toBeTrue();
    if (!recovered.ok) return;
    expect(Object.isFrozen(recovered)).toBeTrue();
    expect(Object.isFrozen(recovered.value)).toBeTrue();
    expect(Reflect.set(recovered.value as object, "generation", generation(99))).toBeFalse();
    expect(Number(recovered.value.generation)).toBe(0);
    const ready = configured.status();
    expect(Object.isFrozen(ready)).toBeTrue();
    expect(Reflect.set(ready as object, "state", "missing")).toBeFalse();
    expect(configured.status()).toEqual({ state: "ready" });
    expect(configured.requireWorkspace()).toMatchObject({ ok: true });

    const repeated = await configured.recover();
    expect(repeated.ok && Object.isFrozen(repeated.value)).toBeTrue();
  });

  test("atomically initializes, recovers, and promotes the same session", async () => {
    const roots = await temporaryWorkspace();
    const resources = await createLocalResourceProvider(roots);
    const calls: string[] = [];
    const api = operations();
    const workspace = await createLocalWorkspaceCapability({
      operations: () => api,
      transactionProvider: provider(async (requested) => {
        calls.push(`snapshot:${requested.length}`);
        return emptySnapshot();
      }),
      resources,
    });

    expect(await workspace.initialize()).toMatchObject({ status: "initialized" });
    expect(calls).toEqual(["snapshot:0"]);
    expect(workspace.status()).toEqual({ state: "ready" });
    expect(workspace.requireWorkspace()).toEqual({ ok: true, value: api });
    expect(
      await readFile(path.join(roots.workspaceRoot, String(workspaceConfigurationLocator))),
    ).toEqual(Buffer.from(defaultWorkspaceDocument));
    expect(await workspace.initialize()).toMatchObject({ status: "already-initialized" });
    expect(calls).toEqual(["snapshot:0"]);
  });

  test("recognizes only the exact canonical marker and preserves conflicts", async () => {
    for (const [name, contents] of [
      ["incompatible", "schema: groma/v9\n"],
      ["malformed", "schema: [\n"],
      ["noncanonical", "schema: groma/v0.1\r\n"],
      ["oversized", "x".repeat(4_097)],
    ] as const) {
      const roots = await temporaryWorkspace();
      await Bun.write(path.join(roots.workspaceRoot, "groma", "groma.yaml"), contents);
      const resources = await createLocalResourceProvider(roots);
      const workspace = await createLocalWorkspaceCapability({
        operations,
        transactionProvider: provider(emptySnapshot),
        resources,
      });

      expect(workspace.status()).toMatchObject({ state: "conflict" });
      expect(workspace.requireWorkspace()).toMatchObject({
        diagnostics: [{ code: "workspace-configuration-conflict" }],
        ok: false,
      });
      expect(await workspace.initialize()).toMatchObject({ status: "conflict" });
      expect(await readFile(path.join(roots.workspaceRoot, "groma", "groma.yaml"), "utf8")).toBe(
        contents,
      );
      expect(name.length).toBeGreaterThan(0);
    }
  });

  test("treats malformed and secret-bearing read failures as retryable provider failures", async () => {
    const secret = "/private/workspace-read-secret";
    let getterCalls = 0;
    let proxyTraps = 0;
    const accessorResult = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(accessorResult, "diagnostics", {
      enumerable: true,
      value: [{ code: "resource-missing", message: "Workspace resource does not exist" }],
    });
    Object.defineProperty(accessorResult, "ok", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return false;
      },
    });
    const sparseDiagnostics = new Array(2);
    sparseDiagnostics[0] = {
      code: "resource-missing",
      message: "Workspace resource does not exist",
    };
    const proxiedDiagnostics = new Proxy(
      [
        {
          code: "resource-missing",
          details: { operation: "resolve a resource" },
          message: "Workspace resource does not exist",
        },
      ],
      {
        get: (target, property, receiver) => {
          proxyTraps += 1;
          return Reflect.get(target, property, receiver);
        },
      },
    );
    class ProviderBytes extends Uint8Array {}
    const values: Array<{ readonly name: string; readonly value: unknown }> = [
      { name: "null", value: null },
      { name: "accessor result", value: accessorResult },
      {
        name: "secret missing lookalike",
        value: {
          diagnostics: [
            {
              code: "resource-missing",
              details: { operation: "resolve a resource" },
              message: secret,
            },
          ],
          ok: false,
        },
      },
      {
        name: "extra missing diagnostic",
        value: {
          diagnostics: [
            {
              code: "resource-missing",
              details: { operation: "resolve a resource" },
              message: "Workspace resource does not exist",
            },
            { code: "private-provider-secret", message: secret },
          ],
          ok: false,
        },
      },
      {
        name: "secret too-large lookalike",
        value: {
          diagnostics: [
            {
              code: "resource-too-large",
              details: { maximum: 4_096 },
              message: secret,
            },
          ],
          ok: false,
        },
      },
      { name: "sparse diagnostics", value: { diagnostics: sparseDiagnostics, ok: false } },
      { name: "proxied diagnostics", value: { diagnostics: proxiedDiagnostics, ok: false } },
      {
        name: "extra success field",
        value: {
          ok: true,
          value: { bytes: new TextEncoder().encode(defaultWorkspaceDocument), extra: true },
        },
      },
      {
        name: "subclass bytes",
        value: {
          ok: true,
          value: { bytes: new ProviderBytes(new TextEncoder().encode(defaultWorkspaceDocument)) },
        },
      },
    ];

    for (const entry of values) {
      const roots = await temporaryWorkspace();
      const base = await createLocalResourceProvider(roots);
      const resources = new Proxy(base, {
        get(target, property) {
          if (property === "read") return async () => entry.value as never;
          const value = target[property as keyof LocalResourceProvider];
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      const workspace = await createLocalWorkspaceCapability({
        operations,
        resources,
        transactionProvider: provider(emptySnapshot),
      });

      expect(workspace.status(), entry.name).toMatchObject({
        diagnostic: { code: "workspace-configuration-provider-failure" },
        state: "conflict",
      });
      expect(workspace.requireWorkspace(), entry.name).toMatchObject({
        diagnostics: [{ code: "workspace-configuration-provider-failure" }],
        ok: false,
      });
      expect(JSON.stringify(workspace.status()), entry.name).not.toContain(secret);
    }
    expect(getterCalls).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  test("rejects proxy marker bytes without traps and applies the decoder proxy policy", async () => {
    const canonical = new TextEncoder().encode(defaultWorkspaceDocument);
    let proxyTraps = 0;
    const proxiedBytes = new Proxy(canonical, {
      get: (target, property, receiver) => {
        proxyTraps += 1;
        return Reflect.get(target, property, receiver);
      },
      getPrototypeOf: (target) => {
        proxyTraps += 1;
        return Reflect.getPrototypeOf(target);
      },
    });
    const roots = await temporaryWorkspace();
    const base = await createLocalResourceProvider(roots);
    const workspace = await createLocalWorkspaceCapability({
      operations,
      resources: new Proxy(base, {
        get(target, property) {
          if (property === "read")
            return async () => ({ ok: true, value: { bytes: proxiedBytes } });
          const value = target[property as keyof LocalResourceProvider];
          return typeof value === "function" ? value.bind(target) : value;
        },
      }),
      transactionProvider: provider(emptySnapshot),
    });
    expect(workspace.status()).toMatchObject({
      diagnostic: { code: "workspace-configuration-provider-failure" },
      state: "conflict",
    });
    expect(proxyTraps).toBe(0);

    const policyBytes = new TextEncoder().encode(defaultWorkspaceDocument);
    let policyCalls = 0;
    const policyDecoder = createApplicationSnapshotStateDecoder({
      bounds: {
        maxComponents: 100_000,
        maxDiagnosticCount: 100,
        maxEmbeddedItems: 100_000,
        maxRelationships: 100_000,
        maxSnapshotStateDepth: 30,
        maxSnapshotStateValues: 100_000,
      },
      graph: new GraphKernel({
        idSource: {
          nextEntityId: () => "ent_00000000000000000000000000000001",
          nextRelationId: () => "rel_00000000000000000000000000000001",
        },
        maxPageSize: 100,
      }),
      isProxy: (value) => {
        policyCalls += 1;
        return value === policyBytes;
      },
      model: stateModel,
    });
    const policyRoots = await temporaryWorkspace();
    const policyBase = await createLocalResourceProvider(policyRoots);
    const policyWorkspace = await createWorkspaceCapability({
      operations,
      resources: new Proxy(policyBase, {
        get(target, property) {
          if (property === "read") return async () => ({ ok: true, value: { bytes: policyBytes } });
          const value = target[property as keyof LocalResourceProvider];
          return typeof value === "function" ? value.bind(target) : value;
        },
      }),
      stateDecoder: policyDecoder,
      transactionProvider: provider(emptySnapshot),
    });
    expect(policyWorkspace.status()).toMatchObject({
      diagnostic: { code: "workspace-configuration-provider-failure" },
      state: "conflict",
    });
    expect(policyCalls).toBeGreaterThan(0);
  });

  test("retries transient provider inspection while preserving proven conflicts", async () => {
    for (const transition of ["initialize", "recover"] as const) {
      const roots = await temporaryWorkspace();
      if (transition === "recover") {
        await Bun.write(
          path.join(roots.workspaceRoot, "groma", "groma.yaml"),
          defaultWorkspaceDocument,
        );
      }
      const base = await createLocalResourceProvider(roots);
      let reads = 0;
      const resources = new Proxy(base, {
        get(target, property) {
          if (property === "read") {
            return async (...args: Parameters<LocalResourceProvider["read"]>) => {
              reads += 1;
              if (reads === 1) {
                return {
                  diagnostics: [{ code: "private-provider-failure", message: roots.workspaceRoot }],
                  ok: false,
                };
              }
              return target.read(...args);
            };
          }
          const value = target[property as keyof LocalResourceProvider];
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      const workspace = await createLocalWorkspaceCapability({
        operations,
        resources,
        transactionProvider: provider(emptySnapshot),
      });
      expect(workspace.status(), transition).toMatchObject({
        diagnostic: { code: "workspace-configuration-provider-failure" },
        state: "conflict",
      });
      const outcome = await workspace[transition]();
      expect(outcome, transition).toMatchObject(
        transition === "initialize" ? { status: "initialized" } : { ok: true },
      );
      expect(workspace.status(), transition).toEqual({ state: "ready" });
      expect(reads, transition).toBeGreaterThan(1);
    }

    const roots = await temporaryWorkspace();
    await Bun.write(
      path.join(roots.workspaceRoot, "groma", "groma.yaml"),
      "schema: incompatible/v9\n",
    );
    const base = await createLocalResourceProvider(roots);
    let conflictReads = 0;
    const resources = new Proxy(base, {
      get(target, property) {
        if (property === "read") {
          return async (...args: Parameters<LocalResourceProvider["read"]>) => {
            conflictReads += 1;
            if (conflictReads > 1) throw new Error("proven conflicts must not be reinspected");
            return target.read(...args);
          };
        }
        const value = target[property as keyof LocalResourceProvider];
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const conflict = await createLocalWorkspaceCapability({
      operations,
      resources,
      transactionProvider: provider(emptySnapshot),
    });
    expect(await conflict.initialize()).toMatchObject({ status: "conflict" });
    expect(await conflict.recover()).toMatchObject({
      diagnostics: [{ code: "workspace-configuration-conflict" }],
      ok: false,
    });
    expect(conflictReads).toBe(1);
  });

  test("proves decoder recovery bounds before provider inspection", async () => {
    for (const bounds of [
      { maxSnapshotStateDepth: 10 },
      { maxSnapshotStateValues: 100 },
    ] as const) {
      const roots = await temporaryWorkspace();
      const base = await createLocalResourceProvider(roots);
      let reads = 0;
      const resources = new Proxy(base, {
        get(target, property) {
          if (property === "read") {
            return async (...args: Parameters<LocalResourceProvider["read"]>) => {
              reads += 1;
              return target.read(...args);
            };
          }
          const value = target[property as keyof LocalResourceProvider];
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      await expect(
        createWorkspaceCapability({
          bounds,
          operations,
          resources,
          stateDecoder,
          transactionProvider: provider(emptySnapshot),
        }),
      ).rejects.toThrow("must not exceed the local workspace bound");
      expect(reads).toBe(0);
    }

    const forgedRoots = await temporaryWorkspace();
    const forgedBase = await createLocalResourceProvider(forgedRoots);
    let forgedReads = 0;
    const forgedResources = new Proxy(forgedBase, {
      get(target, property) {
        if (property === "read") {
          return async (...args: Parameters<LocalResourceProvider["read"]>) => {
            forgedReads += 1;
            return target.read(...args);
          };
        }
        const value = target[property as keyof LocalResourceProvider];
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await expect(
      createWorkspaceCapability({
        operations,
        resources: forgedResources,
        stateDecoder: Object.freeze({}) as never,
        transactionProvider: provider(emptySnapshot),
      }),
    ).rejects.toThrow("must be created by createApplicationSnapshotStateDecoder");
    expect(forgedReads).toBe(0);

    const tighterDecoder = createApplicationSnapshotStateDecoder({
      bounds: {
        maxComponents: 10,
        maxDiagnosticCount: 10,
        maxEmbeddedItems: 10,
        maxRelationships: 10,
        maxSnapshotStateDepth: 10,
        maxSnapshotStateValues: 50,
      },
      graph: new GraphKernel({
        idSource: {
          nextEntityId: () => "ent_00000000000000000000000000000001",
          nextRelationId: () => "rel_00000000000000000000000000000001",
        },
        maxPageSize: 10,
      }),
      isProxy: isHostProxy,
      model: stateModel,
    });
    const compatibleRoots = await temporaryWorkspace();
    const compatible = await createWorkspaceCapability({
      bounds: { maxSnapshotStateDepth: 20, maxSnapshotStateValues: 100 },
      operations,
      resources: await createLocalResourceProvider(compatibleRoots),
      stateDecoder: tighterDecoder,
      transactionProvider: provider(emptySnapshot),
    });
    expect(compatible.status()).toEqual({ state: "missing" });
  });

  test("rejects malformed coordination leases before publication without invoking traps", async () => {
    let getterCalls = 0;
    let proxyTraps = 0;
    const mutableNullPrototype = Object.create(null);
    const accessorLease = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(accessorLease, "secret", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return "private";
      },
    });
    Object.freeze(accessorLease);
    const ownFieldLease = Object.create(null) as Record<string, unknown>;
    ownFieldLease.extra = true;
    Object.freeze(ownFieldLease);
    const proxyLease = new Proxy(Object.freeze(Object.create(null)), {
      getPrototypeOf: (target) => {
        proxyTraps += 1;
        return Reflect.getPrototypeOf(target);
      },
      ownKeys: (target) => {
        proxyTraps += 1;
        return Reflect.ownKeys(target);
      },
    });
    const proxyFailureDiagnostics = new Proxy(
      [{ code: "private-coordination-failure", message: "/private/coordination-secret" }],
      {
        get: (target, property, receiver) => {
          proxyTraps += 1;
          return Reflect.get(target, property, receiver);
        },
      },
    );
    const variants: Array<{ readonly name: string; readonly result: unknown }> = [
      {
        name: "proxied failure diagnostics",
        result: { diagnostics: proxyFailureDiagnostics, ok: false },
      },
      { name: "missing value", result: { ok: true } },
      { name: "undefined value", result: { ok: true, value: undefined } },
      { name: "mutable null prototype", result: { ok: true, value: mutableNullPrototype } },
      { name: "ordinary prototype", result: { ok: true, value: Object.freeze({}) } },
      { name: "own field", result: { ok: true, value: ownFieldLease } },
      { name: "accessor", result: { ok: true, value: accessorLease } },
      { name: "proxy", result: { ok: true, value: proxyLease } },
    ];

    for (const variant of variants) {
      const roots = await temporaryWorkspace();
      const base = await createLocalResourceProvider(roots);
      let releases = 0;
      let stages = 0;
      const resources = new Proxy(base, {
        get(target, property) {
          if (property === "acquireCoordination") return async () => variant.result as never;
          if (property === "releaseCoordination") {
            return async (...args: Parameters<LocalResourceProvider["releaseCoordination"]>) => {
              releases += 1;
              return target.releaseCoordination(...args);
            };
          }
          if (property === "stageReplacement") {
            return async (...args: Parameters<LocalResourceProvider["stageReplacement"]>) => {
              stages += 1;
              return target.stageReplacement(...args);
            };
          }
          const value = target[property as keyof LocalResourceProvider];
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      const workspace = await createLocalWorkspaceCapability({
        operations,
        resources,
        transactionProvider: provider(emptySnapshot),
      });
      expect(await workspace.initialize(), variant.name).toMatchObject({
        status: "provider-failure",
      });
      expect({ releases, stages }, variant.name).toEqual({ releases: 0, stages: 0 });
    }
    expect(getterCalls).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  test("retains and releases one structurally valid provider lease", async () => {
    const roots = await temporaryWorkspace();
    const base = await createLocalResourceProvider(roots);
    let releases = 0;
    let stages = 0;
    const resources = new Proxy(base, {
      get(target, property) {
        if (property === "releaseCoordination") {
          return async (...args: Parameters<LocalResourceProvider["releaseCoordination"]>) => {
            releases += 1;
            return target.releaseCoordination(...args);
          };
        }
        if (property === "stageReplacement") {
          return async (...args: Parameters<LocalResourceProvider["stageReplacement"]>) => {
            stages += 1;
            return target.stageReplacement(...args);
          };
        }
        const value = target[property as keyof LocalResourceProvider];
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const workspace = await createLocalWorkspaceCapability({
      operations,
      resources,
      transactionProvider: provider(emptySnapshot),
    });
    expect(await workspace.initialize()).toMatchObject({ status: "initialized" });
    expect({ releases, stages }).toEqual({ releases: 1, stages: 1 });
  });

  test("reports recovery failure and can retry without rewriting compatible configuration", async () => {
    const roots = await temporaryWorkspace();
    await Bun.write(
      path.join(roots.workspaceRoot, "groma", "groma.yaml"),
      defaultWorkspaceDocument,
    );
    const resources = await createLocalResourceProvider(roots);
    let attempts = 0;
    const workspace = await createLocalWorkspaceCapability({
      operations,
      transactionProvider: provider(() => {
        attempts += 1;
        if (attempts === 1) throw new Error(roots.workspaceRoot);
        return emptySnapshot();
      }),
      resources,
    });

    expect(await workspace.recover()).toEqual({
      diagnostics: [
        {
          code: "workspace-recovery-failed",
          message: "Workspace transaction recovery failed",
        },
      ],
      ok: false,
    });
    expect(workspace.requireWorkspace()).toMatchObject({
      diagnostics: [{ code: "workspace-recovery-required" }],
      ok: false,
    });
    expect(await workspace.initialize()).toMatchObject({ status: "already-initialized" });
    expect(workspace.status()).toEqual({ state: "ready" });
  });

  test("rejects malformed recovery outcomes within explicit bounds", async () => {
    const roots = await temporaryWorkspace();
    await Bun.write(
      path.join(roots.workspaceRoot, "groma", "groma.yaml"),
      defaultWorkspaceDocument,
    );
    const resources = await createLocalResourceProvider(roots);
    const workspace = await createLocalWorkspaceCapability({
      bounds: { maxSnapshotResources: 1 },
      operations,
      transactionProvider: provider(() => ({
        generation: Number(parseGraphGeneration(0).ok),
        revisions: [
          { resource: "a", revision: null },
          { resource: "b", revision: null },
        ],
        state: { components: [], relationships: [] },
      })),
      resources,
    });

    expect(await workspace.recover()).toMatchObject({
      diagnostics: [{ code: "invalid-workspace-recovery" }],
      ok: false,
    });
  });

  test("rejects hostile recovery state and validates configured bounds", async () => {
    const roots = await temporaryWorkspace();
    await Bun.write(
      path.join(roots.workspaceRoot, "groma", "groma.yaml"),
      defaultWorkspaceDocument,
    );
    const resources = await createLocalResourceProvider(roots);
    let generationGetterCalls = 0;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, "generation", {
      enumerable: true,
      get: () => {
        generationGetterCalls += 1;
        return generationGetterCalls;
      },
    });
    Object.defineProperty(hostile, "revisions", { enumerable: true, value: [] });
    Object.defineProperty(hostile, "state", {
      enumerable: true,
      value: { components: [], relationships: [] },
    });
    const outcomes: unknown[] = [
      null,
      { generation: 0, revisions: [], state: {} },
      hostile,
      new Proxy(emptySnapshot(), {}),
      {
        extra: true,
        generation: 0,
        revisions: [],
        state: { components: [], relationships: [] },
      },
      {
        generation: 0,
        revisions: [],
        state: new Proxy({ components: [], relationships: [] }, {}),
      },
      {
        generation: 0,
        revisions: [],
        state: { components: new Proxy([], {}), relationships: [] },
      },
      {
        generation: 0,
        revisions: [],
        state: {
          components: [
            new Proxy(
              {
                id: "ent_00000000000000000000000000000001",
                kind: "component",
                payload: {},
              },
              {},
            ),
          ],
          relationships: [],
        },
      },
      {
        generation: 0,
        revisions: [],
        state: {
          components: [
            {
              id: "ent_00000000000000000000000000000001",
              kind: "component",
              payload: new Proxy({}, {}),
            },
          ],
          relationships: [],
        },
      },
      {
        generation: 0,
        revisions: [],
        state: {
          components: [],
          relationships: [
            {
              id: "rel_00000000000000000000000000000001",
              payload: new Proxy({}, {}),
              source: "ent_00000000000000000000000000000001",
              target: "ent_00000000000000000000000000000002",
              type: "depends-on",
            },
          ],
        },
      },
      emptySnapshot(),
    ];
    const workspace = await createLocalWorkspaceCapability({
      operations,
      transactionProvider: provider(() => outcomes.shift() as never),
      resources,
    });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(await workspace.recover()).toMatchObject({
        diagnostics: [{ code: "invalid-workspace-recovery" }],
        ok: false,
      });
    }
    const recovered = await workspace.recover();
    expect(recovered).toEqual({
      ok: true,
      value: { generation: generation(0), status: "completed" },
    });
    expect(recovered.ok && Object.isFrozen(recovered.value)).toBeTrue();
    expect(generationGetterCalls).toBe(0);
    await expect(
      createLocalWorkspaceCapability({
        bounds: { maxSnapshotStateValues: 1_000_001 },
        operations,
        transactionProvider: provider(emptySnapshot),
        resources,
      }),
    ).rejects.toThrow("maxSnapshotStateValues");
  });

  test("uses shared application semantics before accepting recovered state", async () => {
    const first = "ent_00000000000000000000000000000001";
    const second = "ent_00000000000000000000000000000002";
    const component = (id: string, payload: Record<string, unknown> = {}) => ({
      id,
      kind: "component",
      payload,
    });
    const invalidStates: ReadonlyArray<{ name: string; state: unknown }> = [
      {
        name: "dangling relationship",
        state: {
          components: [component(first)],
          relationships: [
            {
              id: "rel_00000000000000000000000000000001",
              payload: {},
              source: first,
              target: second,
              type: "depends-on",
            },
          ],
        },
      },
      {
        name: "duplicate component",
        state: { components: [component(first), component(first)], relationships: [] },
      },
      {
        name: "invalid relationship token",
        state: {
          components: [component(first), component(second)],
          relationships: [
            {
              id: "rel_00000000000000000000000000000001",
              payload: {},
              source: first,
              target: second,
              type: "Invalid Token",
            },
          ],
        },
      },
      {
        name: "malformed component",
        state: { components: [component(first, { name: 42 })], relationships: [] },
      },
      {
        name: "unknown parent",
        state: { components: [component(first, { parent: second })], relationships: [] },
      },
      {
        name: "containment cycle",
        state: {
          components: [component(first, { parent: second }), component(second, { parent: first })],
          relationships: [],
        },
      },
    ];

    for (const entry of invalidStates) {
      const roots = await temporaryWorkspace();
      await Bun.write(
        path.join(roots.workspaceRoot, "groma", "groma.yaml"),
        defaultWorkspaceDocument,
      );
      const resources = await createLocalResourceProvider(roots);
      const workspace = await createLocalWorkspaceCapability({
        operations,
        transactionProvider: provider(() => ({
          generation: 0,
          revisions: [],
          state: entry.state,
        })),
        resources,
      });

      expect(await workspace.recover(), entry.name).toMatchObject({
        diagnostics: [{ code: "invalid-workspace-recovery" }],
        ok: false,
      });
      expect(workspace.status(), entry.name).toEqual({ state: "configured" });
      expect(workspace.requireWorkspace(), entry.name).toMatchObject({
        diagnostics: [{ code: "workspace-recovery-required" }],
        ok: false,
      });
    }

    const roots = await temporaryWorkspace();
    await Bun.write(
      path.join(roots.workspaceRoot, "groma", "groma.yaml"),
      defaultWorkspaceDocument,
    );
    const resources = await createLocalResourceProvider(roots);
    const boundedDecoder = createApplicationSnapshotStateDecoder({
      bounds: {
        maxComponents: 1,
        maxDiagnosticCount: 1,
        maxEmbeddedItems: 1,
        maxRelationships: 1,
        maxSnapshotStateDepth: 30,
        maxSnapshotStateValues: 100,
      },
      graph: new GraphKernel({
        idSource: {
          nextEntityId: () => first,
          nextRelationId: () => "rel_00000000000000000000000000000001",
        },
        maxPageSize: 10,
      }),
      isProxy: isHostProxy,
      model: stateModel,
    });
    const bounded = await createWorkspaceCapability({
      operations,
      transactionProvider: provider(() => ({
        generation: 0,
        revisions: [],
        state: {
          components: [component(first), component(second)],
          relationships: [],
        },
      })),
      resources,
      stateDecoder: boundedDecoder,
    });
    expect(await bounded.recover()).toMatchObject({
      diagnostics: [{ code: "invalid-workspace-recovery" }],
      ok: false,
    });
    expect(bounded.status()).toEqual({ state: "configured" });
  });

  test("retries the same committed handle after an interrupted commit report", async () => {
    const roots = await temporaryWorkspace();
    const base = await createLocalResourceProvider(roots);
    let releases = 0;
    let commits = 0;
    let stages = 0;
    const handles: unknown[] = [];
    const resources = new Proxy(base, {
      get(target, property) {
        if (property === "commitReplacement") {
          return async (...args: Parameters<LocalResourceProvider["commitReplacement"]>) => {
            commits += 1;
            handles.push(args[0]);
            if (commits === 1) {
              await target.commitReplacement(...args);
              throw new Error(roots.workspaceRoot);
            }
            return target.commitReplacement(...args);
          };
        }
        if (property === "stageReplacement") {
          return async (...args: Parameters<LocalResourceProvider["stageReplacement"]>) => {
            stages += 1;
            return target.stageReplacement(...args);
          };
        }
        if (property === "releaseCoordination") {
          return async (...args: Parameters<LocalResourceProvider["releaseCoordination"]>) => {
            releases += 1;
            return target.releaseCoordination(...args);
          };
        }
        const value = target[property as keyof LocalResourceProvider];
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const workspace = await createLocalWorkspaceCapability({
      operations,
      transactionProvider: provider(emptySnapshot),
      resources,
    });

    expect(await workspace.initialize()).toMatchObject({ status: "provider-failure" });
    expect(workspace.status()).not.toEqual({ state: "ready" });
    expect(await workspace.initialize()).toMatchObject({ status: "initialized" });
    expect(releases).toBe(1);
    expect(commits).toBe(2);
    expect(stages).toBe(1);
    expect(handles[0]).toBe(handles[1]);
    expect(await readFile(path.join(roots.workspaceRoot, "groma", "groma.yaml"), "utf8")).toBe(
      defaultWorkspaceDocument,
    );
  });

  test("retains a committed handle until exact marker readback is confirmed", async () => {
    const roots = await temporaryWorkspace();
    const base = await createLocalResourceProvider(roots);
    let commits = 0;
    let reads = 0;
    let stages = 0;
    const handles: unknown[] = [];
    const resources = new Proxy(base, {
      get(target, property) {
        if (property === "read") {
          return async (...args: Parameters<LocalResourceProvider["read"]>) => {
            reads += 1;
            if (reads === 3) {
              return {
                diagnostics: [{ code: "private-readback-failure", message: roots.workspaceRoot }],
                ok: false,
              };
            }
            return target.read(...args);
          };
        }
        if (property === "stageReplacement") {
          return async (...args: Parameters<LocalResourceProvider["stageReplacement"]>) => {
            stages += 1;
            return target.stageReplacement(...args);
          };
        }
        if (property === "commitReplacement") {
          return async (...args: Parameters<LocalResourceProvider["commitReplacement"]>) => {
            commits += 1;
            handles.push(args[0]);
            return target.commitReplacement(...args);
          };
        }
        const value = target[property as keyof LocalResourceProvider];
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const workspace = await createLocalWorkspaceCapability({
      operations,
      transactionProvider: provider(emptySnapshot),
      resources,
    });

    expect(await workspace.initialize()).toMatchObject({ status: "provider-failure" });
    expect(workspace.status()).not.toEqual({ state: "ready" });
    expect(await workspace.initialize()).toMatchObject({ status: "initialized" });
    expect(stages).toBe(1);
    expect(commits).toBe(2);
    expect(handles[0]).toBe(handles[1]);
  });

  test("retries one staged handle across thrown, malformed, and indeterminate publication", async () => {
    const roots = await temporaryWorkspace();
    const base = await createLocalResourceProvider(roots);
    let commits = 0;
    let getterCalls = 0;
    let snapshots = 0;
    let stages = 0;
    const handles: unknown[] = [];
    const accessorOutcome = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(accessorOutcome, "state", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return "committed";
      },
    });
    const resources = new Proxy(base, {
      get(target, property) {
        if (property === "stageReplacement") {
          return async (...args: Parameters<LocalResourceProvider["stageReplacement"]>) => {
            stages += 1;
            return target.stageReplacement(...args);
          };
        }
        if (property === "commitReplacement") {
          return async (...args: Parameters<LocalResourceProvider["commitReplacement"]>) => {
            commits += 1;
            handles.push(args[0]);
            if (commits === 1) throw new Error(roots.workspaceRoot);
            if (commits === 2) return null;
            if (commits === 3) return accessorOutcome;
            if (commits === 4) return new Proxy({ state: "committed" }, {});
            if (commits === 5) {
              return {
                diagnostics: [
                  {
                    code: "private-indeterminate",
                    details: { commitState: "committed-indeterminate" },
                    message: roots.workspaceRoot,
                  },
                ],
                state: "committed-indeterminate",
              };
            }
            if (commits === 6) {
              return { diagnostics: [{ code: "bad" }], state: "committed" };
            }
            return target.commitReplacement(...args);
          };
        }
        const value = target[property as keyof LocalResourceProvider];
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const workspace = await createLocalWorkspaceCapability({
      operations,
      transactionProvider: provider(() => {
        snapshots += 1;
        return emptySnapshot();
      }),
      resources,
    });

    for (let attempt = 0; attempt < 6; attempt += 1) {
      expect(await workspace.initialize()).toMatchObject({ status: "provider-failure" });
      expect(workspace.status()).not.toEqual({ state: "ready" });
      expect(snapshots).toBe(0);
    }
    expect(await workspace.initialize()).toMatchObject({ status: "initialized" });
    expect(stages).toBe(1);
    expect(commits).toBe(7);
    expect(getterCalls).toBe(0);
    expect(handles.every((handle) => handle === handles[0])).toBeTrue();
    expect(snapshots).toBe(1);
  });

  test("confirms discard before clearing a rejected publication", async () => {
    const roots = await temporaryWorkspace();
    const base = await createLocalResourceProvider(roots);
    let commits = 0;
    let discards = 0;
    let stages = 0;
    const resources = new Proxy(base, {
      get(target, property) {
        if (property === "stageReplacement") {
          return async (...args: Parameters<LocalResourceProvider["stageReplacement"]>) => {
            stages += 1;
            return target.stageReplacement(...args);
          };
        }
        if (property === "commitReplacement") {
          return async (...args: Parameters<LocalResourceProvider["commitReplacement"]>) => {
            commits += 1;
            if (commits === 1) {
              return {
                diagnostics: [{ code: "rejected", message: "not committed" }],
                state: "not-committed",
              };
            }
            return target.commitReplacement(...args);
          };
        }
        if (property === "discardReplacement") {
          return async (...args: Parameters<LocalResourceProvider["discardReplacement"]>) => {
            discards += 1;
            if (discards === 1) {
              return {
                diagnostics: [{ code: "private-cleanup-failure", message: roots.workspaceRoot }],
                ok: false,
              };
            }
            return target.discardReplacement(...args);
          };
        }
        const value = target[property as keyof LocalResourceProvider];
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const workspace = await createLocalWorkspaceCapability({
      operations,
      transactionProvider: provider(emptySnapshot),
      resources,
    });

    expect(await workspace.initialize()).toMatchObject({ status: "provider-failure" });
    expect(await workspace.initialize()).toMatchObject({ status: "provider-failure" });
    expect(stages).toBe(1);
    expect(commits).toBe(1);
    expect(discards).toBe(2);
    expect(await workspace.initialize()).toMatchObject({ status: "initialized" });
    expect(stages).toBe(2);
    expect(commits).toBe(2);
  });

  test("recognizes a compatible marker published by a peer after confirmed discard", async () => {
    const roots = await temporaryWorkspace();
    const base = await createLocalResourceProvider(roots);
    let commits = 0;
    let discards = 0;
    let releases = 0;
    let releaseResult: unknown;
    let snapshots = 0;
    let stages = 0;
    const resources = new Proxy(base, {
      get(target, property) {
        if (property === "stageReplacement") {
          return async (...args: Parameters<LocalResourceProvider["stageReplacement"]>) => {
            stages += 1;
            return target.stageReplacement(...args);
          };
        }
        if (property === "commitReplacement") {
          return async () => {
            commits += 1;
            return {
              diagnostics: [{ code: "peer-won", message: "A compatible peer published first" }],
              state: "not-committed" as const,
            };
          };
        }
        if (property === "discardReplacement") {
          return async (...args: Parameters<LocalResourceProvider["discardReplacement"]>) => {
            discards += 1;
            const discarded = await target.discardReplacement(...args);
            await Bun.write(
              path.join(roots.workspaceRoot, "groma", "groma.yaml"),
              defaultWorkspaceDocument,
            );
            return discarded;
          };
        }
        if (property === "releaseCoordination") {
          return async (...args: Parameters<LocalResourceProvider["releaseCoordination"]>) => {
            releases += 1;
            releaseResult = await target.releaseCoordination(...args);
            return releaseResult;
          };
        }
        const value = target[property as keyof LocalResourceProvider];
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const workspace = await createLocalWorkspaceCapability({
      operations,
      transactionProvider: provider(() => {
        snapshots += 1;
        return emptySnapshot();
      }),
      resources,
    });

    const outcome = await workspace.initialize();
    expect(await readFile(path.join(roots.workspaceRoot, "groma", "groma.yaml"), "utf8")).toBe(
      defaultWorkspaceDocument,
    );
    expect({ commits, discards, releaseResult, releases, snapshots, stages }).toEqual({
      commits: 1,
      discards: 1,
      releaseResult: { ok: true, value: undefined },
      releases: 1,
      snapshots: 1,
      stages: 1,
    });
    expect({ outcome, status: workspace.status() }).toEqual({
      outcome: { generation: generation(0), status: "already-initialized" },
      status: { state: "ready" },
    });
    expect(workspace.requireWorkspace()).toMatchObject({ ok: true });
  });

  test("confirms real directory durability by retrying the same local-provider handle", async () => {
    if (process.platform === "win32") return;
    const roots = await temporaryWorkspace();
    let injected = false;
    const base = await createLocalResourceProvider({
      ...roots,
      faultInjector: (phase) => {
        if (phase === "replacement-parent-directory-sync" && !injected) {
          injected = true;
          throw new Error("injected directory sync failure");
        }
      },
    });
    let commits = 0;
    let snapshots = 0;
    let stages = 0;
    const handles: unknown[] = [];
    const resources = new Proxy(base, {
      get(target, property) {
        if (property === "stageReplacement") {
          return async (...args: Parameters<LocalResourceProvider["stageReplacement"]>) => {
            stages += 1;
            return target.stageReplacement(...args);
          };
        }
        if (property === "commitReplacement") {
          return async (...args: Parameters<LocalResourceProvider["commitReplacement"]>) => {
            commits += 1;
            handles.push(args[0]);
            return target.commitReplacement(...args);
          };
        }
        const value = target[property as keyof LocalResourceProvider];
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const workspace = await createLocalWorkspaceCapability({
      operations,
      transactionProvider: provider(() => {
        snapshots += 1;
        return emptySnapshot();
      }),
      resources,
    });

    expect(await workspace.initialize()).toMatchObject({ status: "provider-failure" });
    expect(workspace.status()).not.toEqual({ state: "ready" });
    expect(stages).toBe(1);
    expect(commits).toBe(1);
    expect(snapshots).toBe(0);
    expect(await workspace.recover()).toMatchObject({ ok: true });
    expect(stages).toBe(1);
    expect(commits).toBe(2);
    expect(handles[0]).toBe(handles[1]);
    expect(snapshots).toBe(1);
    expect(workspace.status()).toEqual({ state: "ready" });
    expect(await workspace.initialize()).toMatchObject({ status: "already-initialized" });
  });

  test("releases initialization coordination when staging fails", async () => {
    const roots = await temporaryWorkspace();
    const base = await createLocalResourceProvider(roots);
    let releases = 0;
    const resources = new Proxy(base, {
      get(target, property) {
        if (property === "releaseCoordination") {
          return async (lease: Parameters<LocalResourceProvider["releaseCoordination"]>[0]) => {
            releases += 1;
            return target.releaseCoordination(lease);
          };
        }
        if (property === "stageReplacement") {
          return async () => ({
            diagnostics: [{ code: "hostile-provider", message: roots.workspaceRoot }],
            ok: false,
          });
        }
        const value = target[property as keyof LocalResourceProvider];
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const workspace = await createLocalWorkspaceCapability({
      operations,
      transactionProvider: provider(emptySnapshot),
      resources,
    });

    expect(await workspace.initialize()).toMatchObject({ status: "provider-failure" });
    expect(releases).toBe(1);
    expect(
      await base.read({ locator: workspaceConfigurationLocator, maxBytes: 4_096 }),
    ).toMatchObject({
      diagnostics: [{ code: "resource-missing" }],
      ok: false,
    });
  });

  test("retains and retries an initialization lease after release failure", async () => {
    const roots = await temporaryWorkspace();
    const base = await createLocalResourceProvider(roots);
    let releases = 0;
    const resources = new Proxy(base, {
      get(target, property) {
        if (property === "releaseCoordination") {
          return async (...args: Parameters<LocalResourceProvider["releaseCoordination"]>) => {
            releases += 1;
            if (releases === 1) {
              return {
                diagnostics: [{ code: "private-release-failure", message: roots.workspaceRoot }],
                ok: false,
              };
            }
            return target.releaseCoordination(...args);
          };
        }
        const value = target[property as keyof LocalResourceProvider];
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const workspace = await createLocalWorkspaceCapability({
      operations,
      transactionProvider: provider(emptySnapshot),
      resources,
    });

    expect(await workspace.initialize()).toEqual({
      diagnostics: [
        {
          code: "workspace-configuration-provider-failure",
          message: "Workspace configuration access failed",
        },
      ],
      status: "provider-failure",
    });
    expect(workspace.status()).toEqual({ state: "configured" });
    expect(await workspace.initialize()).toMatchObject({ status: "initialized" });
    expect(workspace.status()).toEqual({ state: "ready" });
    expect(releases).toBe(2);
  });

  test("fails reentrant commit-provider transitions without poisoning the FIFO tail", async () => {
    const roots = await temporaryWorkspace();
    const base = await createLocalResourceProvider(roots);
    let commits = 0;
    let nestedInitialize: unknown;
    let nestedRecover: unknown;
    let workspace!: WorkspaceAccessCapability;
    const resources = new Proxy(base, {
      get(target, property) {
        if (property === "commitReplacement") {
          return async (...args: Parameters<LocalResourceProvider["commitReplacement"]>) => {
            commits += 1;
            await new Promise<void>((resolve) => setImmediate(resolve));
            nestedRecover = await workspace.recover();
            nestedInitialize = await workspace.initialize();
            return target.commitReplacement(...args);
          };
        }
        const value = target[property as keyof LocalResourceProvider];
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    workspace = await createLocalWorkspaceCapability({
      operations,
      transactionProvider: provider(emptySnapshot),
      resources,
    });

    expect(await workspace.initialize()).toMatchObject({ status: "initialized" });
    expect(nestedRecover).toEqual({
      diagnostics: [
        {
          code: "workspace-transition-reentrant",
          message: "Workspace transition reentrancy is not supported",
        },
      ],
      ok: false,
    });
    expect(nestedInitialize).toEqual({
      diagnostics: [
        {
          code: "workspace-transition-reentrant",
          message: "Workspace transition reentrancy is not supported",
        },
      ],
      status: "provider-failure",
    });
    expect(commits).toBe(1);
    expect(await workspace.recover()).toMatchObject({ ok: true });
    expect(await workspace.initialize()).toMatchObject({ status: "already-initialized" });
  });

  test("fails reentrant snapshot-provider transitions across awaits without poisoning the tail", async () => {
    const roots = await temporaryWorkspace();
    await Bun.write(
      path.join(roots.workspaceRoot, "groma", "groma.yaml"),
      defaultWorkspaceDocument,
    );
    const resources = await createLocalResourceProvider(roots);
    let nestedInitialize: unknown;
    let nestedRecover: unknown;
    let snapshots = 0;
    let workspace!: WorkspaceAccessCapability;
    workspace = await createLocalWorkspaceCapability({
      operations,
      transactionProvider: provider(async () => {
        snapshots += 1;
        await Promise.resolve();
        nestedRecover = await workspace.recover();
        nestedInitialize = await workspace.initialize();
        return emptySnapshot();
      }),
      resources,
    });

    expect(await workspace.recover()).toMatchObject({ ok: true });
    expect(nestedRecover).toEqual({
      diagnostics: [
        {
          code: "workspace-transition-reentrant",
          message: "Workspace transition reentrancy is not supported",
        },
      ],
      ok: false,
    });
    expect(nestedInitialize).toEqual({
      diagnostics: [
        {
          code: "workspace-transition-reentrant",
          message: "Workspace transition reentrancy is not supported",
        },
      ],
      status: "provider-failure",
    });
    expect(snapshots).toBe(1);
    expect(await workspace.initialize()).toMatchObject({ status: "already-initialized" });
    expect(await workspace.recover()).toMatchObject({ ok: true });
  });

  test("serializes initialize with initialize and recover in invocation order", async () => {
    for (const secondOperation of ["initialize", "recover"] as const) {
      const roots = await temporaryWorkspace();
      const base = await createLocalResourceProvider(roots);
      const commitEntered = deferred<void>();
      const commitGate = deferred<void>();
      let activeMutations = 0;
      let commits = 0;
      let maxActiveMutations = 0;
      let releases = 0;
      let stages = 0;
      const resources = new Proxy(base, {
        get(target, property) {
          if (property === "stageReplacement") {
            return async (...args: Parameters<LocalResourceProvider["stageReplacement"]>) => {
              stages += 1;
              return target.stageReplacement(...args);
            };
          }
          if (property === "commitReplacement") {
            return async (...args: Parameters<LocalResourceProvider["commitReplacement"]>) => {
              commits += 1;
              activeMutations += 1;
              maxActiveMutations = Math.max(maxActiveMutations, activeMutations);
              commitEntered.resolve();
              await commitGate.promise;
              const outcome = await target.commitReplacement(...args);
              activeMutations -= 1;
              return outcome;
            };
          }
          if (property === "releaseCoordination") {
            return async (...args: Parameters<LocalResourceProvider["releaseCoordination"]>) => {
              releases += 1;
              return target.releaseCoordination(...args);
            };
          }
          const value = target[property as keyof LocalResourceProvider];
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      const workspace = await createLocalWorkspaceCapability({
        operations,
        transactionProvider: provider(emptySnapshot),
        resources,
      });

      const first = workspace.initialize();
      await commitEntered.promise;
      const second = workspace[secondOperation]();
      expect({ commits, releases, stages }).toEqual({ commits: 1, releases: 0, stages: 1 });
      commitGate.resolve();

      expect(await first).toMatchObject({ status: "initialized" });
      expect(await second).toMatchObject(
        secondOperation === "initialize"
          ? { status: "already-initialized" }
          : { ok: true, value: { status: "completed" } },
      );
      expect(maxActiveMutations).toBe(1);
      expect(commits).toBe(1);
      expect(releases).toBe(1);
      expect(workspace.status()).toEqual({ state: "ready" });
    }
  });

  test("serializes concurrent recover calls and snapshots once", async () => {
    const roots = await temporaryWorkspace();
    await Bun.write(
      path.join(roots.workspaceRoot, "groma", "groma.yaml"),
      defaultWorkspaceDocument,
    );
    const resources = await createLocalResourceProvider(roots);
    const snapshotEntered = deferred<void>();
    const snapshotGate = deferred<void>();
    let activeSnapshots = 0;
    let maxActiveSnapshots = 0;
    let snapshots = 0;
    const workspace = await createLocalWorkspaceCapability({
      operations,
      transactionProvider: provider(async () => {
        snapshots += 1;
        activeSnapshots += 1;
        maxActiveSnapshots = Math.max(maxActiveSnapshots, activeSnapshots);
        snapshotEntered.resolve();
        await snapshotGate.promise;
        activeSnapshots -= 1;
        return emptySnapshot();
      }),
      resources,
    });

    const first = workspace.recover();
    await snapshotEntered.promise;
    const second = workspace.recover();
    expect(snapshots).toBe(1);
    snapshotGate.resolve();

    expect(await first).toMatchObject({ ok: true });
    expect(await second).toMatchObject({ ok: true });
    expect(snapshots).toBe(1);
    expect(maxActiveSnapshots).toBe(1);
    expect(workspace.status()).toEqual({ state: "ready" });
  });
});
