import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type {
  HostSurfaceContext,
  ProjectRegistrationSnapshot,
  ScannerExecutionReport,
} from "../../host/index.ts";
import { CLI_EXIT } from "../contracts.ts";
import { runProgram, type ProgramOptions } from "../program.ts";
import { createCliSurfaceController } from "../surface.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function workspace(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "groma-cli-scan-"));
  roots.push(root);
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "scan-fixture" }));
  await writeFile(
    path.join(root, "src", "index.ts"),
    "export function serve() { return 'ready'; }\n",
  );
  return root;
}

async function canonicalFiles(root: string): Promise<readonly (readonly [string, string])[]> {
  const files: Array<readonly [string, string]> = [];
  const visit = async (directory: string, prefix: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relative = prefix.length === 0 ? entry.name : `${prefix}/${entry.name}`;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute, relative);
      else if (entry.isFile())
        files.push(Object.freeze([relative, await readFile(absolute, "base64")]));
    }
  };
  await visit(path.join(root, "groma"), "");
  return Object.freeze(files);
}

async function run(
  root: string,
  args: readonly string[],
  options: Omit<ProgramOptions, "workspaceRoot"> = {},
) {
  const output: string[] = [];
  const errors: string[] = [];
  const exitCode = await runProgram(
    args,
    {
      writeError: (message) => errors.push(message),
      writeOutput: (message) => output.push(message),
    },
    {
      terminal: { stdin: false, stdout: false },
      workspaceRoot: root,
      ...options,
    },
  );
  return Object.freeze({ errors, exitCode, output: output.join("") });
}

const configuredProject: ProjectRegistrationSnapshot = Object.freeze({
  availability: "available",
  coverage: Object.freeze([Object.freeze({ id: "workspace", resourceRoot: "." })]),
  id: "project.default",
  name: "Fixture",
  revision: `sha256:${"0".repeat(64)}`,
  scanners: Object.freeze([
    Object.freeze({ configuration: Object.freeze({}), id: "official.typescript" }),
  ]),
  source: ".",
});

function scannerReport(status: "cancelled" | "failed" | "indeterminate"): ScannerExecutionReport {
  return Object.freeze({
    apiVersion: "groma.scanner-execution/v1",
    batchCount: 0,
    diagnostics:
      status === "failed"
        ? Object.freeze([Object.freeze({ code: "scanner-failed", message: "Scan failed" })])
        : Object.freeze([]),
    epoch: "epoch_00000000000000000000000000000000",
    lastHeartbeatSequence: 0,
    lastSequence: 0,
    projectId: configuredProject.id,
    recordCount: 0,
    ...(status === "indeterminate"
      ? {
          recovery: Object.freeze({
            baseGeneration: 1,
            generation: 2,
            resources: Object.freeze(["groma/evidence.md"]),
            token: "fixture-recovery",
          }),
        }
      : {}),
    scannerId: "official.typescript",
    signalCount: 0,
    status,
  }) as ScannerExecutionReport;
}

async function surfaceResult(report: ScannerExecutionReport, startFailureCode?: string) {
  const cancellation = new AbortController();
  const context = {
    cancellation: cancellation.signal,
    projects: {
      get: async () => ({ ok: true, value: configuredProject }),
      list: async () => ({ ok: true, value: Object.freeze([configuredProject]) }),
    },
    scanners: {
      recover: async () => ({
        ok: true,
        value: Object.freeze({ abandoned: 0, acknowledged: 0, consumed: 0 }),
      }),
      start: async (request: { readonly cancellation?: AbortSignal }) =>
        startFailureCode === undefined
          ? {
              ok: true,
              value: Object.freeze({
                cancel: () => {},
                completion:
                  report.status === "cancelled"
                    ? new Promise<ScannerExecutionReport>((resolve) =>
                        request.cancellation?.addEventListener("abort", () => resolve(report), {
                          once: true,
                        }),
                      )
                    : Promise.resolve(report),
                inspect: () => report,
              }),
            }
          : {
              diagnostics: Object.freeze([
                Object.freeze({ code: startFailureCode, message: "Scan start failed" }),
              ]),
              ok: false,
            },
    },
  } as unknown as HostSurfaceContext;
  const controller = createCliSurfaceController(
    Object.freeze({ command: Object.freeze({ kind: "scan" }), format: "json" }),
    Object.freeze({ read: async () => "" }),
    Object.freeze({ stdin: false, stdout: false }),
  );
  const session = await controller.surface.start(context);
  if (report.status === "cancelled") {
    cancellation.abort();
    await session.stop();
  } else {
    await session.completion;
  }
  return controller.result();
}

