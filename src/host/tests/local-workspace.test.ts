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

const emptySnapshot = () => ({ generation: 0, revisions: [], state: {} });

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
        state: {},
      })),
      resources,
    });

    expect(await workspace.recover()).toMatchObject({
      diagnostics: [{ code: "invalid-workspace-recovery" }],
      ok: false,
    });
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
});
