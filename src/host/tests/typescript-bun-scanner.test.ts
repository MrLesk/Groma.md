import { describe, expect, test } from "bun:test";

import {
  createObservationSession,
  observationSessionApiVersion,
  type CompletedObservationSnapshot,
  type ObservationSession,
  type ObservationSessionBegin,
  type Result,
} from "../../core/index.ts";
import {
  scannerApiVersion,
  type ObservationBatch,
  type ObservationCompletion,
  type ObservationFailure,
  type ObservationHeartbeat,
  type ScannerConfiguration,
  type ScannerObservationSink,
  type ScannerProjectResources,
  type ScannerRequest,
  type ScannerResourceEntry,
  type ScannerResourceEnumerationRequest,
  type ScannerResourceReadRequest,
} from "../../plugin-sdk/index.ts";
import {
  typescriptBunScanner,
  typescriptBunScannerIdentity,
  typescriptBunScannerRegistration,
} from "../typescript-bun-scanner.ts";

const encoder = new TextEncoder();

function sourceExtension(resource: string): boolean {
  return /\.[cm]?[jt]sx?$/.test(resource);
}

function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.diagnostics.map((item) => item.code).join(", "));
  return result.value;
}

function begin(): ObservationSessionBegin {
  return Object.freeze({
    apiVersion: observationSessionApiVersion,
    epoch: "epoch.fixture",
    projectId: "project.fixture",
    scopes: Object.freeze([Object.freeze({ id: "workspace", resourceRoot: "." })]),
    source: Object.freeze({
      id: typescriptBunScannerIdentity.id,
      instance: "fixture",
      version: typescriptBunScannerIdentity.version,
    }),
  });
}

interface ResourceFixture {
  readonly enumerated: readonly string[];
  readonly read: readonly string[];
  readonly resources: ScannerProjectResources;
}

function resourceFixture(
  source: Readonly<Record<string, string>>,
  options: Readonly<{
    readonly failEnumeration?: boolean;
    readonly pageSize?: number;
    readonly reportedSizes?: Readonly<Record<string, number>>;
    readonly stalledCursor?: boolean;
  }> = {},
): ResourceFixture {
  const files = new Map(
    Object.entries(source).map(
      ([resource, content]) => [resource, encoder.encode(content)] as const,
    ),
  );
  const directories = new Set<string>(["."]);
  for (const resource of files.keys()) {
    const segments = resource.split("/");
    for (let index = 1; index < segments.length; index += 1) {
      directories.add(segments.slice(0, index).join("/"));
    }
  }
  const enumerated: string[] = [];
  const reads: string[] = [];
  const resources: ScannerProjectResources = Object.freeze({
    enumerate: async (request: ScannerResourceEnumerationRequest) => {
      enumerated.push(request.resource);
      if (options.failEnumeration) {
        return {
          diagnostics: [{ code: "fixture-enumeration-failed", message: "fixture failure" }],
          ok: false as const,
        };
      }
      if (options.stalledCursor) {
        return {
          ok: true as const,
          value: Object.freeze({
            entries: Object.freeze([]),
            nextCursor: request.cursor ?? "stalled",
            truncatedByDepth: false,
          }),
        };
      }
      const prefix = request.resource === "." ? "" : `${request.resource}/`;
      const entries: ScannerResourceEntry[] = [];
      for (const directory of directories) {
        if (directory === "." || directory === request.resource || !directory.startsWith(prefix)) {
          continue;
        }
        const relative = directory.slice(prefix.length);
        if (relative.includes("/")) continue;
        entries.push(
          Object.freeze({
            kind: "directory" as const,
            resource: directory,
            scope: request.scope,
          }),
        );
      }
      for (const [resource, bytes] of files) {
        if (!resource.startsWith(prefix)) continue;
        const relative = resource.slice(prefix.length);
        if (relative.includes("/")) continue;
        entries.push(
          Object.freeze({
            kind: "file" as const,
            resource,
            scope: request.scope,
            size: options.reportedSizes?.[resource] ?? bytes.byteLength,
          }),
        );
      }
      entries.sort((left, right) => (left.resource < right.resource ? -1 : 1));
      const offset = request.cursor === undefined ? 0 : Number(request.cursor);
      const limit = Math.min(request.limit, options.pageSize ?? request.limit);
      const page = entries.slice(offset, offset + limit);
      const next = offset + page.length;
      return {
        ok: true as const,
        value: Object.freeze({
          entries: Object.freeze(page),
          ...(next < entries.length ? { nextCursor: String(next) } : {}),
          truncatedByDepth: entries.some((entry) => entry.kind === "directory"),
        }),
      };
    },
    read: async (request: ScannerResourceReadRequest) => {
      reads.push(request.resource);
      const bytes = files.get(request.resource);
      return bytes === undefined
        ? {
            diagnostics: [{ code: "fixture-resource-missing", message: "fixture missing" }],
            ok: false as const,
          }
        : {
            ok: true as const,
            value: Object.freeze({ bytes: new Uint8Array(bytes) }),
          };
    },
  });
  return { enumerated, read: reads, resources };
}

