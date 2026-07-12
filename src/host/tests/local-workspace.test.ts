import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { ApplicationOperations } from "../../application/index.ts";
import { parseGraphGeneration, type TransactionProvider } from "../../core/index.ts";
import {
  createLocalResourceProvider,
  type LocalResourceProvider,
} from "../../persistence/index.ts";
import {
  createLocalWorkspaceCapability,
  defaultWorkspaceDocument,
  workspaceConfigurationLocator,
} from "../index.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function temporaryWorkspace() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "groma-host-workspace-"));
  const coordinationRoot = await mkdtemp(path.join(tmpdir(), "groma-host-locks-"));
  roots.push(workspaceRoot, coordinationRoot);
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

const emptySnapshot = () => ({
  generation: 0,
  revisions: [],
  state: { components: [], relationships: [] },
});

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
      emptySnapshot(),
    ];
    const workspace = await createLocalWorkspaceCapability({
      operations,
      transactionProvider: provider(() => outcomes.shift() as never),
      resources,
    });

    for (let attempt = 0; attempt < 9; attempt += 1) {
      expect(await workspace.recover()).toMatchObject({
        diagnostics: [{ code: "invalid-workspace-recovery" }],
        ok: false,
      });
    }
    const recovered = await workspace.recover();
    expect(recovered).toEqual({
      ok: true,
      value: { generation: 0, status: "completed" },
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
});