describe("CLI scan workflow", () => {
  test("configures, scans, reconciles, and keeps an unchanged rescan byte-stable", async () => {
    const root = await workspace();
    let presentationAttempts = 0;
    const missing = await run(root, [], {
      presentBlueprint: async () => {
        presentationAttempts += 1;
        return "unused";
      },
      terminal: { stdin: true, stdout: true },
    });
    expect(missing.output).toContain("groma init");
    expect(presentationAttempts).toBe(0);

    expect((await run(root, ["--format=json", "init"])).exitCode).toBe(CLI_EXIT.success);

    const noninteractive = await run(root, [], {
      presentBlueprint: async () => {
        presentationAttempts += 1;
        return "unused";
      },
    });
    expect(noninteractive.output).toContain("Run bare groma in an interactive terminal");
    expect(presentationAttempts).toBe(0);

    const first = await run(root, ["--format=json", "scan"]);
    expect(first).toMatchObject({ exitCode: CLI_EXIT.success });
    const firstResult = JSON.parse(first.output);
    expect(firstResult).toMatchObject({
      command: "scan",
      ok: true,
      result: {
        observations: { batches: 1 },
        project: { name: path.basename(root) },
        scanner: "official.typescript",
        status: "completed",
      },
    });
    expect(firstResult.result.observations.records).toBeGreaterThan(0);

    const canonicalBeforeVisual = await canonicalFiles(root);
    let presented = "";
    const visual = await run(root, [], {
      presentBlueprint: async (html) => {
        presented = html;
        return "/tmp/groma-blueprint/blueprint.html";
      },
      terminal: { stdin: true, stdout: true },
    });
    expect(visual).toMatchObject({ exitCode: CLI_EXIT.success });
    expect(visual.output).toContain('"status":"opened"');
    expect(presented).toContain('aria-label="groma.md lockup"');
    expect(presented).toContain("scan-fixture");
    expect(await canonicalFiles(root)).toEqual(canonicalBeforeVisual);

    const presentationFailure = await run(root, [], {
      presentBlueprint: async () => {
        throw new Error("unavailable");
      },
      terminal: { stdin: true, stdout: true },
    });
    expect(presentationFailure.exitCode).toBe(CLI_EXIT.infrastructure);
    expect(presentationFailure.output).toContain("cli-blueprint-artifact-unavailable");

    const listed = await run(root, ["--format=json", "component", "list", "--limit", "10"]);
    expect(listed.exitCode).toBe(CLI_EXIT.success);
    expect(JSON.parse(listed.output).result.value.items.length).toBeGreaterThan(0);

    const before = await canonicalFiles(root);
    const second = await run(root, ["--format=json", "scan"]);
    expect(second.exitCode).toBe(CLI_EXIT.success);
    expect(await canonicalFiles(root)).toEqual(before);

    const plain = await run(root, ["scan"]);
    expect(plain).toMatchObject({ exitCode: CLI_EXIT.success });
    expect(plain.output).toContain("command: scan\nexit-code: 0\nok: true\n");
    expect(plain.output).toContain('"status":"completed"');

    const notConfigured = await run(root, [
      "--format=json",
      "scan",
      "--scanner",
      "example.scanner",
    ]);
    expect(notConfigured.exitCode).toBe(CLI_EXIT.workspace);
    expect(JSON.parse(notConfigured.output)).toMatchObject({
      ok: false,
      result: { diagnostics: [{ code: "scan-scanner-not-configured" }] },
    });

    const added = await run(root, ["--format=json", "project", "add", "--stdin"], {
      inputReader: Object.freeze({
        read: async () =>
          JSON.stringify({
            coverage: [{ id: "workspace", resourceRoot: "." }],
            name: "Second",
            scanners: [{ configuration: {}, id: "official.typescript" }],
            source: ".",
          }),
      }),
    });
    expect(added.exitCode).toBe(CLI_EXIT.success);

    const ambiguous = await run(root, ["--format=json", "scan"]);
    expect(ambiguous.exitCode).toBe(CLI_EXIT.workspace);
    expect(JSON.parse(ambiguous.output)).toMatchObject({
      ok: false,
      result: { diagnostics: [{ code: "scan-project-selection-required" }] },
    });

    const selected = await run(root, [
      "--format=json",
      "scan",
      "--project",
      firstResult.result.project.id,
      "--scanner",
      "official.typescript",
    ]);
    expect(selected.exitCode).toBe(CLI_EXIT.success);
    expect(JSON.parse(selected.output)).toMatchObject({
      result: { project: { id: firstResult.result.project.id }, status: "completed" },
    });
  });

  test("maps every non-completed terminal report at the public surface", async () => {
    expect(await surfaceResult(scannerReport("cancelled"))).toMatchObject({
      command: "scan",
      exitCode: CLI_EXIT.cancelled,
      ok: false,
      result: { status: "cancelled" },
    });
    expect(await surfaceResult(scannerReport("failed"))).toMatchObject({
      command: "scan",
      exitCode: CLI_EXIT.semantic,
      ok: false,
      result: { diagnostics: [{ code: "scanner-failed" }], status: "failed" },
    });
    expect(await surfaceResult(scannerReport("indeterminate"))).toMatchObject({
      command: "scan",
      exitCode: CLI_EXIT.indeterminate,
      ok: false,
      result: {
        recovery: { generation: 2, token: "fixture-recovery" },
        status: "indeterminate",
      },
    });
    expect(
      await surfaceResult(scannerReport("cancelled"), "scanner-execution-cancelled"),
    ).toMatchObject({
      command: "scan",
      exitCode: CLI_EXIT.cancelled,
      ok: false,
      result: { diagnostics: [{ code: "scanner-execution-cancelled" }] },
    });
  });
});
