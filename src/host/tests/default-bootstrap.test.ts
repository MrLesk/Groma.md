import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createDefaultBootstrapRegistry,
  type HostSurface,
  type HostSurfaceSession,
} from "../index.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function temporaryWorkspace() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "groma-host-composition-"));
  const coordinationRoot = await mkdtemp(path.join(tmpdir(), "groma-host-coordination-"));
  roots.push(workspaceRoot, coordinationRoot);
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

describe("default bootstrap registry", () => {
  test("composes every 1A capability explicitly with stable shared identity", async () => {
    const context = await temporaryWorkspace();
    let byte = 0;
    const surface = idleSurface();
    const registry = createDefaultBootstrapRegistry({
      coordinationRoot: context.coordinationRoot,
      entropy: (length) => Uint8Array.from({ length }, () => byte++ % 256),
      surface,
    });
    const composed = await registry.compose({ workspaceRoot: context.workspaceRoot });

    expect(composed.ok).toBeTrue();
    if (!composed.ok) return;
    expect(composed.value.surface).toBe(surface);
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
      "queries",
      "resourceMapper",
      "resources",
      "store",
      "surface",
      "transactionEngine",
      "transactionProvider",
      "workspace",
    ]);
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
});