function sink(session: ObservationSession, emittedKeys?: string[]): ScannerObservationSink {
  return Object.freeze({
    complete: (completion: ObservationCompletion) => {
      const result = session.complete(completion);
      return result.ok ? { ok: true as const, value: undefined } : result;
    },
    fail: (report: ObservationFailure) => session.fail(report),
    heartbeat: (heartbeat: ObservationHeartbeat) => session.heartbeat(heartbeat),
    submitBatch: (batch: ObservationBatch) => {
      emittedKeys?.push(...batch.records.map((record) => `${record.scope}\u0000${record.key}`));
      return session.submitBatch(batch);
    },
  });
}

async function scan(
  source: Readonly<Record<string, string>>,
  configuration: ScannerConfiguration = Object.freeze({}),
  resourceOptions: Readonly<{
    readonly failEnumeration?: boolean;
    readonly pageSize?: number;
    readonly reportedSizes?: Readonly<Record<string, number>>;
    readonly stalledCursor?: boolean;
  }> = {},
): Promise<
  Readonly<{
    readonly emittedKeys: readonly string[];
    readonly fixture: ResourceFixture;
    readonly result: Result<void>;
    readonly session: ObservationSession;
    readonly snapshot?: CompletedObservationSnapshot;
  }>
> {
  const descriptor = begin();
  const session = valueOf(createObservationSession(descriptor));
  const fixture = resourceFixture(source, resourceOptions);
  const emittedKeys: string[] = [];
  const request: ScannerRequest = Object.freeze({
    apiVersion: scannerApiVersion,
    cancellation: Object.freeze({ isCancellationRequested: () => false }),
    configuration,
    observations: sink(session, emittedKeys),
    resources: fixture.resources,
    session: descriptor,
  });
  const result = await typescriptBunScanner.scan(request);
  const snapshot = session.snapshot();
  return Object.freeze({
    emittedKeys: Object.freeze(emittedKeys),
    fixture,
    result,
    session,
    ...(snapshot.ok ? { snapshot: snapshot.value } : {}),
  });
}

const representativeProject = Object.freeze({
  ".gitignore": "ignored/\n",
  "README.md": "# Local architecture evidence\n",
  "generated/generated.ts": "export function invented() {}",
  "ignored/hidden.ts": "export function hidden() {}",
  "node_modules/pkg/index.ts": "export function dependency() {}",
  "package.json": JSON.stringify({
    description: "Coordinates café requests as package documentation.",
    exports: "./src/index.ts",
    name: "@fixture/service",
  }),
  "src/api/routes.ts": `
import { model } from "../domain/model.ts";
import db from "@acme/db";
Bun.serve({ routes: { "/café": { GET: () => Response.json(model) } } });
void db;
`,
  "src/domain/model.ts": "export const model = { ok: true };\n",
  "src/index.ts": `
import "./api/routes.ts";
/** Café documentation remains raw. */
export function startService() { return true; }
`,
  "src/ignored/by-tsconfig.ts": "export function excluded() {}",
  "src/index.test.ts": "export function testOnly() {}",
  "tests/fixture.ts": "export function testFixture() {}",
  "tsconfig.json": `{
    // supported JSONC stays static
    "include": ["src/**/*.ts",],
    "exclude": ["src/ignored/**",],
  }`,
});

