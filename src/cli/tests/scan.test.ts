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
            resources: Object.freeze(["groma/evidence/index.json"]),
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
  test("atomically publishes a first scan beyond one hundred observed relationships", async () => {
    const root = await workspace();
    const modules = Array.from({ length: 11 }, (_, index) => `module-${index}`);
    await Promise.all(
      modules.map(async (module) => {
        const directory = path.join(root, "src", module);
        await mkdir(directory);
        const imports = modules
          .filter((target) => target !== module)
          .map((target) => `import "../${target}/index.ts";`);
        await writeFile(path.join(directory, "index.ts"), `${imports.join("\n")}\n`);
      }),
    );

    expect((await run(root, ["--format=json", "init"])).exitCode).toBe(CLI_EXIT.success);
    const scanned = await run(root, ["--format=json", "scan"]);

    expect(scanned.exitCode).toBe(CLI_EXIT.success);
    expect(JSON.parse(scanned.output)).toMatchObject({
      ok: true,
      result: {
        status: "completed",
      },
    });
    expect(JSON.parse(scanned.output).result.observations.records).toBeGreaterThan(100);
  });

  test("publishes more than one hundred Nuxt routes through bounded API areas", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "groma-cli-nuxt-scan-"));
    roots.push(root);
    await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "nuxt-scan" }));
    await writeFile(path.join(root, "nuxt.config.ts"), "export default defineNuxtConfig({});\n");
    await writeFile(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        files: [],
        references: [
          { path: "./.nuxt/tsconfig.app.json" },
          { path: "./.nuxt/tsconfig.server.json" },
          { path: "./.nuxt/tsconfig.shared.json" },
          { path: "./.nuxt/tsconfig.node.json" },
        ],
      }),
    );
    for (const area of ["applications", "teams"]) {
      const directory = path.join(root, "server", "api", "events", "[eventId]", area);
      await mkdir(directory, { recursive: true });
      await Promise.all(
        Array.from({ length: 60 }, (_, index) =>
          writeFile(
            path.join(directory, `route-${index}.get.ts`),
            "export default defineEventHandler(() => ({ ok: true }));\n",
          ),
        ),
      );
    }
    const denseDirectory = path.join(root, "server", "api", "users");
    await mkdir(denseDirectory, { recursive: true });
    await Promise.all(
      Array.from({ length: 65 }, (_, index) =>
        writeFile(
          path.join(denseDirectory, `route-${index}.get.ts`),
          "export default defineEventHandler(() => ({ ok: true }));\n",
        ),
      ),
    );

    expect((await run(root, ["--format=json", "init"])).exitCode).toBe(CLI_EXIT.success);
    const scanned = await run(root, ["--format=json", "scan"]);
    expect(scanned.exitCode).toBe(CLI_EXIT.success);
    expect(JSON.parse(scanned.output).result.observations.records).toBeGreaterThan(100);

    // Scanning real topography emits a component per source file too, so the
    // route areas no longer fit one bounded page; page through to collect them.
    const items: Array<{ component: { actions?: readonly unknown[]; name: string } }> = [];
    let cursor: string | undefined;
    do {
      const exported = await run(root, [
        "--format=json",
        "blueprint",
        "export",
        "--limit",
        "100",
        ...(cursor === undefined ? [] : ["--cursor", cursor]),
      ]);
      expect(exported.exitCode).toBe(CLI_EXIT.success);
      const page = JSON.parse(exported.output).result.value as {
        hasMore: boolean;
        items: typeof items;
        nextCursor?: string;
      };
      items.push(...page.items);
      cursor = page.hasMore ? page.nextCursor : undefined;
    } while (cursor !== undefined);
    expect(items.flatMap((item) => item.component.actions ?? [])).toHaveLength(0);
    const evidenceFiles = (await readdir(path.join(root, "groma", "evidence"))).filter(
      (file) => file !== "index.json",
    );
    expect(evidenceFiles).toHaveLength(1);
    const evidence = JSON.parse(
      await readFile(path.join(root, "groma", "evidence", evidenceFiles[0]!), "utf8"),
    ) as { source: { snapshot: { records: readonly { kind: string }[] } } };
    expect(
      evidence.source.snapshot.records.filter((record) => record.kind === "action"),
    ).toHaveLength(120);
    expect(
      items
        .filter((item) => item.component.name.startsWith("/api/"))
        .map((item) => item.component.name)
        .sort(),
    ).toEqual(["/api/events/[eventId]/applications", "/api/events/[eventId]/teams", "/api/users"]);
  });

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
    expect(visual.output).toContain('"components":');
    expect(presented).toContain('data-groma-export="read-only"');
    expect(presented).toContain("groma-read-only-blueprint-v1");
    expect(presented).toContain("connect-src 'none'");
    expect(presented).toContain("scan-fixture");
    expect(presented).not.toMatch(/<script\b[^>]*\bsrc=/i);
    expect(presented).not.toMatch(/<link\b[^>]*\brel=["']stylesheet["']/i);
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
    const listedResult = JSON.parse(listed.output);
    expect(listedResult.result.value.items.length).toBeGreaterThan(0);

    const observed = listedResult.result.value.items.find(
      (item: { component: { name?: string } }) => item.component.name === "scan-fixture",
    );
    expect(observed).toBeDefined();
    const canonicalBeforeDetail = await canonicalFiles(root);
    const detail = await run(root, [
      "--format=json",
      "component",
      "get",
      observed.component.id,
      "--relationships-limit",
      "10",
    ]);
    expect(detail.exitCode).toBe(CLI_EXIT.success);
    const detailResult = JSON.parse(detail.output).result.value;
    expect(detailResult.evidence).toHaveLength(1);
    expect(detailResult.evidence[0]).toMatchObject({
      binding: { present: true, scope: "workspace" },
      coverage: [{ scope: "workspace", state: "complete" }],
      projectId: firstResult.result.project.id,
      scanner: { id: "official.typescript" },
    });
    expect(detailResult.evidence[0].records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "component-candidate",
          provenance: expect.arrayContaining([
            expect.objectContaining({ resource: "package.json", scope: "workspace" }),
          ]),
        }),
      ]),
    );
    const plainDetail = await run(root, [
      "component",
      "get",
      observed.component.id,
      "--relationships-limit",
      "10",
    ]);
    expect(plainDetail.output).toContain('"evidence":[{');
    expect(plainDetail.output).toContain('"scanner":{"id":"official.typescript"');
    expect(await canonicalFiles(root)).toEqual(canonicalBeforeDetail);

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

  test("submits a completed external scan through registered reconciliation", async () => {
    const root = await workspace();
    expect((await run(root, ["--format=json", "init"])).exitCode).toBe(CLI_EXIT.success);
    expect((await run(root, ["--format=json", "scan"])).exitCode).toBe(CLI_EXIT.success);

    const projectRead = await run(root, ["--format=json", "project", "get", "project.default"]);
    const project = JSON.parse(projectRead.output).result.value as ProjectRegistrationSnapshot;
    const registrationFile = path.join(root, "external-project.json");
    await writeFile(
      registrationFile,
      JSON.stringify({
        coverage: project.coverage,
        name: project.name,
        scanners: [...project.scanners, { configuration: {}, id: "example.external" }],
        source: project.source,
      }),
    );
    expect(
      (
        await run(root, [
          "--format=json",
          "project",
          "update",
          project.id,
          "--revision",
          project.revision,
          "--input",
          registrationFile,
        ])
      ).exitCode,
    ).toBe(CLI_EXIT.success);

    const externalFile = path.join(root, "external-observations.json");
    const snapshot = {
      apiVersion: "groma.observation/v1",
      coverage: [{ kinds: ["component-candidate"], scope: "workspace", state: "complete" }],
      epoch: "epoch_external_000000000000000000000000",
      projectId: project.id,
      records: [
        {
          candidate: { name: "External worker", type: "service" },
          key: "component.external-worker",
          kind: "component-candidate",
          provenance: [
            {
              fingerprint: `sha256:${"a".repeat(64)}`,
              resource: "external.ts",
              scope: "workspace",
            },
          ],
          scope: "workspace",
        },
      ],
      scopes: project.coverage,
      source: { id: "example.external", instance: "default", version: "1.0.0" },
    };
    await writeFile(externalFile, JSON.stringify({ ...snapshot, trailing: true }));
    const beforeInvalid = await canonicalFiles(root);
    expect((await run(root, ["--format=json", "scan", "--input", externalFile])).exitCode).toBe(
      CLI_EXIT.semantic,
    );
    expect(await canonicalFiles(root)).toEqual(beforeInvalid);

    await writeFile(externalFile, JSON.stringify(snapshot));
    const submitted = await run(root, ["--format=json", "scan", "--input", externalFile]);
    expect(submitted.exitCode).toBe(CLI_EXIT.success);
    expect(JSON.parse(submitted.output)).toMatchObject({
      result: {
        observations: { records: 1 },
        project: { id: project.id },
        scanner: "example.external",
        status: "completed",
      },
    });
    const afterFirst = await canonicalFiles(root);
    const stdinSubmission = await run(root, ["scan", "--input", "-"], {
      inputReader: Object.freeze({ read: async () => JSON.stringify(snapshot) }),
    });
    expect(stdinSubmission.exitCode).toBe(CLI_EXIT.success);
    expect(stdinSubmission.output).toContain("command: scan\nexit-code: 0\nok: true\n");
    expect(await canonicalFiles(root)).toEqual(afterFirst);

    const listed = await run(root, ["--format=json", "component", "list", "--limit", "100"]);
    const items = JSON.parse(listed.output).result.value.items as Array<{
      component: { id: string; name?: string };
    }>;
    const external = items.find((item) => item.component.name === "External worker");
    expect(external).toBeDefined();
    const detail = await run(root, [
      "--format=json",
      "component",
      "get",
      external!.component.id,
      "--relationships-limit",
      "10",
    ]);
    expect(JSON.parse(detail.output).result.value.evidence).toMatchObject([
      { scanner: { id: "example.external", version: "1.0.0" } },
    ]);
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
