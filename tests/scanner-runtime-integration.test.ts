import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  definePlugin,
  pluginRuntimeApiVersion,
  scannerCapability,
  scannerCapabilityId,
  scannerCapabilityVersion,
  type CompletedObservationSnapshot,
  type ObservationBatch,
  type ObservationCompletion,
  type ObservationFailure,
  type ObservationHeartbeat,
  type Result,
  type RunningPluginGraph,
  type ScannerObservationSink,
} from "groma/plugin-sdk";

import {
  createObservationSession,
  observationSessionApiVersion,
  PluginRuntime,
  success,
  type ObservationSession,
} from "../src/core/index.ts";
import {
  createLocalScannerProjectResources,
  createScannerExecutionRuntime,
  typescriptBunScanner,
  typescriptBunScannerIdentity,
  typescriptBunScannerRegistration,
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

function observationSink(session: ObservationSession): ScannerObservationSink {
  return Object.freeze({
    complete: (completion: ObservationCompletion) => {
      const completed = session.complete(completion);
      return completed.ok ? success(undefined) : completed;
    },
    fail: (report: ObservationFailure) => session.fail(report),
    heartbeat: (heartbeat: ObservationHeartbeat) => session.heartbeat(heartbeat),
    submitBatch: (batch: ObservationBatch) => session.submitBatch(batch),
  });
}

async function scanGromaCheckout(): Promise<CompletedObservationSnapshot> {
  const descriptor = Object.freeze({
    apiVersion: observationSessionApiVersion,
    epoch: "epoch.groma-self-scan",
    projectId: "project.default",
    scopes: Object.freeze([Object.freeze({ id: "workspace", resourceRoot: "." })]),
    source: Object.freeze({
      id: typescriptBunScannerIdentity.id,
      instance: "self-scan",
      version: typescriptBunScannerIdentity.version,
    }),
  });
  const session = valueOf(createObservationSession(descriptor));
  const workspaceRoot = path.resolve(import.meta.dir, "..");
  const resources = valueOf(
    await createLocalScannerProjectResources({
      architecture: process.arch as BootstrapArchitecture,
      platform: process.platform as BootstrapPlatform,
      source: ".",
      workspaceRoot,
    }),
  );
  const result = await typescriptBunScanner.scan(
    Object.freeze({
      apiVersion: "groma.scanner/v1" as const,
      cancellation: Object.freeze({ isCancellationRequested: () => false }),
      configuration: Object.freeze({ include: Object.freeze(["src"]) }),
      observations: observationSink(session),
      resources,
      session: descriptor,
    }),
  );
  if (!result.ok) throw new Error(result.diagnostics.map((item) => item.code).join(", "));
  return valueOf(session.snapshot());
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

test("executes the built-in TypeScript scanner through durable Host handoff", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "groma-typescript-scanner-"));
  const pluginRuntime = new PluginRuntime();
  let graph: RunningPluginGraph | undefined;

  try {
    await mkdir(path.join(workspaceRoot, "src", "api"), { recursive: true });
    await mkdir(path.join(workspaceRoot, "src", "model"), { recursive: true });
    await writeFile(
      path.join(workspaceRoot, "package.json"),
      JSON.stringify({ exports: "./src/index.ts", name: "runtime-fixture" }),
    );
    await writeFile(
      path.join(workspaceRoot, "src", "index.ts"),
      'export { start } from "./api/routes.ts";\n',
    );
    await writeFile(
      path.join(workspaceRoot, "src", "api", "routes.ts"),
      'import { model } from "../model/index.ts";\n' +
        'Bun.serve({ routes: { "/health": () => Response.json(model) } });\n' +
        "export function start() { return model; }\n",
    );
    await writeFile(
      path.join(workspaceRoot, "src", "model", "index.ts"),
      "export const model = { ok: true };\n",
    );
    const resources = await createLocalResourceProvider({ workspaceRoot });
    const journal = createLocalObservationJournal({ resources });
    graph = valueOf(
      await pluginRuntime.start(
        valueOf(pluginRuntime.resolve([typescriptBunScannerRegistration])),
        Object.freeze({ isCancellationRequested: () => false }),
      ),
    );
    const consumed: CompletedObservationSnapshot[] = [];
    const runtime = createScannerExecutionRuntime({
      consumer: Object.freeze({
        consume: async (snapshot: CompletedObservationSnapshot) => {
          consumed.push(snapshot);
          return success(undefined);
        },
      }),
      entropy: (length) => new Uint8Array(length).fill(9),
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
              coverage: Object.freeze([
                Object.freeze({ id: "workspace", resourceRoot: "." as const }),
              ]),
              id: "project.default" as const,
              name: "Built-in scanner fixture",
              revision: `sha256:${"b".repeat(64)}` as const,
              scanners: Object.freeze([
                Object.freeze({ configuration: Object.freeze({}), id: "official.typescript" }),
              ]),
              source: "." as const,
            }),
          ),
      }),
    });

    const execution = valueOf(
      await runtime.start({ projectId: "project.default", scannerId: "official.typescript" }),
    );
    expect(await execution.completion).toMatchObject({ status: "completed" });
    expect(consumed).toHaveLength(1);
    expect(consumed[0]?.source).toEqual({
      id: "official.typescript",
      instance: "default",
      version: "1.0.0",
    });
    expect(
      consumed[0]?.records.some(
        (record) => record.kind === "action" && record.name === "ROUTE /health",
      ),
    ).toBeTrue();
    expect(
      consumed[0]?.records.some(
        (record) => record.kind === "relationship" && record.relationshipType === "imports",
      ),
    ).toBeTrue();
  } finally {
    if (graph !== undefined) await graph.shutdown();
    await rm(workspaceRoot, { force: true, recursive: true });
  }
});