describe("built-in TypeScript and Bun scanner", () => {
  test("emits a stable, bounded architecture observation set with exact evidence", async () => {
    const first = await scan(representativeProject, Object.freeze({ include: ["src"] }), {
      pageSize: 2,
    });
    const second = await scan(representativeProject, Object.freeze({ include: ["src"] }), {
      pageSize: 3,
    });
    const crlfProject = Object.freeze(
      Object.fromEntries(
        Object.entries(representativeProject).map(([resource, content]) => [
          resource,
          sourceExtension(resource) ? content.replace(/\r?\n/g, "\r\n") : content,
        ]),
      ),
    );
    const crlf = await scan(crlfProject, Object.freeze({ include: ["src"] }));

    expect(first.result.ok).toBeTrue();
    expect(second.result.ok).toBeTrue();
    expect(crlf.result.ok).toBeTrue();
    expect(first.snapshot).toEqual(second.snapshot);
    expect(crlf.emittedKeys).toEqual(first.emittedKeys);
    expect(crlf.snapshot?.records.map((record) => record.key)).toEqual(
      first.snapshot?.records.map((record) => record.key),
    );
    expect(
      crlf.snapshot?.records.flatMap((record) =>
        record.provenance.map((provenance) => provenance.fingerprint),
      ),
    ).not.toEqual(
      first.snapshot?.records.flatMap((record) =>
        record.provenance.map((provenance) => provenance.fingerprint),
      ),
    );
    const snapshot = first.snapshot!;
    expect(snapshot.coverage).toEqual([
      {
        kinds: ["action", "component-candidate", "documentation", "relationship"],
        scope: "workspace",
        state: "complete",
      },
    ]);
    const candidates = snapshot.records
      .filter((record) => record.kind === "component-candidate")
      .map((record) => record.candidate);
    expect(candidates).toContainEqual({ name: "@fixture/service", type: "package" });
    expect(candidates).toContainEqual({ name: "api", type: "source-boundary" });
    expect(candidates).toContainEqual({ name: "domain", type: "source-boundary" });
    expect(candidates).toContainEqual({ name: "@acme/db", type: "external" });
    expect(candidates).not.toContainEqual(expect.objectContaining({ name: "generated" }));

    const actions = snapshot.records
      .filter((record) => record.kind === "action")
      .map((record) => record.name);
    expect(actions).toContain("startService");
    expect(actions).toContain("GET /café");
    expect(actions).not.toContain("hidden");
    expect(actions).not.toContain("testOnly");

    const relationships = snapshot.records.filter((record) => record.kind === "relationship");
    expect(relationships.filter((record) => record.relationshipType === "imports").length).toBe(3);
    expect(
      relationships.filter((record) => record.relationshipType === "source-boundary").length,
    ).toBe(3);

    const documentation = snapshot.records.filter((record) => record.kind === "documentation");
    expect(documentation.map((record) => record.content)).toContain(
      "Coordinates café requests as package documentation.",
    );
    expect(documentation.map((record) => record.content)).toContain(
      "/** Café documentation remains raw. */",
    );
    expect(
      snapshot.records
        .filter((record) => record.kind === "component-candidate")
        .some((record) => "summary" in record.candidate),
    ).toBeFalse();

    const route = snapshot.records.find(
      (record) => record.kind === "action" && record.name === "GET /café",
    );
    expect(route?.provenance[0]?.range).toBeDefined();
    const routeBytes = encoder.encode(representativeProject["src/api/routes.ts"]);
    const range = route!.provenance[0]!.range!;
    expect(
      new TextDecoder().decode(routeBytes.slice(range.startByte, range.endByteExclusive)),
    ).toBe('Bun.serve({ routes: { "/café": { GET: () => Response.json(model) } } })');
    expect(
      snapshot.records.every(
        (record) =>
          !/^ent_[0-9a-f]{32}$/.test(record.key) && !/^rel_[0-9a-f]{32}$/.test(record.key),
      ),
    ).toBeTrue();
    expect(JSON.stringify(snapshot)).not.toContain("intent");
    expect(first.fixture.read).not.toContain("generated/generated.ts");
    expect(first.fixture.read).not.toContain("ignored/hidden.ts");
    expect(first.fixture.read).not.toContain("src/ignored/by-tsconfig.ts");
    expect(first.fixture.read).not.toContain("node_modules/pkg/index.ts");
    expect(first.fixture.read).not.toContain("src/index.test.ts");
    expect(first.fixture.enumerated).not.toContain("generated");
    expect(first.fixture.enumerated).not.toContain("ignored");
    expect(first.fixture.enumerated).not.toContain("node_modules");
  });

  test("omits dynamic, shadowed, ambiguous claims and reports partial coverage", async () => {
    const result = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "ambiguous" }),
      "src/api.ts": "export function api() {}",
      "src/api/index.ts": "export function api() {}",
      "src/index.ts": `
const Bun = { serve() {} };
import("./dynamic.ts");
import "./api";
Bun.serve({ routes: { ["/" + name]: () => true } });
export function publicApi() {}
`,
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      result.snapshot?.records.some(
        (record) => record.kind === "action" && record.name?.includes("/"),
      ),
    ).toBeFalse();
    expect(
      result.snapshot?.records.some(
        (record) => record.kind === "relationship" && record.relationshipType === "imports",
      ),
    ).toBeFalse();
  });

  test("uses rootDir as a source root without widening a narrower include", async () => {
    const result = await scan({
      "code/private/hidden.ts": "export function hidden() {}",
      "code/public/index.ts": "export function visible() {}\n",
      "package.json": JSON.stringify({ exports: "./code/public/index.ts", name: "root-dir" }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: { rootDir: "code" },
        include: ["code/public/**/*.ts"],
      }),
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      result.snapshot?.records.some(
        (record) =>
          record.kind === "component-candidate" &&
          record.candidate.name === "public" &&
          record.candidate.type === "source-boundary",
      ),
    ).toBeTrue();
    expect(
      result.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "visible",
      ),
    ).toBeTrue();
    expect(result.fixture.read).not.toContain("code/private/hidden.ts");
  });

  test("discovers workspace packages and resolves literal workspace imports", async () => {
    for (const workspaces of [["packages/*"], { packages: ["packages/*"] }] as const) {
      const result = await scan({
        "package.json": JSON.stringify({ name: "@fixture/workspace", workspaces }),
        "packages/api/package.json": JSON.stringify({
          exports: "./src/index.ts",
          name: "@fixture/api",
        }),
        "packages/api/src/index.ts": `
import { model } from "@fixture/model";
export function api() { return model; }
`,
        "packages/model/package.json": JSON.stringify({
          exports: "./src/index.ts",
          name: "@fixture/model",
        }),
        "packages/model/src/index.ts": "export function model() { return true; }\n",
        "tools/stray/package.json": JSON.stringify({ name: "@fixture/stray" }),
      });

      expect(result.result.ok).toBeTrue();
      const candidates = result.snapshot?.records.filter(
        (record) => record.kind === "component-candidate",
      );
      expect(candidates?.map((record) => record.candidate.name)).toEqual(
        expect.arrayContaining([
          "@fixture/workspace",
          "@fixture/api",
          "@fixture/model",
          "@fixture/stray",
        ]),
      );
      const namesByKey = new Map(candidates?.map((record) => [record.key, record.candidate.name]));
      const workspaceMembers = result.snapshot?.records.filter(
        (record) =>
          record.kind === "relationship" && record.relationshipType === "workspace-member",
      );
      expect(
        workspaceMembers
          ?.map((record) =>
            record.kind === "relationship" ? namesByKey.get(record.to.key) : undefined,
          )
          .sort(),
      ).toEqual(["@fixture/api", "@fixture/model"]);
      const workspaceImport = result.snapshot?.records.find(
        (record) => record.kind === "relationship" && record.relationshipType === "imports",
      );
      expect(workspaceImport).toBeDefined();
      expect(
        result.snapshot?.records.some(
          (record) => record.kind === "component-candidate" && record.candidate.type === "external",
        ),
      ).toBeFalse();
    }
    const ambiguous = await scan({
      "package.json": JSON.stringify({
        name: "ambiguous-workspace",
        workspaces: ["packages/*", "packages/**"],
      }),
      "packages/member/package.json": JSON.stringify({ name: "member" }),
    });
    expect(ambiguous.result.ok).toBeTrue();
    expect(ambiguous.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      ambiguous.snapshot?.records.some(
        (record) =>
          record.kind === "relationship" && record.relationshipType === "workspace-member",
      ),
    ).toBeFalse();
  });

  test("maps a package-root Bun entry without guessing an extra directory", async () => {
    const result = await scan({
      "index.ts": `
Bun.serve({ routes: { "/health": () => new Response("ok") } });
export function start() {}
`,
      "package.json": JSON.stringify({
        exports: { default: "./index.ts", import: "./index.ts" },
        name: "bun-root",
      }),
    });

    expect(result.result.ok).toBeTrue();
    expect(
      result.snapshot?.records.some(
        (record) =>
          record.kind === "component-candidate" &&
          record.candidate.name === "source" &&
          record.candidate.type === "source-boundary",
      ),
    ).toBeTrue();
    expect(
      result.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "ROUTE /health",
      ),
    ).toBeTrue();
  });

  test("keeps public subpath identities distinct and observes type-only edges", async () => {
    const result = await scan({
      "package.json": JSON.stringify({
        exports: { "./a": "./src/a.ts", "./b": "./src/b.ts" },
        name: "exports",
      }),
      "src/a.ts": `
import type { Only } from "./types/index.ts";
const local = () => true;
export { local as namedLocal };
export default local;
export function shared() {}
`,
      "src/b.ts": `
export default (function () { return true; });
export function shared() {}
`,
      "src/types/index.ts": "export interface Only { value: string }\n",
    });

    expect(result.result.ok).toBeTrue();
    const actions = result.snapshot?.records.filter((record) => record.kind === "action") ?? [];
    expect(actions.filter((record) => record.name === "shared")).toHaveLength(2);
    expect(actions.filter((record) => record.name === "default")).toHaveLength(2);
    expect(actions.filter((record) => record.name === "namedLocal")).toHaveLength(1);
    expect(new Set(actions.map((record) => record.key)).size).toBe(actions.length);
    expect(
      actions.filter((record) => record.name === "shared").map((record) => record.description),
    ).toEqual(["Public export at ./a", "Public export at ./b"]);
    expect(
      result.snapshot?.records.some(
        (record) => record.kind === "relationship" && record.relationshipType === "imports",
      ),
    ).toBeTrue();
  });

  test("bounds cursors and marks unsupported root policy files partial", async () => {
    const stalled = await scan({}, {}, { stalledCursor: true });
    expect(stalled.result.ok).toBeFalse();
    if (!stalled.result.ok) {
      expect(stalled.result.diagnostics[0]?.code).toBe("typescript-scanner-resource-failed");
    }

    const oversized = await scan(
      {
        ".gitignore": "ignored/\n",
        "package.json": JSON.stringify({ exports: "./src/index.ts", name: "oversized" }),
        "src/index.ts": "export function api() {}\n",
        "tsconfig.json": "{}",
      },
      {},
      {
        reportedSizes: {
          ".gitignore": 2 * 1024 * 1024 + 1,
          "tsconfig.json": 2 * 1024 * 1024 + 1,
        },
      },
    );
    expect(oversized.result.ok).toBeTrue();
    expect(oversized.snapshot?.coverage[0]?.state).toBe("partial");
    expect(oversized.snapshot?.records).toEqual([]);
    expect(oversized.fixture.read).not.toContain(".gitignore");
    expect(oversized.fixture.read).not.toContain("tsconfig.json");

    const spacedIgnore = await scan({
      ".gitignore": " groma/\n",
      "groma/src/index.ts": "export function visible() {}\n",
      "package.json": JSON.stringify({ name: "generic-groma-directory" }),
    });
    expect(spacedIgnore.result.ok).toBeTrue();
    expect(spacedIgnore.snapshot?.coverage[0]?.state).toBe("partial");
    expect(spacedIgnore.snapshot?.records).toEqual([]);
    expect(spacedIgnore.fixture.enumerated).not.toContain("groma");
    expect(spacedIgnore.fixture.read).not.toContain("groma/src/index.ts");

    const reexportChain: Record<string, string> = {
      "package.json": JSON.stringify({ exports: "./src/0.ts", name: "deep-reexports" }),
    };
    for (let index = 0; index < 35; index += 1) {
      reexportChain[`src/${index}.ts`] =
        index === 34 ? "export function tooDeep() {}\n" : `export * from "./${index + 1}.ts";\n`;
    }
    const deepReexports = await scan(reexportChain);
    expect(deepReexports.result.ok).toBeTrue();
    expect(deepReexports.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      deepReexports.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "tooDeep",
      ),
    ).toBeFalse();
  });

  test("fails closed on unsafe policies and excludes configured output directories", async () => {
    const unsupportedIgnore = await scan({
      ".gitignore": "[ab].ts\n",
      "a.ts": "export function invented() {}\n",
      "package.json": JSON.stringify({ exports: "./a.ts", name: "unsafe-ignore" }),
    });
    expect(unsupportedIgnore.result.ok).toBeTrue();
    expect(unsupportedIgnore.snapshot?.coverage[0]?.state).toBe("partial");
    expect(unsupportedIgnore.snapshot?.records).toEqual([]);

    const malformedConfig = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "unsafe-config" }),
      "src/index.ts": "export function invented() {}\n",
      "tsconfig.json": JSON.stringify({ compilerOptions: { paths: "@bad/*" } }),
    });
    expect(malformedConfig.result.ok).toBeTrue();
    expect(malformedConfig.snapshot?.coverage[0]?.state).toBe("partial");
    expect(malformedConfig.snapshot?.records).toEqual([]);

    const outputDirectories = await scan({
      "artifacts/index.js": "export function staleBuild() {}\n",
      "declarations/index.d.ts": "export declare function staleType(): void;\n",
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "outputs" }),
      "src/index.ts": "export function live() {}\n",
      "tsconfig.json": JSON.stringify({
        compilerOptions: { declarationDir: "declarations", outDir: "artifacts" },
      }),
    });
    expect(outputDirectories.result.ok).toBeTrue();
    expect(outputDirectories.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      outputDirectories.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "live",
      ),
    ).toBeTrue();
    expect(outputDirectories.fixture.enumerated).not.toContain("artifacts");
    expect(outputDirectories.fixture.enumerated).not.toContain("declarations");
    expect(outputDirectories.fixture.read).not.toContain("artifacts/index.js");
    expect(outputDirectories.fixture.read).not.toContain("declarations/index.d.ts");

    const nestedPolicy = await scan({
      "package.json": JSON.stringify({ exports: "./src/live/index.ts", name: "nested-policy" }),
      "src/hidden/index.ts": "export function leaked() {}\n",
      "src/hidden/tsconfig.json": "{}",
      "src/live/index.ts": "export function visible() {}\n",
    });
    expect(nestedPolicy.result.ok).toBeTrue();
    expect(nestedPolicy.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      nestedPolicy.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "visible",
      ),
    ).toBeTrue();
    expect(JSON.stringify(nestedPolicy.snapshot)).not.toContain("leaked");
    expect(nestedPolicy.fixture.read).not.toContain("src/hidden/index.ts");
    expect(nestedPolicy.fixture.read).not.toContain("src/hidden/tsconfig.json");
  });

  test("resolves only bounded aliases and package imports while preserving externals", async () => {
    const result = await scan({
      "package.json": JSON.stringify({
        exports: "./src/api/index.ts",
        imports: { "#domain/*": "./src/domain/*" },
        name: "aliases",
      }),
      "src/api/index.ts": [
        'import { model } from "@domain/model";',
        'import { model as baseModel } from "src/domain/model";',
        'import { model as packageModel } from "#domain/model";',
        'import missing from "@missing/value";',
        'import ambiguous from "@ambiguous/value";',
        'import external from "left-pad";',
        "void model; void baseModel; void packageModel; void missing; void ambiguous; void external;",
        "export function api() {}",
      ].join("\n"),
      "src/domain/model.ts": "export const model = true;\n",
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@ambiguous/*": ["src/domain/*", "src/other/*"],
            "@domain/*": ["src/domain/*"],
            "@missing/*": ["src/missing/*"],
          },
        },
      }),
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("partial");
    const candidates = result.snapshot?.records.filter(
      (record) => record.kind === "component-candidate",
    );
    expect(candidates).toContainEqual(
      expect.objectContaining({ candidate: { name: "left-pad", type: "external" } }),
    );
    expect(
      candidates?.some(
        (record) =>
          record.candidate.type === "external" &&
          ["@domain/model", "@missing/value", "@ambiguous/value", "#domain/model"].includes(
            record.candidate.name ?? "",
          ),
      ),
    ).toBeFalse();
    const imports = result.snapshot?.records.filter(
      (record) => record.kind === "relationship" && record.relationshipType === "imports",
    );
    expect(imports).toHaveLength(2);
    expect(imports?.some((record) => record.provenance.length === 3)).toBeTrue();
  });

  test("captures static TypeScript type dependencies without turning types into actions", async () => {
    const result = await scan({
      "package.json": JSON.stringify({ exports: "./src/api/index.ts", name: "type-evidence" }),
      "src/api/index.ts": [
        'import type { A } from "../domain/a.ts";',
        'export type { B } from "../domain/b.ts";',
        'type C = import("../domain/c.ts").C;',
        'import D = require("../domain/d.ts");',
        "void (null as A | C | D);",
        "export function api() {}",
      ].join("\n"),
      "src/domain/a.ts": "export interface A { a: true }\n",
      "src/domain/b.ts": "export interface B { b: true }\n",
      "src/domain/c.ts": "export interface C { c: true }\n",
      "src/domain/d.ts": "export interface D { d: true }\n",
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("complete");
    const imports = result.snapshot?.records.filter(
      (record) => record.kind === "relationship" && record.relationshipType === "imports",
    );
    expect(imports).toHaveLength(1);
    expect(imports?.[0]?.provenance).toHaveLength(4);
    expect(
      result.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name),
    ).toEqual(["api"]);
  });

  test("emits complete public proof chains and rejects ambiguous star exports", async () => {
    const proven = await scan({
      "package.json": JSON.stringify({
        exports: { "./plugin-sdk": "./src/index.ts" },
        name: "proofs",
      }),
      "src/impl.ts": "/** Public API. */\nexport function api() { return true; }\n",
      "src/index.ts": 'export { api } from "./impl.ts";\n',
    });
    expect(proven.result.ok).toBeTrue();
    const action = proven.snapshot?.records.find(
      (record) => record.kind === "action" && record.name === "api",
    );
    expect(action?.kind === "action" ? action.description : undefined).toBe(
      "Public export at ./plugin-sdk",
    );
    expect(action?.provenance.map((item) => item.resource)).toEqual(
      expect.arrayContaining(["package.json", "src/index.ts", "src/impl.ts"]),
    );
    const declaration = action?.provenance.find(
      (item) => item.resource === "src/impl.ts" && item.range !== undefined,
    );
    expect(declaration?.range).toBeDefined();
    expect(
      new TextDecoder().decode(
        encoder
          .encode("/** Public API. */\nexport function api() { return true; }\n")
          .slice(declaration!.range!.startByte, declaration!.range!.endByteExclusive),
      ),
    ).toContain("function api");

    const ambiguous = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "ambiguous-stars" }),
      "src/a.ts": "export function shared() { return 'a'; }\n",
      "src/b.ts": "export function shared() { return 'b'; }\n",
      "src/index.ts": 'export * from "./a.ts";\nexport * from "./b.ts";\n',
    });
    expect(ambiguous.result.ok).toBeTrue();
    expect(ambiguous.snapshot?.coverage[0]?.state).toBe("partial");
    expect(ambiguous.snapshot?.records.some((record) => record.kind === "action")).toBeFalse();
  });

  test("does not treat an unlisted nested package collision as a workspace dependency", async () => {
    const result = await scan({
      "package.json": JSON.stringify({ name: "@fixture/root", workspaces: ["packages/*"] }),
      "packages/api/package.json": JSON.stringify({
        exports: "./src/index.ts",
        name: "@fixture/api",
      }),
      "packages/api/src/index.ts": [
        'import stray from "@fixture/stray";',
        "void stray;",
        "export function api() {}",
      ].join("\n"),
      "tools/stray/package.json": JSON.stringify({ name: "@fixture/stray" }),
    });

    expect(result.result.ok).toBeTrue();
    const candidates = result.snapshot?.records.filter(
      (record) => record.kind === "component-candidate",
    );
    const external = candidates?.find(
      (record) =>
        record.candidate.name === "@fixture/stray" && record.candidate.type === "external",
    );
    const discovered = candidates?.find(
      (record) => record.candidate.name === "@fixture/stray" && record.candidate.type === "package",
    );
    expect(external).toBeDefined();
    expect(discovered).toBeDefined();
    expect(
      result.snapshot?.records.some(
        (record) =>
          record.kind === "relationship" &&
          record.relationshipType === "imports" &&
          record.to.key === external?.key,
      ),
    ).toBeTrue();
  });

  test("keeps exports encapsulated and preserves independently safe legacy entries", async () => {
    const encapsulated = await scan({
      "package.json": JSON.stringify({
        exports: "./src/public.ts",
        main: "src/private.ts",
        name: "encapsulated",
      }),
      "src/private.ts": "export function privateApi() {}\n",
      "src/public.ts": "export function publicApi() {}\n",
    });
    expect(encapsulated.result.ok).toBeTrue();
    expect(
      encapsulated.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name),
    ).toEqual(["publicApi"]);

    for (const main of ["./src/index.ts", "src/index.ts"]) {
      const legacy = await scan({
        "package.json": JSON.stringify({ main, name: "legacy" }),
        "src/index.ts": "export function legacyApi() {}\n",
      });
      expect(legacy.result.ok).toBeTrue();
      expect(legacy.snapshot?.coverage[0]?.state).toBe("complete");
      expect(
        legacy.snapshot?.records.some(
          (record) => record.kind === "action" && record.name === "legacyApi",
        ),
      ).toBeTrue();
    }

    const multipleLegacy = await scan({
      "package.json": JSON.stringify({
        main: "src/main.ts",
        module: "src/module.ts",
        name: "ambiguous-legacy",
      }),
      "src/main.ts": "export function mainApi() {}\n",
      "src/module.ts": "export function moduleApi() {}\n",
    });
    expect(multipleLegacy.result.ok).toBeTrue();
    expect(multipleLegacy.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      multipleLegacy.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name),
    ).toEqual(["mainApi", "moduleApi"]);
    expect(
      new Set(
        multipleLegacy.snapshot?.records
          .filter((record) => record.kind === "action")
          .map((record) => record.key),
      ).size,
    ).toBe(2);

    const partiallyResolvedLegacy = await scan({
      "package.json": JSON.stringify({
        main: "src/main.ts",
        module: "src/missing.ts",
        name: "partially-resolved-legacy",
      }),
      "src/main.ts": "export function mainApi() {}\n",
    });
    expect(partiallyResolvedLegacy.result.ok).toBeTrue();
    expect(partiallyResolvedLegacy.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      partiallyResolvedLegacy.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name),
    ).toEqual(["mainApi"]);

    const duplicateLegacy = await scan({
      "package.json": JSON.stringify({
        main: "src/index.ts",
        module: "./src/index.ts",
        name: "duplicate-legacy",
      }),
      "src/index.ts": "export function sharedApi() {}\n",
    });
    expect(duplicateLegacy.result.ok).toBeTrue();
    expect(duplicateLegacy.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      duplicateLegacy.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name),
    ).toEqual(["sharedApi"]);

    const ambiguousTarget = await scan({
      "package.json": JSON.stringify({ main: "src/entry", name: "ambiguous-target" }),
      "src/entry.ts": "export function fileEntry() {}\n",
      "src/entry/index.ts": "export function directoryEntry() {}\n",
    });
    expect(ambiguousTarget.result.ok).toBeTrue();
    expect(ambiguousTarget.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      ambiguousTarget.snapshot?.records.some((record) => record.kind === "action"),
    ).toBeFalse();

    for (const main of ["../src/index.ts", "/src/index.ts", "C:/src/index.ts"]) {
      const unsafe = await scan({
        "package.json": JSON.stringify({ main, name: "unsafe-legacy" }),
        "src/index.ts": "export function unsafeApi() {}\n",
      });
      expect(unsafe.result.ok).toBeTrue();
      expect(unsafe.snapshot?.coverage[0]?.state).toBe("partial");
      expect(unsafe.snapshot?.records.some((record) => record.kind === "action")).toBeFalse();
    }
  });

  test("never reinterprets an external package-import target as a local file", async () => {
    const result = await scan({
      "left-pad.ts": "export function collision() {}\n",
      "package.json": JSON.stringify({
        exports: "./src/api/index.ts",
        imports: { "#pad": "left-pad" },
        name: "package-import-external",
      }),
      "src/api/index.ts": ['import pad from "#pad";', "void pad;", "export function api() {}"].join(
        "\n",
      ),
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      result.snapshot?.records.some(
        (record) => record.kind === "relationship" && record.relationshipType === "imports",
      ),
    ).toBeFalse();
    expect(
      result.snapshot?.records.some(
        (record) => record.kind === "component-candidate" && record.candidate.name === "left-pad",
      ),
    ).toBeFalse();
  });

  test("omits malformed public names, subpaths, and oversized Bun route actions", async () => {
    for (const publicSubpath of [
      "../private",
      "./bad\u0001name",
      "./" + "x".repeat(255),
      "./nested/../private",
    ]) {
      const malformed = await scan({
        "package.json": JSON.stringify({
          exports: { [publicSubpath]: "./src/index.ts" },
          name: "malformed-subpath",
        }),
        "src/index.ts": "export function api() {}\n",
      });
      expect(malformed.result.ok).toBeTrue();
      expect(malformed.snapshot?.coverage[0]?.state).toBe("partial");
      expect(malformed.snapshot?.records.some((record) => record.kind === "action")).toBeFalse();
    }

    const oversizedName = "a".repeat(257);
    const longRoute = "/" + "r".repeat(247);
    const malformedActions = await scan({
      "package.json": JSON.stringify({
        exports: "./src/index.ts",
        name: "malformed-actions",
      }),
      "src/index.ts": [
        "function api() {}",
        'export { api as "\\u0001bad" };',
        "export function " + oversizedName + "() {}",
        'Bun.serve({ routes: { "' +
          longRoute +
          '": { VERYLONGMETHOD: () => new Response("ok") } } });',
      ].join("\n"),
    });
    expect(malformedActions.result.ok).toBeTrue();
    expect(malformedActions.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      malformedActions.snapshot?.records.some((record) => record.kind === "action"),
    ).toBeFalse();
  });

  test("accepts only supported external and runtime module specifiers", async () => {
    const oversized = "p".repeat(513);
    const result = await scan({
      "package.json": JSON.stringify({ exports: "./src/api/index.ts", name: "external-grammar" }),
      "src/api/index.ts": [
        'import scoped from "@scope/pkg/subpath";',
        'import plain from "plain/subpath";',
        'import lodashInternal from "lodash/_baseClone";',
        'import packageFeature from "pkg/-feature";',
        'import runtime from "node:fs/promises";',
        'import malformedScope from "@/foo";',
        'import url from "https://host/x";',
        'import empty from "foo//bar";',
        'import traversal from "foo/../bar";',
        'import control from "bad\\u0001name";',
        'import tooLong from "' + oversized + '";',
        "void scoped; void plain; void lodashInternal; void packageFeature; void runtime;",
        "void malformedScope; void url;",
        "void empty; void traversal; void control; void tooLong;",
        "export function api() {}",
      ].join("\n"),
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("partial");
    const externals =
      result.snapshot?.records
        .flatMap((record) =>
          record.kind === "component-candidate" && record.candidate.type === "external"
            ? [record.candidate.name]
            : [],
        )
        .sort() ?? [];
    expect(externals).toEqual(["@scope/pkg", "lodash", "node:fs", "pkg", "plain"]);
  });

  test("fails stably before an oversized extraction can accumulate records", async () => {
    const declarations = Array.from(
      { length: 4_100 },
      (_, index) => "export function action" + String(index).padStart(4, "0") + "() {}\n",
    ).join("");
    const project = {
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "record-budget" }),
      "src/index.ts": declarations,
    };
    const first = await scan(project);
    const second = await scan(project);

    for (const result of [first, second]) {
      expect(result.result.ok).toBeFalse();
      if (!result.result.ok)
        expect(result.result.diagnostics[0]?.code).toBe("typescript-scanner-budget-exceeded");
      expect(result.emittedKeys).toEqual([]);
      expect(result.session.inspect().state).toBe("failed");
    }
  });

  test("fails cleanly for cancellation, provider failure, and rejected sinks", async () => {
    const descriptor = begin();
    const cancelledSession = valueOf(createObservationSession(descriptor));
    const empty = resourceFixture({});
    const cancelled = await typescriptBunScanner.scan(
      Object.freeze({
        apiVersion: scannerApiVersion,
        cancellation: Object.freeze({ isCancellationRequested: () => true }),
        configuration: Object.freeze({}),
        observations: sink(cancelledSession),
        resources: empty.resources,
        session: descriptor,
      }),
    );
    expect(cancelled).toMatchObject({
      diagnostics: [{ code: "typescript-scanner-cancelled" }],
      ok: false,
    });
    expect(cancelledSession.inspect()).toMatchObject({
      failure: { code: "typescript-scanner-cancelled" },
      state: "failed",
    });

    const providerFailure = await scan({}, {}, { failEnumeration: true });
    expect(providerFailure.result.ok).toBeFalse();
    if (!providerFailure.result.ok) {
      expect(providerFailure.result.diagnostics[0]?.code).toBe(
        "typescript-scanner-resource-failed",
      );
    }
    expect(providerFailure.session.inspect().state).toBe("failed");

    let failed = false;
    const rejection = await typescriptBunScanner.scan(
      Object.freeze({
        apiVersion: scannerApiVersion,
        cancellation: Object.freeze({ isCancellationRequested: () => false }),
        configuration: Object.freeze({}),
        observations: Object.freeze({
          complete: () => ({ ok: true as const, value: undefined }),
          fail: () => {
            failed = true;
            return { ok: true as const, value: undefined };
          },
          heartbeat: () => ({ ok: true as const, value: undefined }),
          submitBatch: () => ({
            diagnostics: [{ code: "fixture-sink-rejected", message: "rejected" }],
            ok: false as const,
          }),
        }),
        resources: resourceFixture({
          "package.json": JSON.stringify({ name: "sink", exports: "./src/index.ts" }),
          "src/index.ts": "export function api() {}",
        }).resources,
        session: descriptor,
      }),
    );
    expect(rejection.ok).toBeFalse();
    expect(failed).toBeTrue();
  });

  test("exports a frozen requirement-free official scanner registration", () => {
    expect(Object.isFrozen(typescriptBunScanner)).toBeTrue();
    expect(typescriptBunScannerRegistration.manifest).toEqual({
      apiVersion: "groma.plugin/v1",
      id: "official.typescript",
      phase: 1,
      provides: [{ cardinality: "multiple", id: "groma.scanners/v1", version: "1.0.0" }],
      requires: [],
      version: "1.0.0",
    });
  });
});
