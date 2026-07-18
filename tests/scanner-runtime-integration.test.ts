import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  definePlugin,
  pluginRuntimeApiVersion,
  scannerCapability,
  scannerCapabilityId,
  scannerCapabilityVersion,
  type Result,
  type RunningPluginGraph,
} from "groma/plugin-sdk";

import { PluginRuntime, success } from "../src/core/index.ts";
import {
  createLocalScannerProjectResources,
  createScannerExecutionRuntime,
  type BootstrapArchitecture,
  type BootstrapPlatform,
} from "../src/host/index.ts";
import {
  createLocalObservationJournal,
  createLocalResourceProvider,
} from "../src/persistence/index.ts";
import { conformingScanner } from "./fixtures/conforming-scanner.ts";

function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.diagnostics.map((item) => item.code).join(", "));
  return result.value;
}

test("executes a public-SDK-only third-party scanner through the Host runtime", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "groma-public-scanner-"));
  const scannerId = "example.conforming-scanner";
  const registration = definePlugin({
    manifest: {
      apiVersion: pluginRuntimeApiVersion,
      id: scannerId,
      phase: 1,
      provides: [scannerCapability],
      requires: [],
      version: "1.2.3",
    },
    start: () => ({
      capabilities: [
        {
          id: scannerCapabilityId,
          value: conformingScanner,
          version: scannerCapabilityVersion,
        },
      ],
    }),
  });
  const pluginRuntime = new PluginRuntime();
  let graph: RunningPluginGraph | undefined;

  try {
    await mkdir(path.join(workspaceRoot, "src"), { recursive: true });
    await writeFile(path.join(workspaceRoot, "src", "index.ts"), "export const api = true;\n");
    const resources = await createLocalResourceProvider({ workspaceRoot });
    const journal = createLocalObservationJournal({ resources });
    graph = valueOf(
      await pluginRuntime.start(
        valueOf(pluginRuntime.resolve([registration])),
        Object.freeze({ isCancellationRequested: () => false }),
      ),
    );
    const consumed: unknown[] = [];
    const runtime = createScannerExecutionRuntime({
      consumer: Object.freeze({
        consume: async (snapshot: unknown) => {
          consumed.push(snapshot);
          return success(undefined);
        },
      }),
      entropy: (length) => new Uint8Array(length).fill(7),
      journal,
      plugins: graph,
      projectResources: (project) =>
        createLocalScannerProjectResources({
          architecture: process.arch as BootstrapArchitecture,
          platform: process.platform as BootstrapPlatform,
          source: project.source,
          workspaceRoot,
        }),
      projects: Object.freeze({
        get: async () =>
          success(
            Object.freeze({
              availability: "available" as const,
              coverage: Object.freeze([Object.freeze({ id: "app", resourceRoot: "src" as const })]),
              id: "project.default" as const,
              name: "Public scanner fixture",
              revision: `sha256:${"a".repeat(64)}` as const,
              scanners: Object.freeze([
                Object.freeze({ configuration: Object.freeze({}), id: scannerId }),
              ]),
              source: "." as const,
            }),
          ),
      }),
    });

    const execution = valueOf(await runtime.start({ projectId: "project.default", scannerId }));
    expect(await execution.completion).toMatchObject({
      batchCount: 1,
      recordCount: 1,
      status: "completed",
    });
    expect(consumed).toHaveLength(1);
    expect(consumed[0]).toMatchObject({
      coverage: [{ kinds: ["component-candidate"], scope: "app", state: "partial" }],
      records: [{ candidate: { name: "API" }, kind: "component-candidate" }],
      source: { id: scannerId, instance: "default", version: "1.2.3" },
    });
  } finally {
    if (graph !== undefined) await graph.shutdown();
    await rm(workspaceRoot, { force: true, recursive: true });
  }
});