test("self-scans Groma with stable bounded evidence and no protected-state provenance", async () => {
  const first = await scanGromaCheckout();
  const second = await scanGromaCheckout();

  expect(second).toEqual(first);
  const candidates = first.records.filter((record) => record.kind === "component-candidate");
  const candidatesByKey = new Map(candidates.map((record) => [record.key, record.candidate]));
  expect(candidates.map((record) => record.candidate)).toContainEqual({
    name: "groma",
    type: "package",
  });
  const boundaryNames = candidates
    .filter((record) => record.candidate.type === "source-boundary")
    .map((record) => record.candidate.name);
  expect(boundaryNames.sort()).toEqual([
    "application",
    "cli",
    "core",
    "host",
    "persistence",
    "plugin-sdk",
    "standard-model",
  ]);
  const internalEdges = first.records
    .filter((record) => record.kind === "relationship" && record.relationshipType === "imports")
    .flatMap((record) => {
      if (record.kind !== "relationship") return [];
      const from = candidatesByKey.get(record.from.key);
      const to = candidatesByKey.get(record.to.key);
      return from?.type === "source-boundary" && to?.type === "source-boundary"
        ? [`${from.name}->${to.name}`]
        : [];
    })
    .sort();
  expect(internalEdges).toEqual([
    "application->core",
    "application->standard-model",
    "cli->application",
    "cli->host",
    "host->application",
    "host->core",
    "host->persistence",
    "host->plugin-sdk",
    "host->standard-model",
    "persistence->core",
    "persistence->standard-model",
    "plugin-sdk->core",
    "standard-model->core",
  ]);
  const publicExportDescriptions = new Set(
    first.records
      .filter((record) => record.kind === "action")
      .map((record) => record.description)
      .filter((value): value is string => value !== undefined),
  );
  expect(publicExportDescriptions).toContain("Public export at ./plugin-sdk");
  expect(publicExportDescriptions).toContain("Public export at ./plugin-sdk/conformance");
  const documentation = first.records
    .filter((record) => record.kind === "documentation")
    .map((record) => record.content)
    .join("\n");
  expect(documentation).toContain("groma/plugin-sdk");
  expect(documentation).toContain("groma/plugin-sdk/conformance");
  expect(first.records.length).toBeLessThanOrEqual(4_096);
  const forbiddenSegments = new Set([
    ".groma-cache",
    ".next",
    "__generated__",
    "__tests__",
    "build",
    "dist",
    "generated",
    "groma",
    "node_modules",
    "out",
    "test",
    "tests",
    "vendor",
  ]);
  const workspaceRoot = path.resolve(import.meta.dir, "..");
  const bytesByResource = new Map<string, Uint8Array>();
  for (const record of first.records) {
    for (const item of record.provenance) {
      const segments = item.resource.split("/");
      expect(segments.some((segment) => forbiddenSegments.has(segment))).toBeFalse();
      expect(/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(item.resource)).toBeFalse();
      let bytes = bytesByResource.get(item.resource);
      if (bytes === undefined) {
        bytes = new Uint8Array(await readFile(path.join(workspaceRoot, ...segments)));
        bytesByResource.set(item.resource, bytes);
      }
      expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(item.fingerprint);
      if (item.range !== undefined) {
        expect(item.range.startByte).toBeGreaterThanOrEqual(0);
        expect(item.range.endByteExclusive).toBeGreaterThan(item.range.startByte);
        expect(item.range.endByteExclusive).toBeLessThanOrEqual(bytes.byteLength);
      }
    }
  }
}, 15_000);
