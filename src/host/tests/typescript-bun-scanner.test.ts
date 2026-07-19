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

function begin(resourceRoot = "."): ObservationSessionBegin {
  return Object.freeze({
    apiVersion: observationSessionApiVersion,
    epoch: "epoch.fixture",
    projectId: "project.fixture",
    scopes: Object.freeze([Object.freeze({ id: "workspace", resourceRoot })]),
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
    readonly rawBytes?: Readonly<Record<string, Uint8Array>>;
    readonly reportedSizes?: Readonly<Record<string, number>>;
    readonly resourceRoot?: string;
    readonly stalledCursor?: boolean;
  }> = {},
): ResourceFixture {
  const files = new Map(
    Object.entries(source).map(
      ([resource, content]) =>
        [resource, options.rawBytes?.[resource] ?? encoder.encode(content)] as const,
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
    readonly rawBytes?: Readonly<Record<string, Uint8Array>>;
    readonly reportedSizes?: Readonly<Record<string, number>>;
    readonly resourceRoot?: string;
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
  const descriptor = begin(resourceOptions.resourceRoot);
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

  test("resolves each Bun serve call against its bounded lexical scope", async () => {
    const unrelatedShadow = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "bun-call-scope" }),
      "src/index.ts": [
        'Bun.serve({ routes: { "/top": () => new Response("ok") } });',
        "function unrelated(Bun: unknown) { return Bun; }",
        "void unrelated;",
        "export function publicApi() {}",
      ].join("\n"),
    });
    expect(unrelatedShadow.result.ok).toBeTrue();
    expect(unrelatedShadow.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      unrelatedShadow.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name)
        .sort(),
    ).toEqual(["ROUTE /top", "publicApi"]);

    const replacedServe = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "bun-replaced" }),
      "src/index.ts": [
        "Bun.serve = (() => undefined) as typeof Bun.serve;",
        'Bun.serve({ routes: { "/unsafe": () => new Response("ok") } });',
        "export function publicApi() {}",
      ].join("\n"),
    });
    expect(replacedServe.result.ok).toBeTrue();
    expect(replacedServe.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      replacedServe.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name),
    ).toEqual(["publicApi"]);

    const shadowedFixtures = [
      {
        name: "parameter",
        source: [
          "function local(Bun: { serve(value: unknown): void }) {",
          '  Bun.serve({ routes: { "/parameter": () => true } });',
          "}",
          "void local;",
        ].join("\n"),
      },
      {
        name: "block",
        source: [
          "{",
          "  const Bun = { serve(value: unknown) { return value; } };",
          '  Bun.serve({ routes: { "/block": () => true } });',
          "}",
        ].join("\n"),
      },
      {
        extra: { "src/shim.ts": "export default { serve(value: unknown) { return value; } };\n" },
        name: "import",
        source: [
          'import Bun from "./shim.ts";',
          'Bun.serve({ routes: { "/import": () => true } });',
        ].join("\n"),
      },
      {
        name: "hoisted-var",
        source: [
          "function local() {",
          '  Bun.serve({ routes: { "/var": () => true } });',
          "  var Bun = { serve(value: unknown) { return value; } };",
          "}",
          "void local;",
        ].join("\n"),
      },
      {
        name: "inherited",
        source: [
          "function outer(Bun: { serve(value: unknown): void }) {",
          "  function inner() {",
          '    Bun.serve({ routes: { "/inherited": () => true } });',
          "  }",
          "  return inner;",
          "}",
          "void outer;",
        ].join("\n"),
      },
    ] as const;

    for (const fixture of shadowedFixtures) {
      const shadowed = await scan({
        ...("extra" in fixture ? fixture.extra : {}),
        "package.json": JSON.stringify({
          exports: "./src/index.ts",
          name: `bun-shadowed-${fixture.name}`,
        }),
        "src/index.ts": `${fixture.source}\nexport function publicApi() {}\n`,
      });
      expect(shadowed.result.ok).toBeTrue();
      expect(shadowed.snapshot?.coverage[0]?.state).toBe("partial");
      expect(
        shadowed.snapshot?.records.some(
          (record) => record.kind === "action" && record.name?.startsWith("ROUTE "),
        ),
      ).toBeFalse();
      expect(
        shadowed.snapshot?.records.some(
          (record) => record.kind === "action" && record.name === "publicApi",
        ),
      ).toBeTrue();
    }
  });

  test("separates static Bun routes from unrelated sibling uncertainty", async () => {
    const ordinary = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "bun-port" }),
      "src/index.ts": [
        'Bun.serve({ port: 3000, routes: { "/health": () => true } });',
        "export function api() {}",
      ].join("\n"),
    });
    expect(ordinary.result.ok).toBeTrue();
    expect(ordinary.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      ordinary.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "ROUTE /health",
      ),
    ).toBeTrue();

    for (const sibling of [
      'fetch: () => new Response("ok")',
      'error: () => new Response("error")',
      "websocket: {}",
      'fetch() { return new Response("ok"); }',
      'error() { return new Response("error"); }',
      "websocket() {}",
      "port: 3000, port: 4000",
      '["port"]: 3000',
      '["fetch"]() {}',
    ]) {
      const retained = await scan({
        "package.json": JSON.stringify({ exports: "./src/index.ts", name: "bun-sibling" }),
        "src/index.ts": `Bun.serve({ routes: { "/health": () => true }, ${sibling} });\nexport function api() {}\n`,
      });
      expect(retained.result.ok).toBeTrue();
      expect(retained.snapshot?.coverage[0]?.state).toBe("partial");
      expect(
        retained.snapshot?.records.some(
          (record) => record.kind === "action" && record.name === "ROUTE /health",
        ),
      ).toBeTrue();
    }

    for (const configuration of [
      '{ routes: { "/health": () => true }, routes: { "/other": () => true } }',
      '{ routes: { "/health": () => true }, [key]: () => true }',
      '{ routes: { "/health": () => true }, ...extra }',
      "{ routes() {} }",
      '{ routes: { "/health": () => true }, routes() {} }',
    ]) {
      const rejected = await scan({
        "package.json": JSON.stringify({ exports: "./src/index.ts", name: "bun-rejected" }),
        "src/index.ts": `const extra = {};\nconst key = "fetch";\nBun.serve(${configuration});\nexport function api() {}\n`,
      });
      expect(rejected.result.ok).toBeTrue();
      expect(rejected.snapshot?.coverage[0]?.state).toBe("partial");
      expect(
        rejected.snapshot?.records.some(
          (record) => record.kind === "action" && record.name?.includes("/health"),
        ),
      ).toBeFalse();
      expect(
        rejected.snapshot?.records.some(
          (record) => record.kind === "action" && record.name === "api",
        ),
      ).toBeTrue();
    }
  });

  test("uses rootDir as a source root without widening a narrower include", async () => {
    const result = await scan({
      "code/private/hidden.ts": "export function hidden() {}",
      "code/public/index.ts": "export function visible() {}\n",
      "package.json": JSON.stringify({ exports: "./code/public/index.ts", name: "root-dir" }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: { rootDir: "./code" },
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

  test("keeps source-only scopes unowned and strictly inside their resource root", async () => {
    const result = await scan(
      {
        "README.md": "# parent metadata\n",
        "package.json": JSON.stringify({
          name: "out-of-scope-parent",
          workspaces: ["packages/*"],
        }),
        "packages/member/package.json": JSON.stringify({ name: "@fixture/member" }),
        "packages/member/src/index.ts": "export const member = true;\n",
        "src/api/index.ts": [
          'import { model } from "../domain/model.ts";',
          'import { model as aliasedModel } from "@local/model";',
          'import member from "@fixture/member";',
          'import ancestorAlias from "domain";',
          'import fs from "node:fs";',
          'import sqlite from "bun:sqlite";',
          'Bun.serve({ routes: { "/health": () => new Response(String(model)) } });',
          "void aliasedModel; void member; void ancestorAlias; void fs; void sqlite;",
        ].join("\n"),
        "src/domain/model.ts": "export const model = true;\n",
        "src/tsconfig.json": JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@local/model": ["domain/model.ts"] },
          },
        }),
        "tsconfig.json": JSON.stringify({
          compilerOptions: { baseUrl: ".", paths: { domain: ["src/domain/model.ts"] } },
        }),
      },
      {},
      { resourceRoot: "src" },
    );

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("partial");
    expect(result.fixture.enumerated).not.toContain(".");
    expect(result.fixture.read).not.toContain("package.json");
    expect(result.fixture.read).not.toContain("README.md");
    expect(result.fixture.read).not.toContain("tsconfig.json");
    expect(
      result.snapshot?.records.every((record) =>
        record.provenance.every(
          (provenance) => provenance.resource === "src" || provenance.resource.startsWith("src/"),
        ),
      ),
    ).toBeTrue();
    expect(
      result.snapshot?.records
        .filter((record) => record.kind === "component-candidate")
        .map((record) => record.candidate),
    ).toEqual(
      expect.arrayContaining([
        { name: "api", type: "source-boundary" },
        { name: "bun:sqlite", type: "external" },
        { name: "domain", type: "source-boundary" },
        { name: "node:domain", type: "external" },
        { name: "node:fs", type: "external" },
      ]),
    );
    expect(
      result.snapshot?.records.some(
        (record) => record.kind === "relationship" && record.relationshipType === "source-boundary",
      ),
    ).toBeFalse();
    const imports =
      result.snapshot?.records.filter(
        (record) => record.kind === "relationship" && record.relationshipType === "imports",
      ) ?? [];
    expect(imports).toHaveLength(4);
    expect(imports.some((record) => record.provenance.length === 2)).toBeTrue();
    expect(
      result.snapshot?.records
        .flatMap((record) =>
          record.kind === "component-candidate" && record.candidate.type === "external"
            ? [record.candidate.name]
            : [],
        )
        .sort(),
    ).toEqual(["bun:sqlite", "node:domain", "node:fs"]);
    expect(
      result.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "ROUTE /health",
      ),
    ).toBeTrue();
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

    const rootImport = await scan({
      "package.json": JSON.stringify({
        exports: "./src/index.ts",
        name: "@fixture/root",
        workspaces: ["packages/*"],
      }),
      "packages/member/package.json": JSON.stringify({
        exports: "./src/index.ts",
        name: "@fixture/member",
      }),
      "packages/member/src/index.ts":
        'import { rootApi } from "@fixture/root";\nexport function memberApi() { return rootApi(); }\n',
      "src/index.ts": "export function rootApi() { return true; }\n",
    });
    expect(rootImport.result.ok).toBeTrue();
    expect(rootImport.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      rootImport.snapshot?.records.some(
        (record) =>
          record.kind === "component-candidate" &&
          record.candidate.type === "external" &&
          record.candidate.name === "@fixture/root",
      ),
    ).toBeFalse();
    expect(
      rootImport.snapshot?.records.some(
        (record) => record.kind === "relationship" && record.relationshipType === "imports",
      ),
    ).toBeTrue();
  });

  test("requires every workspace package import to name an exported subpath", async () => {
    const workspaceFiles = {
      "package.json": JSON.stringify({ name: "@fixture/root", workspaces: ["packages/*"] }),
      "packages/api/package.json": JSON.stringify({
        exports: "./src/index.ts",
        name: "@fixture/api",
      }),
      "packages/member/package.json": JSON.stringify({
        exports: {
          ".": "./src/index.ts",
          "./public": "./src/public.ts",
        },
        name: "@fixture/member",
      }),
      "packages/member/src/index.ts": "export const rootValue = true;\n",
      "packages/member/src/private.ts": "export const privateValue = true;\n",
      "packages/member/src/public.ts": "export const publicValue = true;\n",
    } as const;
    const exported = await scan({
      ...workspaceFiles,
      "packages/api/src/index.ts": [
        'import { rootValue } from "@fixture/member";',
        'import { publicValue } from "@fixture/member/public";',
        "void rootValue; void publicValue;",
        "export function api() {}",
      ].join("\n"),
    });
    expect(exported.result.ok).toBeTrue();
    expect(exported.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      exported.snapshot?.records.some(
        (record) => record.kind === "relationship" && record.relationshipType === "imports",
      ),
    ).toBeTrue();
    expect(
      exported.snapshot?.records.some(
        (record) => record.kind === "component-candidate" && record.candidate.type === "external",
      ),
    ).toBeFalse();

    const unexported = await scan({
      ...workspaceFiles,
      "packages/api/src/index.ts": [
        'import { privateValue } from "@fixture/member/private";',
        "void privateValue;",
        "export function api() {}",
      ].join("\n"),
    });
    expect(unexported.result.ok).toBeTrue();
    expect(unexported.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      unexported.snapshot?.records.some(
        (record) => record.kind === "relationship" && record.relationshipType === "imports",
      ),
    ).toBeFalse();
    expect(
      unexported.snapshot?.records.some(
        (record) =>
          record.kind === "component-candidate" &&
          record.candidate.type === "external" &&
          record.candidate.name === "@fixture/member",
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

  test("coalesces equivalent export conditions and isolates ambiguous subpaths", async () => {
    const result = await scan({
      "package.json": JSON.stringify({
        exports: {
          ".": { default: "./src/default.ts", import: "./src/import.ts" },
          "./absent": null,
          "./array": ["./src/array.ts"],
          "./mixed": { default: null, import: "./src/mixed.ts" },
          "./safe": { default: "./src/safe.ts", import: "./src/safe.ts" },
        },
        name: "conditional-exports",
      }),
      "src/array.ts": "export function arrayApi() {}\n",
      "src/default.ts": "export function defaultApi() {}\n",
      "src/import.ts": "export function importApi() {}\n",
      "src/mixed.ts": "export function mixedApi() {}\n",
      "src/safe.ts": "export function safeApi() {}\n",
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      result.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name),
    ).toEqual(["safeApi"]);

    const pureNull = await scan({
      "package.json": JSON.stringify({
        exports: { ".": null, "./also-absent": { default: null, import: null } },
        name: "null-exports",
      }),
      "src/private.ts": "export function privateApi() {}\n",
    });
    expect(pureNull.result.ok).toBeTrue();
    expect(pureNull.snapshot?.coverage[0]?.state).toBe("complete");
    expect(pureNull.snapshot?.records.some((record) => record.kind === "action")).toBeFalse();

    const conditionalImport = await scan({
      "package.json": JSON.stringify({
        exports: "./src/index.ts",
        imports: { "#model": { default: "./src/model.ts", import: null } },
        name: "conditional-import",
      }),
      "src/index.ts": 'import model from "#model";\nvoid model;\nexport function api() {}\n',
      "src/model.ts": "export default {};\n",
    });
    expect(conditionalImport.result.ok).toBeTrue();
    expect(conditionalImport.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      conditionalImport.snapshot?.records.some(
        (record) => record.kind === "relationship" && record.relationshipType === "imports",
      ),
    ).toBeFalse();

    const duplicateMetadata = await scan({
      "package.json": '{"name":"first","name":"second","exports":"./src/index.ts"}',
      "src/index.ts": "export function api() {}\n",
    });
    expect(duplicateMetadata.result.ok).toBeTrue();
    expect(duplicateMetadata.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      duplicateMetadata.snapshot?.records.some((record) => record.kind === "action"),
    ).toBeFalse();
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

    const invalidPolicyText = await scan(
      {
        "package.json": JSON.stringify({ exports: "./src/index.ts", name: "invalid-policy" }),
        "src/index.ts": "export function api() {}\n",
        "tsconfig.json": "",
      },
      {},
      { rawBytes: { "tsconfig.json": new Uint8Array([0xff]) } },
    );
    expect(invalidPolicyText.result.ok).toBeTrue();
    expect(invalidPolicyText.snapshot?.coverage[0]?.state).toBe("partial");
    expect(invalidPolicyText.snapshot?.records).toEqual([]);

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

  test("applies ordered root ignore negation and bounded character classes", async () => {
    const result = await scan({
      ".gitignore": [
        "src/*.ts",
        "!src/index.ts",
        "internal/private-[0-9].ts",
        "private/**/secret.ts",
        "*.local.*",
        "",
      ].join("\n"),
      "internal/private-1.ts": "export function excludedByClass() {}\n",
      "internal/private-a.ts": "export function retainedSibling() {}\n",
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "ordered-ignore" }),
      "private/deep/secret.ts": "export function excludedByRecursiveGlob() {}\n",
      "private/deep/visible.ts": "export function retainedRecursiveSibling() {}\n",
      "src/hidden.ts": "export function excludedBeforeNegation() {}\n",
      "src/index.ts": "export function publicApi() {}\n",
      "settings.local.ts": "export function excludedByTwoWildcards() {}\n",
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      result.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "publicApi",
      ),
    ).toBeTrue();
    expect(result.fixture.read).toContain("src/index.ts");
    expect(result.fixture.read).toContain("internal/private-a.ts");
    expect(result.fixture.read).toContain("private/deep/visible.ts");
    expect(result.fixture.read).not.toContain("src/hidden.ts");
    expect(result.fixture.read).not.toContain("internal/private-1.ts");
    expect(result.fixture.read).not.toContain("private/deep/secret.ts");
    expect(result.fixture.read).not.toContain("settings.local.ts");
  });

  test("fails closed on unsafe policies and excludes configured output directories", async () => {
    const unsupportedIgnore = await scan({
      ".gitignore": "a?.ts\n",
      "a.ts": "export function invented() {}\n",
      "package.json": JSON.stringify({ exports: "./a.ts", name: "unsafe-ignore" }),
    });
    expect(unsupportedIgnore.result.ok).toBeTrue();
    expect(unsupportedIgnore.snapshot?.coverage[0]?.state).toBe("partial");
    expect(unsupportedIgnore.snapshot?.records).toEqual([]);

    const ambiguousWildcards = await scan({
      ".gitignore": `${"*a".repeat(20)}b\n`,
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "unsafe-wildcards" }),
      "src/index.ts": "export function invented() {}\n",
    });
    expect(ambiguousWildcards.result.ok).toBeTrue();
    expect(ambiguousWildcards.snapshot?.coverage[0]?.state).toBe("partial");
    expect(ambiguousWildcards.snapshot?.records).toEqual([]);

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
        compilerOptions: { declarationDir: "./declarations", outDir: "./artifacts" },
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
          baseUrl: "./",
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
        'import type { T } from "../domain/types";',
        "void (null as A | C | D | T);",
        "export function api() {}",
      ].join("\n"),
      "src/domain/a.ts": "export interface A { a: true }\n",
      "src/domain/b.ts": "export interface B { b: true }\n",
      "src/domain/c.ts": "export interface C { c: true }\n",
      "src/domain/d.ts": "export interface D { d: true }\n",
      "src/domain/types.d.ts": "export interface T { t: true }\n",
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("partial");
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
      "src/a.ts": "export function aOnly() {}\nexport function shared() { return 'a'; }\n",
      "src/b.ts": "export function bOnly() {}\nexport function shared() { return 'b'; }\n",
      "src/c.ts": "export function explicitApi() {}\n",
      "src/index.ts":
        'export function directApi() {}\nexport { explicitApi } from "./c.ts";\nexport * from "./a.ts";\nexport * from "./b.ts";\n',
    });
    expect(ambiguous.result.ok).toBeTrue();
    expect(ambiguous.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      ambiguous.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name)
        .sort(),
    ).toEqual(["aOnly", "bOnly", "directApi", "explicitApi"]);
    expect(
      ambiguous.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "shared",
      ),
    ).toBeFalse();
  });

  test("coalesces equivalent star bindings across duplicate and diamond paths", async () => {
    const duplicateTarget = await scan({
      "package.json": JSON.stringify({
        exports: "./src/index.ts",
        name: "duplicate-star-target",
      }),
      "src/index.ts": 'export * from "./shared.ts";\nexport * from "./shared.ts";\n',
      "src/shared.ts": "export function shared() {}\n",
    });
    expect(duplicateTarget.result.ok).toBeTrue();
    expect(duplicateTarget.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      duplicateTarget.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name),
    ).toEqual(["shared"]);

    const diamond = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "diamond-stars" }),
      "src/base.ts": "export function shared() {}\n",
      "src/index.ts": 'export * from "./left.ts";\nexport * from "./right.ts";\n',
      "src/left.ts": 'export * from "./base.ts";\n',
      "src/right.ts": 'export * from "./base.ts";\n',
    });
    expect(diamond.result.ok).toBeTrue();
    expect(diamond.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      diamond.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name),
    ).toEqual(["shared"]);
  });

  test("preserves independent public callables beside unsupported reexports", async () => {
    const partialBarrel = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "partial-barrel" }),
      "src/index.ts": [
        "export function directApi() {}",
        'export { otherApi } from "./other.ts";',
        'export { missingApi } from "external-package";',
        'export * from "unsupported-star";',
      ].join("\n"),
      "src/other.ts": "export function otherApi() {}\n",
    });
    expect(partialBarrel.result.ok).toBeTrue();
    expect(partialBarrel.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      partialBarrel.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name)
        .sort(),
    ).toEqual(["directApi", "otherApi"]);

    const cyclic = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "cyclic-barrel" }),
      "src/cycle.ts": 'export * from "./index.ts";\n',
      "src/index.ts":
        'export function directApi() {}\nexport { explicitApi } from "./other.ts";\nexport * from "./cycle.ts";\n',
      "src/other.ts": "export function explicitApi() {}\n",
    });
    expect(cyclic.result.ok).toBeTrue();
    expect(cyclic.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      cyclic.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name)
        .sort(),
    ).toEqual(["directApi", "explicitApi"]);

    const depthFiles: Record<string, string> = {
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "deep-barrel" }),
      "src/index.ts":
        'export function directApi() {}\nexport { explicitApi } from "./other.ts";\nexport * from "./deep/00.ts";\n',
      "src/other.ts": "export function explicitApi() {}\n",
    };
    for (let index = 0; index < 34; index += 1) {
      const current = String(index).padStart(2, "0");
      const next = String(index + 1).padStart(2, "0");
      depthFiles[`src/deep/${current}.ts`] =
        index === 33 ? "export function tooDeepApi() {}\n" : `export * from "./${next}.ts";\n`;
    }
    const depthOverflow = await scan(depthFiles);
    expect(depthOverflow.result.ok).toBeTrue();
    expect(depthOverflow.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      depthOverflow.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name)
        .sort(),
    ).toEqual(["directApi", "explicitApi"]);
  });

  test("localizes public proof overflow at the exact target-chain boundary", async () => {
    const scanChain = async (targetFiles: number) => {
      const source: Record<string, string> = {
        "package.json": JSON.stringify({
          exports: "./src/index.ts",
          name: `proof-chain-${targetFiles}`,
        }),
        "src/index.ts": [
          "export function directApi() {}",
          'export { safeApi } from "./safe.ts";',
          'export * from "./deep/00.ts";',
        ].join("\n"),
        "src/safe.ts": "export function safeApi() {}\n",
      };
      for (let index = 0; index < targetFiles; index += 1) {
        const current = String(index).padStart(2, "0");
        const next = String(index + 1).padStart(2, "0");
        source[`src/deep/${current}.ts`] =
          index === targetFiles - 1
            ? "export function deepApi() {}\n"
            : `export * from "./${next}.ts";\n`;
      }
      return scan(source);
    };

    const exactBound = await scanChain(29);
    expect(exactBound.result.ok).toBeTrue();
    expect(exactBound.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      exactBound.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name)
        .sort(),
    ).toEqual(["deepApi", "directApi", "safeApi"]);

    for (const targetFiles of [30, 31]) {
      const overflow = await scanChain(targetFiles);
      expect(overflow.result.ok).toBeTrue();
      expect(overflow.snapshot?.coverage[0]?.state).toBe("partial");
      expect(
        overflow.snapshot?.records
          .filter((record) => record.kind === "action")
          .map((record) => record.name)
          .sort(),
      ).toEqual(["directApi", "safeApi"]);
      expect(
        overflow.snapshot?.records.some(
          (record) => record.kind === "action" && record.name === "deepApi",
        ),
      ).toBeFalse();
    }
  });

  test("retains bounded same-binding proofs beside known overlong paths", async () => {
    for (const longFirst of [true, false]) {
      const source: Record<string, string> = {
        "package.json": JSON.stringify({
          exports: "./src/index.ts",
          name: `same-binding-overflow-${longFirst ? "long" : "short"}-first`,
        }),
        "src/base.ts": "/** Shared API. */\nexport function shared() {}\n",
        "src/index.ts": [
          longFirst ? 'export * from "./long/00.ts";' : 'export * from "./short.ts";',
          longFirst ? 'export * from "./short.ts";' : 'export * from "./long/00.ts";',
        ].join("\n"),
        "src/short.ts": 'export * from "./base.ts";\n',
      };
      for (let index = 0; index < 29; index += 1) {
        const current = String(index).padStart(2, "0");
        const next = String(index + 1).padStart(2, "0");
        source[`src/long/${current}.ts`] =
          index === 28 ? 'export * from "../base.ts";\n' : `export * from "./${next}.ts";\n`;
      }

      const result = await scan(source);
      expect(result.result.ok).toBeTrue();
      expect(result.snapshot?.coverage[0]?.state).toBe("partial");
      const action = result.snapshot?.records.find(
        (record) => record.kind === "action" && record.name === "shared",
      );
      expect(action?.kind).toBe("action");
      expect(action?.provenance.some((item) => item.resource === "src/short.ts")).toBeTrue();
      expect(action?.provenance.some((item) => item.resource.startsWith("src/long/"))).toBeFalse();
    }

    const explicitSource: Record<string, string> = {
      "package.json": JSON.stringify({
        exports: "./src/index.ts",
        name: "same-binding-explicit-overflow",
      }),
      "src/base.ts": "/** Shared API. */\nexport function shared() {}\n",
      "src/index.ts": 'export * from "./mid.ts";\nexport * from "./short.ts";\n',
      "src/mid.ts": 'export { shared } from "./long/00.ts";\n',
      "src/short.ts": 'export * from "./base.ts";\n',
    };
    for (let index = 0; index < 29; index += 1) {
      const current = String(index).padStart(2, "0");
      const next = String(index + 1).padStart(2, "0");
      explicitSource[`src/long/${current}.ts`] =
        index === 28 ? 'export * from "../base.ts";\n' : `export * from "./${next}.ts";\n`;
    }
    const explicitOverflow = await scan(explicitSource);
    expect(explicitOverflow.result.ok).toBeTrue();
    expect(explicitOverflow.snapshot?.coverage[0]?.state).toBe("partial");
    const explicitAction = explicitOverflow.snapshot?.records.find(
      (record) => record.kind === "action" && record.name === "shared",
    );
    expect(explicitAction?.kind).toBe("action");
    expect(explicitAction?.provenance.some((item) => item.resource === "src/short.ts")).toBeTrue();
    expect(
      explicitAction?.provenance.some((item) => item.resource.startsWith("src/long/")),
    ).toBeFalse();

    const differentBinding: Record<string, string> = {
      "package.json": JSON.stringify({
        exports: "./src/index.ts",
        name: "different-binding-overflow",
      }),
      "src/base.ts": "export function shared() { return 'short'; }\n",
      "src/index.ts": 'export * from "./long/00.ts";\nexport * from "./short.ts";\n',
      "src/other-base.ts": "export function shared() { return 'long'; }\n",
      "src/short.ts": 'export * from "./base.ts";\n',
    };
    for (let index = 0; index < 29; index += 1) {
      const current = String(index).padStart(2, "0");
      const next = String(index + 1).padStart(2, "0");
      differentBinding[`src/long/${current}.ts`] =
        index === 28 ? 'export * from "../other-base.ts";\n' : `export * from "./${next}.ts";\n`;
    }
    const differentOverflow = await scan(differentBinding);
    expect(differentOverflow.result.ok).toBeTrue();
    expect(differentOverflow.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      differentOverflow.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "shared",
      ),
    ).toBeFalse();
  });

  test("chooses the shortest deterministic proof for equivalent star bindings", async () => {
    const result = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "shortest-proof" }),
      "src/base.ts": "/** Shared API. */\nexport function shared() {}\n",
      "src/index.ts": 'export * from "./long/00.ts";\nexport * from "./short.ts";\n',
      "src/long/00.ts": 'export * from "./01.ts";\n',
      "src/long/01.ts": 'export * from "./02.ts";\n',
      "src/long/02.ts": 'export * from "../base.ts";\n',
      "src/short.ts": 'export * from "./base.ts";\n',
    });
    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("complete");
    const action = result.snapshot?.records.find(
      (record) => record.kind === "action" && record.name === "shared",
    );
    expect(action?.kind).toBe("action");
    expect(action?.provenance.some((item) => item.resource === "src/short.ts")).toBeTrue();
    expect(action?.provenance.some((item) => item.resource.startsWith("src/long/"))).toBeFalse();
  });

  test("uses a star proof only for an equivalent unresolved explicit binding", async () => {
    const overflowFixture = (sameBinding: boolean): Record<string, string> => {
      const source: Record<string, string> = {
        "package.json": JSON.stringify({
          exports: "./src/index.ts",
          name: `same-level-explicit-${sameBinding ? "same" : "different"}`,
        }),
        "src/base.ts": "export function shared() { return 'short'; }\n",
        "src/index.ts": 'export { shared } from "./long/00.ts";\nexport * from "./short.ts";\n',
        "src/other-base.ts": "export function shared() { return 'long'; }\n",
        "src/short.ts": 'export * from "./base.ts";\n',
      };
      for (let index = 0; index < 29; index += 1) {
        const current = String(index).padStart(2, "0");
        const next = String(index + 1).padStart(2, "0");
        source[`src/long/${current}.ts`] =
          index === 28
            ? `export * from "../${sameBinding ? "base" : "other-base"}.ts";\n`
            : `export * from "./${next}.ts";\n`;
      }
      return source;
    };

    const equivalent = await scan(overflowFixture(true));
    expect(equivalent.result.ok).toBeTrue();
    expect(equivalent.snapshot?.coverage[0]?.state).toBe("partial");
    const equivalentAction = equivalent.snapshot?.records.find(
      (record) => record.kind === "action" && record.name === "shared",
    );
    expect(equivalentAction?.kind).toBe("action");
    expect(
      equivalentAction?.provenance.some((item) => item.resource === "src/short.ts"),
    ).toBeTrue();
    expect(
      equivalentAction?.provenance.some((item) => item.resource.startsWith("src/long/")),
    ).toBeFalse();

    const different = await scan(overflowFixture(false));
    expect(different.result.ok).toBeTrue();
    expect(different.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      different.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "shared",
      ),
    ).toBeFalse();

    const unknown = await scan({
      "package.json": JSON.stringify({
        exports: "./src/index.ts",
        name: "same-level-explicit-unknown",
      }),
      "src/base.ts": "export function shared() {}\n",
      "src/index.ts": 'export { shared } from "external-package";\nexport * from "./short.ts";\n',
      "src/short.ts": 'export * from "./base.ts";\n',
    });
    expect(unknown.result.ok).toBeTrue();
    expect(unknown.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      unknown.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "shared",
      ),
    ).toBeFalse();

    const proved = await scan({
      "package.json": JSON.stringify({
        exports: "./src/index.ts",
        name: "same-level-explicit-proved",
      }),
      "src/explicit.ts": "export function shared() { return 'explicit'; }\n",
      "src/index.ts": 'export * from "./star.ts";\nexport { shared } from "./explicit.ts";\n',
      "src/star.ts": "export function shared() { return 'star'; }\n",
    });
    expect(proved.result.ok).toBeTrue();
    expect(proved.snapshot?.coverage[0]?.state).toBe("complete");
    const provedAction = proved.snapshot?.records.find(
      (record) => record.kind === "action" && record.name === "shared",
    );
    expect(provedAction?.kind).toBe("action");
    expect(provedAction?.provenance.some((item) => item.resource === "src/explicit.ts")).toBeTrue();
    expect(provedAction?.provenance.some((item) => item.resource === "src/star.ts")).toBeFalse();
  });

  test("propagates child-owned callables through bounded star uncertainty", async () => {
    for (const fixture of [
      {
        extra: {},
        name: "named",
        tail: 'export { missingApi } from "external-package";',
      },
      {
        extra: {},
        name: "star",
        tail: 'export * from "external-package";',
      },
      {
        extra: { "src/cycle.ts": 'export * from "./mid.ts";\n' },
        name: "cycle",
        tail: 'export * from "./cycle.ts";',
      },
    ] as const) {
      const result = await scan({
        ...fixture.extra,
        "package.json": JSON.stringify({
          exports: "./src/index.ts",
          name: `partial-child-${fixture.name}`,
        }),
        "src/index.ts": 'export * from "./mid.ts";\n',
        "src/mid.ts": `export function safeApi() {}\n${fixture.tail}\n`,
      });
      expect(result.result.ok).toBeTrue();
      expect(result.snapshot?.coverage[0]?.state).toBe("partial");
      expect(
        result.snapshot?.records
          .filter((record) => record.kind === "action")
          .map((record) => record.name),
      ).toEqual(["safeApi"]);
    }
  });

  test("lets malformed star surfaces suppress only possibly colliding star names", async () => {
    const result = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "malformed-star" }),
      "src/good.ts": "export function shared() {}\n",
      "src/index.ts": [
        "export function directApi() {}",
        'export { safeApi } from "./safe.ts";',
        'export * from "./good.ts";',
        'export * from "./malformed.ts";',
      ].join("\n"),
      "src/malformed.ts": "export function shared( {\n",
      "src/safe.ts": "export function safeApi() {}\n",
    });
    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      result.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name)
        .sort(),
    ).toEqual(["directApi", "safeApi"]);
    expect(
      result.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "shared",
      ),
    ).toBeFalse();

    const unknownSibling = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "unknown-star" }),
      "src/good.ts": "export function shared() {}\n",
      "src/index.ts": 'export * from "./good.ts";\nexport * from "external-package";\n',
    });
    expect(unknownSibling.result.ok).toBeTrue();
    expect(unknownSibling.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      unknownSibling.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "shared",
      ),
    ).toBeFalse();
  });

  test("resolves public barrels through owned package imports and tsconfig aliases only", async () => {
    const packageImport = await scan({
      "package.json": JSON.stringify({
        imports: { "#internal": "./src/missing.ts" },
        name: "@fixture/root",
        workspaces: ["packages/*"],
      }),
      "packages/member/package.json": JSON.stringify({
        exports: "./src/index.ts",
        imports: { "#internal": "./src/internal.ts" },
        name: "@fixture/member",
      }),
      "packages/member/src/index.ts": 'export { api } from "#internal";\n',
      "packages/member/src/internal.ts": "export function api() {}\n",
    });
    expect(packageImport.result.ok).toBeTrue();
    expect(packageImport.snapshot?.coverage[0]?.state).toBe("complete");
    const packageImportAction = packageImport.snapshot?.records.find(
      (record) => record.kind === "action" && record.name === "api",
    );
    expect(packageImportAction?.provenance.map((item) => item.resource)).toEqual(
      expect.arrayContaining([
        "packages/member/package.json",
        "packages/member/src/index.ts",
        "packages/member/src/internal.ts",
      ]),
    );

    const tsconfigAlias = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "alias-barrel" }),
      "src/index.ts": 'export { api } from "@internal";\n',
      "src/internal.ts": "export function api() {}\n",
      "tsconfig.json": JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "@internal": ["src/internal.ts"] } },
      }),
    });
    expect(tsconfigAlias.result.ok).toBeTrue();
    expect(tsconfigAlias.snapshot?.coverage[0]?.state).toBe("complete");
    const aliasAction = tsconfigAlias.snapshot?.records.find(
      (record) => record.kind === "action" && record.name === "api",
    );
    expect(aliasAction?.provenance.map((item) => item.resource)).toEqual(
      expect.arrayContaining(["package.json", "src/index.ts", "src/internal.ts"]),
    );

    for (const fixture of [
      {
        configuration: {},
        name: "external",
        source: 'export { api } from "external-package";\n',
      },
      {
        configuration: {
          compilerOptions: { paths: { "@internal": ["src/missing.ts"] } },
        },
        name: "missing",
        source: 'export { api } from "@internal";\n',
      },
      {
        configuration: {
          compilerOptions: {
            paths: { "@internal": ["src/a.ts", "src/b.ts"] },
          },
        },
        extra: {
          "src/a.ts": "export function api() {}\n",
          "src/b.ts": "export function api() {}\n",
        },
        name: "ambiguous",
        source: 'export { api } from "@internal";\n',
      },
    ] as const) {
      const unresolved = await scan({
        ...("extra" in fixture ? fixture.extra : {}),
        "package.json": JSON.stringify({
          exports: "./src/index.ts",
          name: `${fixture.name}-barrel`,
        }),
        "src/index.ts": fixture.source,
        "tsconfig.json": JSON.stringify(fixture.configuration),
      });
      expect(unresolved.result.ok).toBeTrue();
      expect(unresolved.snapshot?.coverage[0]?.state).toBe("partial");
      expect(unresolved.snapshot?.records.some((record) => record.kind === "action")).toBeFalse();
    }

    const workspaceReexport = await scan({
      "package.json": JSON.stringify({ name: "@fixture/root", workspaces: ["packages/*"] }),
      "packages/api/package.json": JSON.stringify({
        exports: "./src/index.ts",
        name: "@fixture/api",
      }),
      "packages/api/src/index.ts": 'export { memberApi as reexported } from "@fixture/member";\n',
      "packages/member/package.json": JSON.stringify({
        exports: "./src/index.ts",
        name: "@fixture/member",
      }),
      "packages/member/src/index.ts": "export function memberApi() {}\n",
    });
    expect(workspaceReexport.result.ok).toBeTrue();
    expect(workspaceReexport.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      workspaceReexport.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "reexported",
      ),
    ).toBeFalse();
    expect(
      workspaceReexport.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "memberApi",
      ),
    ).toBeTrue();
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

  test("aggregates same-named legacy exports without losing declarations or JSDoc", async () => {
    const result = await scan({
      "package.json": JSON.stringify({
        main: "src/runtime.ts",
        module: "src/module.ts",
        name: "aggregate-legacy",
        types: "src/index.d.ts",
      }),
      "src/index.d.ts": "/** Declaration API. */\nexport declare function api(): void;\n",
      "src/module.ts": "/** Module API. */\nexport function api() {}\n",
      "src/runtime.ts": "/** Runtime API. */\nexport function api() {}\n",
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("complete");
    const actions = result.snapshot?.records.filter((record) => record.kind === "action") ?? [];
    expect(actions.map((record) => record.name)).toEqual(["api"]);
    expect(new Set(actions[0]?.provenance.map((item) => item.resource))).toEqual(
      new Set(["package.json", "src/index.d.ts", "src/module.ts", "src/runtime.ts"]),
    );
    const docs =
      result.snapshot?.records.flatMap((record) =>
        record.kind === "documentation" && record.subject?.key === actions[0]?.key
          ? [record.content]
          : [],
      ) ?? [];
    expect(docs.sort()).toEqual([
      "/** Declaration API. */",
      "/** Module API. */",
      "/** Runtime API. */",
    ]);

    const sameResourceDocs = await scan({
      "package.json": JSON.stringify({
        main: "src/runtime.ts",
        module: "src/module.ts",
        name: "same-resource-docs",
      }),
      "src/implementation.ts": [
        "/** First API. */",
        "export function first() {}",
        "/** Second API. */",
        "export function second() {}",
      ].join("\n"),
      "src/module.ts": 'export { second as api } from "./implementation.ts";\n',
      "src/runtime.ts": 'export { first as api } from "./implementation.ts";\n',
    });
    expect(sameResourceDocs.result.ok).toBeTrue();
    expect(sameResourceDocs.snapshot?.coverage[0]?.state).toBe("complete");
    const sameResourceAction = sameResourceDocs.snapshot?.records.find(
      (record) => record.kind === "action" && record.name === "api",
    );
    const retainedDocs =
      sameResourceDocs.snapshot?.records.flatMap((record) =>
        record.kind === "documentation" && record.subject?.key === sameResourceAction?.key
          ? [record]
          : [],
      ) ?? [];
    expect(retainedDocs.map((record) => record.content).sort()).toEqual([
      "/** First API. */",
      "/** Second API. */",
    ]);
    expect(new Set(retainedDocs.map((record) => record.key)).size).toBe(2);
    expect(
      retainedDocs.every((record) => record.subject?.key === sameResourceAction?.key),
    ).toBeTrue();

    const declarationsOnly = await scan({
      "package.json": JSON.stringify({ name: "declarations-only", types: "src/index.d.ts" }),
      "src/index.d.ts": "export declare function typeApi(): void;\n",
    });
    expect(declarationsOnly.result.ok).toBeTrue();
    expect(
      declarationsOnly.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "typeApi",
      ),
    ).toBeTrue();

    const alternateEntry = await scan({
      "package.json": JSON.stringify({ main: "src/alternate.ts", name: "alternate-entry" }),
      "src/alternate.ts": "export function api() {}\n",
    });
    const alternateAction = alternateEntry.snapshot?.records.find(
      (record) => record.kind === "action" && record.name === "api",
    );
    expect(alternateAction?.key).toBe(actions[0]?.key);
  });

  test("retains a deterministic bounded public proof when later aggregates overflow", async () => {
    const source: Record<string, string> = {
      "package.json": JSON.stringify({
        main: "src/a-short.ts",
        module: "src/z-chain/00.ts",
        name: "bounded-aggregate",
      }),
      "src/a-short.ts": "/** Short API. */\nexport function api() {}\n",
    };
    for (let index = 0; index < 29; index += 1) {
      const current = String(index).padStart(2, "0");
      const next = String(index + 1).padStart(2, "0");
      source[`src/z-chain/${current}.ts`] =
        index === 28
          ? "/** Long API. */\nexport function api() {}\n"
          : `export { api } from "./${next}.ts";\n`;
    }
    const first = await scan(source);
    const replay = await scan(Object.fromEntries(Object.entries(source).reverse()));

    expect(first.result.ok).toBeTrue();
    expect(replay.result.ok).toBeTrue();
    expect(first.snapshot?.coverage[0]?.state).toBe("partial");
    expect(replay.snapshot).toEqual(first.snapshot);
    expect(replay.emittedKeys).toEqual(first.emittedKeys);
    const action = first.snapshot?.records.find(
      (record) => record.kind === "action" && record.name === "api",
    );
    expect(action).toBeDefined();
    expect(action?.provenance).toHaveLength(3);
    expect(new Set(action?.provenance.map((item) => item.resource))).toEqual(
      new Set(["package.json", "src/a-short.ts"]),
    );
    expect(action?.provenance.some((item) => item.resource.startsWith("src/z-chain/"))).toBeFalse();
    expect(
      first.snapshot?.records.flatMap((record) =>
        record.kind === "documentation" && record.subject?.key === action?.key
          ? [record.content]
          : [],
      ),
    ).toEqual(["/** Short API. */"]);
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

  test("normalizes exact Node builtins after aliases without prefix guesses", async () => {
    const result = await scan({
      "package.json": JSON.stringify({ exports: "./src/api/index.ts", name: "builtins" }),
      "src/api/index.ts": [
        'import fs from "fs";',
        'import promises from "fs/promises";',
        'import runtimePromises from "node:fs/promises";',
        'import timers from "timers";',
        'import timerPromises from "timers/promises";',
        'import bareBun from "bun";',
        'import bunSqlite from "bun:sqlite";',
        'import extra from "fs-extra";',
        'import socket from "ws";',
        'import undici from "undici";',
        'import bareTest from "test";',
        'import nodeTest from "node:test";',
        "void fs; void promises; void runtimePromises; void timers; void timerPromises;",
        "void bareBun; void bunSqlite; void extra; void socket; void undici;",
        "void bareTest; void nodeTest;",
      ].join("\n"),
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("complete");
    const candidates =
      result.snapshot?.records.flatMap((record) =>
        record.kind === "component-candidate" && record.candidate.type === "external"
          ? [record]
          : [],
      ) ?? [];
    expect(candidates.map((record) => record.candidate.name).sort()).toEqual([
      "bun",
      "bun:sqlite",
      "fs-extra",
      "node:fs",
      "node:test",
      "node:timers",
      "test",
      "undici",
      "ws",
    ]);
    const nodeFs = candidates.find((record) => record.candidate.name === "node:fs");
    const nodeFsImport = result.snapshot?.records.find(
      (record) =>
        record.kind === "relationship" &&
        record.relationshipType === "imports" &&
        record.to.key === nodeFs?.key,
    );
    expect(nodeFsImport?.provenance).toHaveLength(3);
    const nodeTimers = candidates.find((record) => record.candidate.name === "node:timers");
    const nodeTimersImport = result.snapshot?.records.find(
      (record) =>
        record.kind === "relationship" &&
        record.relationshipType === "imports" &&
        record.to.key === nodeTimers?.key,
    );
    expect(nodeTimersImport?.provenance).toHaveLength(2);

    const aliased = await scan({
      "package.json": JSON.stringify({ exports: "./src/api/index.ts", name: "builtin-alias" }),
      "src/api/index.ts": 'import fs from "fs";\nvoid fs;\n',
      "src/domain/fs.ts": "export default {};\n",
      "tsconfig.json": JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { fs: ["src/domain/fs.ts"] } },
      }),
    });
    expect(aliased.result.ok).toBeTrue();
    expect(aliased.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      aliased.snapshot?.records.some(
        (record) =>
          record.kind === "component-candidate" &&
          record.candidate.type === "external" &&
          record.candidate.name === "node:fs",
      ),
    ).toBeFalse();
    expect(
      aliased.snapshot?.records.some(
        (record) => record.kind === "relationship" && record.relationshipType === "imports",
      ),
    ).toBeTrue();
  });

  test("keeps direct re-exports while imported-then-exported bindings remain partial", async () => {
    const result = await scan({
      "package.json": JSON.stringify({
        exports: { ".": "./src/alias.ts", "./direct": "./src/direct.ts" },
        name: "import-reexports",
      }),
      "src/alias.ts": [
        'import defaultLocal, { work as localWork } from "./implementation.ts";',
        "export { defaultLocal as publicDefault, localWork as publicWork };",
      ].join("\n"),
      "src/direct.ts":
        'export { default as publicDefault, work as publicWork } from "./implementation.ts";\n',
      "src/implementation.ts": [
        "export default function defaultWork() {}",
        "export function work() {}",
      ].join("\n"),
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("partial");
    const actions = result.snapshot?.records.filter((record) => record.kind === "action") ?? [];
    expect(actions.map((record) => record.name).sort()).toEqual(["publicDefault", "publicWork"]);
    for (const action of actions) {
      expect(action.description).toBe("Public export at ./direct");
      expect([...new Set(action.provenance.map((item) => item.resource))].sort()).toEqual([
        "package.json",
        "src/direct.ts",
        "src/implementation.ts",
      ]);
    }

    for (const entry of [
      [
        'import externalDefault from "external-package";',
        'import * as namespace from "./implementation.ts";',
        'import type { Shape } from "./implementation.ts";',
        "export { externalDefault, namespace };",
        "export type { Shape };",
      ].join("\n"),
      'import { missing } from "./missing.ts";\nexport { missing };\n',
    ]) {
      const unsupported = await scan({
        "package.json": JSON.stringify({ exports: "./src/index.ts", name: "unsupported-import" }),
        "src/implementation.ts": "export interface Shape { ok: true }\n",
        "src/index.ts": entry,
      });
      expect(unsupported.result.ok).toBeTrue();
      expect(unsupported.snapshot?.coverage[0]?.state).toBe("partial");
      expect(unsupported.snapshot?.records.some((record) => record.kind === "action")).toBeFalse();
    }

    const nonCallableImports = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "non-callable-imports" }),
      "src/implementation.ts": [
        "export interface Shape { ok: true }",
        "export function implementation() {}",
      ].join("\n"),
      "src/index.ts": [
        'import * as namespace from "./implementation.ts";',
        'import type { Shape } from "./implementation.ts";',
        "export { namespace };",
        "export type { Shape };",
      ].join("\n"),
    });
    expect(nonCallableImports.result.ok).toBeTrue();
    expect(nonCallableImports.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      nonCallableImports.snapshot?.records.some((record) => record.kind === "action"),
    ).toBeFalse();
  });

  test("leaves imported bindings re-exported as default partial without actions", async () => {
    for (const [importStatement, implementation] of [
      ['import api from "./implementation.ts";', "export default function api() {}\n"],
      ['import { api } from "./implementation.ts";', "export function api() {}\n"],
    ] as const) {
      const result = await scan({
        "package.json": JSON.stringify({ exports: "./src/index.ts", name: "default-barrel" }),
        "src/implementation.ts": implementation,
        "src/index.ts": `${importStatement}\nexport default api;\n`,
      });

      expect(result.result.ok).toBeTrue();
      expect(result.snapshot?.coverage[0]?.state).toBe("partial");
      expect(result.snapshot?.records.some((record) => record.kind === "action")).toBeFalse();
    }

    for (const unsupportedEntry of [
      'import api from "external-package";\nexport default api;\n',
      'import api = require("./implementation.ts");\nexport default api;\n',
      "import api = Namespace.api;\nexport default api;\n",
      'export import api = require("./implementation.ts");\n',
    ]) {
      const unsupported = await scan({
        "package.json": JSON.stringify({ exports: "./src/index.ts", name: "default-unsupported" }),
        "src/implementation.ts": "export default function api() {}\n",
        "src/index.ts": unsupportedEntry,
      });
      expect(unsupported.result.ok).toBeTrue();
      expect(unsupported.snapshot?.coverage[0]?.state).toBe("partial");
      expect(unsupported.snapshot?.records.some((record) => record.kind === "action")).toBeFalse();
    }

    const namespace = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "default-namespace" }),
      "src/implementation.ts": "export function api() {}\n",
      "src/index.ts": 'import * as api from "./implementation.ts";\nexport default api;\n',
    });
    expect(namespace.result.ok).toBeTrue();
    expect(namespace.snapshot?.coverage[0]?.state).toBe("partial");
    expect(namespace.snapshot?.records.some((record) => record.kind === "action")).toBeFalse();
  });

  test("omits mutable, declaration-typed, and overloaded callable bindings", async () => {
    const result = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "unsupported-callables" }),
      "src/index.ts": [
        "export let mutableApi = () => true;",
        "export declare const declaredApi: () => void;",
        "export function overloadedApi(value: string): void;",
        "export function overloadedApi(value: number): void;",
        "export function overloadedApi(value: string | number): void { void value; }",
        "export function safeApi() {}",
      ].join("\n"),
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      result.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name),
    ).toEqual(["safeApi"]);
  });

  test("honors exact tsconfig files and include source-universe semantics", async () => {
    const allowlist = await scan({
      "package.json": JSON.stringify({ exports: "./src/public.ts", name: "files-allowlist" }),
      "src/private.ts": "export function privateApi() {}\n",
      "src/public.ts": "export function publicApi() {}\n",
      "tsconfig.json": JSON.stringify({ files: ["./src/public.ts"] }),
    });
    expect(allowlist.result.ok).toBeTrue();
    expect(allowlist.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      allowlist.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name),
    ).toEqual(["publicApi"]);
    expect(allowlist.fixture.read).not.toContain("src/private.ts");

    for (const include of ["./src", "./src/**/*.ts"]) {
      const normalizedPatterns = await scan({
        "package.json": JSON.stringify({
          exports: "./src/public/index.ts",
          name: "normalized-tsconfig-patterns",
        }),
        "src/private/hidden.ts": "export function hiddenApi() {}\n",
        "src/public/index.ts": "export function publicApi() {}\n",
        "tsconfig.json": JSON.stringify({
          exclude: ["./src/private/**"],
          include: [include],
        }),
      });
      expect(normalizedPatterns.result.ok).toBeTrue();
      expect(normalizedPatterns.snapshot?.coverage[0]?.state).toBe("complete");
      expect(
        normalizedPatterns.snapshot?.records
          .filter((record) => record.kind === "action")
          .map((record) => record.name),
      ).toEqual(["publicApi"]);
      expect(normalizedPatterns.fixture.read).not.toContain("src/private/hidden.ts");
    }

    for (const configuration of [{ files: [] }, { include: [] }]) {
      const empty = await scan({
        "package.json": JSON.stringify({ name: "empty-source-universe" }),
        "src/index.ts": "export function invisible() {}\n",
        "tsconfig.json": JSON.stringify(configuration),
      });
      expect(empty.result.ok).toBeTrue();
      expect(empty.snapshot?.coverage[0]?.state).toBe("complete");
      expect(empty.fixture.read).not.toContain("src/index.ts");
      expect(
        empty.snapshot?.records.some(
          (record) =>
            record.kind === "component-candidate" && record.candidate.type === "source-boundary",
        ),
      ).toBeFalse();
    }

    const union = await scan({
      "package.json": JSON.stringify({
        exports: {
          ".": "./src/explicit/index.ts",
          "./included": "./src/included/kept.ts",
        },
        name: "files-include-union",
      }),
      "src/explicit/index.ts": "export function explicitApi() {}\n",
      "src/included/kept.ts": "export function includedApi() {}\n",
      "src/included/omitted.ts": "export function omittedApi() {}\n",
      "tsconfig.json": JSON.stringify({
        exclude: ["src/explicit/**", "src/included/omitted.ts"],
        files: ["src/explicit/index.ts"],
        include: ["src/included/**/*.ts"],
      }),
    });
    expect(union.result.ok).toBeTrue();
    expect(union.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      union.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name)
        .sort(),
    ).toEqual(["explicitApi", "includedApi"]);
    expect(union.fixture.read).not.toContain("src/included/omitted.ts");

    const incompleteFiles = await scan({
      "package.json": JSON.stringify({ exports: "./src/valid.ts", name: "incomplete-files" }),
      "src/unlisted.ts": "export function unlistedApi() {}\n",
      "src/valid.ts": "export function validApi() {}\n",
      "tsconfig.json": JSON.stringify({
        files: ["src/valid.ts", "src/missing.ts", "../escape.ts"],
      }),
    });
    expect(incompleteFiles.result.ok).toBeTrue();
    expect(incompleteFiles.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      incompleteFiles.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name),
    ).toEqual(["validApi"]);
    expect(incompleteFiles.fixture.read).not.toContain("src/unlisted.ts");
  });

  test("scans the bounded clean Nuxt aggregator and exposes explicit server routes", async () => {
    const references = [
      { path: "./.nuxt/tsconfig.app.json" },
      { path: "./.nuxt/tsconfig.server.json" },
      { path: "./.nuxt/tsconfig.shared.json" },
      { path: "./.nuxt/tsconfig.node.json" },
    ];
    const result = await scan({
      "app/composables/useEvent.ts":
        'import { event } from "../../shared/domain/event.ts";\nexport const useEvent = () => event;\n',
      "app/pages/index.vue": "<template><main>Events</main></template>\n",
      "nuxt.config.ts": "export default defineNuxtConfig({});\n",
      "package.json": JSON.stringify({ name: "nuxt-project", private: true }),
      "server/api/events/[eventId]/index.get.ts":
        "export default defineEventHandler(() => ({ ok: true }));\n",
      "server/api/health.post.ts": "export default defineEventHandler(() => ({ ok: true }));\n",
      "server/api/unqualified.ts": "export default defineEventHandler(() => ({ ok: true }));\n",
      "shared/domain/event.ts": "export const event = { id: 'event' };\n",
      "tsconfig.json": JSON.stringify({ files: [], references }),
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      result.snapshot?.records
        .filter((record) => record.kind === "component-candidate")
        .map((record) => record.candidate.name)
        .sort(),
    ).toEqual(["/api", "/api/events", "composables", "domain", "nuxt-project", "source"]);
    expect(
      result.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name)
        .sort(),
    ).toEqual(["GET /api/events/[eventId]", "POST /api/health"]);
    expect(
      result.snapshot?.records
        .filter((record) => record.kind === "action")
        .flatMap((record) => record.provenance.map((item) => item.resource))
        .sort(),
    ).toEqual(["server/api/events/[eventId]/index.get.ts", "server/api/health.post.ts"]);
    expect(result.fixture.read).not.toContain("app/pages/index.vue");
    expect(
      result.snapshot?.records.some(
        (record) => record.kind === "relationship" && record.relationshipType === "imports",
      ),
    ).toBeTrue();
  });

  test("keeps near-miss Nuxt project-reference aggregators fail-closed", async () => {
    const references = [
      { path: "./.nuxt/tsconfig.app.json" },
      { path: "./.nuxt/tsconfig.server.json" },
      { path: "./.nuxt/tsconfig.shared.json" },
      { path: "./.nuxt/tsconfig.node.json" },
    ];
    const configurations = [
      { files: [], references: references.slice(0, -1) },
      { files: [], references: [...references, { path: "./tsconfig.extra.json" }] },
      {
        files: [],
        references: references.map((reference, index) =>
          index === 0 ? { ...reference, prepend: true } : reference,
        ),
      },
    ];
    for (const configuration of configurations) {
      const result = await scan({
        "nuxt.config.ts": "export default defineNuxtConfig({});\n",
        "package.json": JSON.stringify({ name: "near-miss-nuxt" }),
        "server/api/health.get.ts": "export default defineEventHandler(() => ({ ok: true }));\n",
        "tsconfig.json": JSON.stringify(configuration),
      });
      expect(result.result.ok).toBeTrue();
      expect(result.snapshot?.coverage[0]?.state).toBe("partial");
      expect(result.fixture.read).not.toContain("server/api/health.get.ts");
      expect(
        result.snapshot?.records.some(
          (record) =>
            record.kind === "component-candidate" && record.candidate.type === "source-boundary",
        ),
      ).toBeFalse();
      expect(result.snapshot?.records.some((record) => record.kind === "action")).toBeFalse();
    }

    const missingMarker = await scan({
      "package.json": JSON.stringify({ name: "missing-nuxt-marker" }),
      "server/api/health.get.ts": "export default defineEventHandler(() => ({ ok: true }));\n",
      "tsconfig.json": JSON.stringify({ files: [], references }),
    });
    expect(missingMarker.result.ok).toBeTrue();
    expect(missingMarker.snapshot?.coverage[0]?.state).toBe("partial");
    expect(missingMarker.fixture.read).not.toContain("server/api/health.get.ts");
    expect(missingMarker.snapshot?.records.some((record) => record.kind === "action")).toBeFalse();
  });

  test("omits conflicting Nuxt route claims across directories and extensions", async () => {
    const result = await scan({
      "nuxt.config.ts": "export default defineNuxtConfig({});\n",
      "package.json": JSON.stringify({ name: "conflicting-nuxt-routes" }),
      "server/api/extension.get.mts":
        "export default defineEventHandler(() => ({ source: 'mts' }));\n",
      "server/api/extension.get.ts":
        "export default defineEventHandler(() => ({ source: 'ts' }));\n",
      "server/api/profile.get.ts":
        "export default defineEventHandler(() => ({ source: 'file' }));\n",
      "server/api/profile/index.get.ts":
        "export default defineEventHandler(() => ({ source: 'index' }));\n",
      "tsconfig.json": JSON.stringify({
        files: [],
        references: [
          { path: "./.nuxt/tsconfig.app.json" },
          { path: "./.nuxt/tsconfig.server.json" },
          { path: "./.nuxt/tsconfig.shared.json" },
          { path: "./.nuxt/tsconfig.node.json" },
        ],
      }),
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("partial");
    expect(result.snapshot?.records.some((record) => record.kind === "action")).toBeFalse();
  });

  test("leaves extensionless declaration-only entries partial without actions", async () => {
    const result = await scan({
      "package.json": JSON.stringify({ exports: "./src/public", name: "declaration-resolution" }),
      "src/public.d.ts": "export declare function publicDeclaration(): void;\n",
    });
    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("partial");
    expect(result.snapshot?.records.some((record) => record.kind === "action")).toBeFalse();
  });

  test("prefers exact runtime resources over declaration sidecar fallbacks", async () => {
    const packageEntry = await scan({
      "package.json": JSON.stringify({ exports: "./src/api/index.js", name: "exact-entry" }),
      "src/api/index.d.ts": "export declare function declarationApi(): void;\n",
      "src/api/index.js": "export function runtimeApi() {}\n",
    });
    expect(packageEntry.result.ok).toBeTrue();
    expect(packageEntry.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      packageEntry.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name),
    ).toEqual(["runtimeApi"]);

    const relativeImport = await scan({
      "package.json": JSON.stringify({
        exports: "./src/api/index.ts",
        name: "exact-relative-import",
      }),
      "src/api/index.ts": [
        'import { run } from "../domain/service.js";',
        'export { run as runtimeImport } from "../domain/service.js";',
        "export function publicApi() { return run(); }",
      ].join("\n"),
      "src/domain/service.d.ts": [
        "export declare function declarationOnly(): void;",
        "export declare function run(): void;",
      ].join("\n"),
      "src/domain/service.js": "export function run() { return true; }\n",
    });
    expect(relativeImport.result.ok).toBeTrue();
    expect(relativeImport.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      relativeImport.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name)
        .sort(),
    ).toEqual(["publicApi", "runtimeImport"]);
    expect(
      relativeImport.snapshot?.records.some(
        (record) => record.kind === "relationship" && record.relationshipType === "imports",
      ),
    ).toBeTrue();
    expect(
      relativeImport.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "declarationOnly",
      ),
    ).toBeFalse();
  });

  test("excludes generated and test declarations before reading them", async () => {
    const result = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.d.ts", name: "declarations" }),
      "src/index.d.ts": "export declare function publicDeclaration(): void;\n",
      "src/index.gen.d.ts": "export declare function genDeclaration(): void;\n",
      "src/index.generated.d.ts": "export declare function generatedDeclaration(): void;\n",
      "src/index.spec.d.ts": "export declare function specDeclaration(): void;\n",
      "src/index.test.d.ts": "export declare function testDeclaration(): void;\n",
      "src/module.gen.d.mts": "export declare function moduleGenDeclaration(): void;\n",
      "src/module.spec.d.mts": "export declare function moduleSpecDeclaration(): void;\n",
      "src/common.generated.d.cts": "export declare function commonGeneratedDeclaration(): void;\n",
      "src/common.test.d.cts": "export declare function commonTestDeclaration(): void;\n",
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      result.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name),
    ).toEqual(["publicDeclaration"]);
    for (const resource of [
      "src/index.gen.d.ts",
      "src/index.generated.d.ts",
      "src/index.spec.d.ts",
      "src/index.test.d.ts",
      "src/module.gen.d.mts",
      "src/module.spec.d.mts",
      "src/common.generated.d.cts",
      "src/common.test.d.cts",
    ])
      expect(result.fixture.read).not.toContain(resource);
  });

  test("keeps Groma-owned directories blind at every depth and case", async () => {
    const result = await scan({
      ".GROMA-CACHE/root.ts": "export function cachedRoot() {}\n",
      "GroMa/root.ts": "export function gromaRoot() {}\n",
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "scanner-blindness" }),
      "src/.gRoMa-CaChE/nested.ts": "export function cachedNested() {}\n",
      "src/GROMA/nested.ts": "export function gromaNested() {}\n",
      "src/index.ts": "export function visible() {}\n",
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      result.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name),
    ).toEqual(["visible"]);
    for (const directory of [".GROMA-CACHE", "GroMa", "src/.gRoMa-CaChE", "src/GROMA"])
      expect(result.fixture.enumerated).not.toContain(directory);
    expect(result.fixture.read.every((resource) => !/groma(?:-cache)?/i.test(resource))).toBeTrue();
  });

  test("substitutes wildcard alias captures as literal resource text", async () => {
    const result = await scan({
      "lib/$$.ts": "export const dollars = true;\n",
      "lib/$&.ts": "export const ampersand = true;\n",
      "lib/$1.ts": "export const capture = true;\n",
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "literal-captures" }),
      "src/index.ts": [
        'import { dollars } from "@literal/$$";',
        'import { ampersand } from "@literal/$&";',
        'import { capture } from "@literal/$1";',
        "void dollars; void ampersand; void capture;",
        "export function api() {}",
      ].join("\n"),
      "tsconfig.json": JSON.stringify({
        compilerOptions: { paths: { "@literal/*": ["lib/*"] } },
        files: ["lib/$$.ts", "lib/$&.ts", "lib/$1.ts", "src/index.ts"],
      }),
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      result.snapshot?.records.some(
        (record) => record.kind === "relationship" && record.relationshipType === "imports",
      ),
    ).toBeTrue();
    expect(result.fixture.read).toEqual(
      expect.arrayContaining(["lib/$$.ts", "lib/$&.ts", "lib/$1.ts"]),
    );
  });

  test("selects Bun-compatible parser syntax from each source extension", async () => {
    const scanEntry = async (extension: string, source: string) =>
      scan({
        "package.json": JSON.stringify({
          exports: `./src/api/index.${extension}`,
          name: `parser-policy-${extension}`,
        }),
        "src/domain/model.ts": "export const model = { ok: true };\n",
        [`src/api/index.${extension}`]: source,
      });
    const hasPublicAction = (result: Awaited<ReturnType<typeof scan>>): boolean =>
      result.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "publicApi",
      ) ?? false;
    const hasImportRelationship = (result: Awaited<ReturnType<typeof scan>>): boolean =>
      result.snapshot?.records.some(
        (record) => record.kind === "relationship" && record.relationshipType === "imports",
      ) ?? false;

    for (const extension of ["ts", "mts"]) {
      const typed = await scanEntry(
        extension,
        [
          'import { model } from "../domain/model.ts";',
          "const typed = <{ ok: boolean }>model;",
          "export function publicApi() { return typed; }",
        ].join("\n"),
      );
      expect(typed.result.ok).toBeTrue();
      expect(typed.snapshot?.coverage[0]?.state).toBe("complete");
      expect(hasPublicAction(typed)).toBeTrue();
      expect(hasImportRelationship(typed)).toBeTrue();
    }

    const commonTypeScript = await scanEntry(
      "cts",
      [
        'import { model } from "../domain/model.ts";',
        "const typed = <{ ok: boolean }>model;",
        "export function publicApi() { return typed; }",
      ].join("\n"),
    );
    expect(commonTypeScript.result.ok).toBeTrue();
    expect(commonTypeScript.snapshot?.coverage[0]?.state).toBe("partial");
    expect(hasPublicAction(commonTypeScript)).toBeFalse();
    expect(hasImportRelationship(commonTypeScript)).toBeTrue();

    for (const extension of ["tsx", "js", "jsx"]) {
      const jsx = await scanEntry(
        extension,
        [
          'import { model } from "../domain/model.ts";',
          "const view = <section data-ok={model.ok} />;",
          "export function publicApi() { return view; }",
        ].join("\n"),
      );
      expect(jsx.result.ok).toBeTrue();
      expect(jsx.snapshot?.coverage[0]?.state).toBe("complete");
      expect(hasPublicAction(jsx)).toBeTrue();
      expect(hasImportRelationship(jsx)).toBeTrue();
    }

    for (const fixture of [
      {
        extension: "tsx",
        source: [
          'import { model } from "../domain/model.ts";',
          "const typed = <{ ok: boolean }>model;",
          "export function publicApi() { return typed; }",
        ].join("\n"),
      },
      {
        extension: "js",
        source: [
          'import { model } from "../domain/model.ts";',
          "const typed: { ok: boolean } = model;",
          "export function publicApi() { return typed; }",
        ].join("\n"),
      },
    ]) {
      const rejected = await scanEntry(fixture.extension, fixture.source);
      expect(rejected.result.ok).toBeTrue();
      expect(rejected.snapshot?.coverage[0]?.state).toBe("partial");
      expect(hasPublicAction(rejected)).toBeFalse();
      expect(hasImportRelationship(rejected)).toBeFalse();
    }

    for (const extension of ["mjs", "cjs"]) {
      const ordinary = await scanEntry(
        extension,
        [
          'import { model } from "../domain/model.ts";',
          "export function publicApi() { return model; }",
        ].join("\n"),
      );
      expect(ordinary.result.ok).toBeTrue();
      expect(ordinary.snapshot?.coverage[0]?.state).toBe(
        extension === "cjs" ? "partial" : "complete",
      );
      expect(hasPublicAction(ordinary)).toBe(extension === "mjs");
      expect(hasImportRelationship(ordinary)).toBeTrue();

      const rejectedJsx = await scanEntry(
        extension,
        [
          'import { model } from "../domain/model.ts";',
          "const view = <section data-ok={model.ok} />;",
          "export function publicApi() { return view; }",
        ].join("\n"),
      );
      expect(rejectedJsx.result.ok).toBeTrue();
      expect(rejectedJsx.snapshot?.coverage[0]?.state).toBe("partial");
      expect(hasPublicAction(rejectedJsx)).toBeFalse();
      expect(hasImportRelationship(rejectedJsx)).toBeFalse();
    }
  });

  test("omits CommonJS public callables while preserving independent observations", async () => {
    const commonJs = await scan({
      "package.json": JSON.stringify({ exports: "./src/api/index.cjs", name: "common-js" }),
      "src/api/index.cjs": [
        'import { model } from "../domain/model.ts";',
        'Bun.serve({ routes: { "/health": { GET: () => Response.json(model) } } });',
        "export function hiddenPublic() {}",
      ].join("\n"),
      "src/domain/model.ts": "export const model = { ok: true };\n",
    });
    expect(commonJs.result.ok).toBeTrue();
    expect(commonJs.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      commonJs.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name),
    ).toEqual(["GET /health"]);
    expect(
      commonJs.snapshot?.records.some(
        (record) => record.kind === "relationship" && record.relationshipType === "imports",
      ),
    ).toBeTrue();

    for (const extension of ["cjs", "cts"]) {
      const internalCommonJs = await scan({
        "package.json": JSON.stringify({
          exports: "./src/api/index.ts",
          name: `internal-common-${extension}`,
        }),
        "src/api/index.ts": [
          `import "../legacy/index.${extension}";`,
          "export function publicApi() {}",
        ].join("\n"),
        "src/domain/model.ts": "export const model = { ok: true };\n",
        [`src/legacy/index.${extension}`]: [
          'const model = require("../domain/model.ts");',
          'Bun.serve({ routes: { "/legacy": { GET: () => Response.json(model) } } });',
          "module.exports = model;",
        ].join("\n"),
      });
      expect(internalCommonJs.result.ok).toBeTrue();
      expect(internalCommonJs.snapshot?.coverage[0]?.state).toBe("partial");
      expect(
        internalCommonJs.snapshot?.records
          .filter((record) => record.kind === "action")
          .map((record) => record.name)
          .sort(),
      ).toEqual(["GET /legacy", "publicApi"]);
      expect(
        internalCommonJs.snapshot?.records.some(
          (record) => record.kind === "relationship" && record.relationshipType === "imports",
        ),
      ).toBeTrue();
    }

    const commonJavaScript = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.js", name: "common-javascript" }),
      "src/domain/model.js": "export const model = { ok: true };\n",
      "src/index.js": [
        'import { model } from "./domain/model.js";',
        'Bun.serve({ routes: { "/js": { GET: () => Response.json(model) } } });',
        "export function publicApi() {}",
        "module.exports = publicApi;",
        "exports.publicApi = publicApi;",
      ].join("\n"),
    });
    expect(commonJavaScript.result.ok).toBeTrue();
    expect(commonJavaScript.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      commonJavaScript.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name)
        .sort(),
    ).toEqual(["GET /js", "publicApi"]);

    const esmJavaScript = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.js", name: "esm-javascript" }),
      "src/index.js": "export function publicApi() {}\n",
    });
    expect(esmJavaScript.result.ok).toBeTrue();
    expect(esmJavaScript.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      esmJavaScript.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "publicApi",
      ),
    ).toBeTrue();

    const commonTs = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.cts", name: "common-ts" }),
      "src/index.cts": "export function hiddenPublic() {}\n",
    });
    expect(commonTs.result.ok).toBeTrue();
    expect(commonTs.snapshot?.coverage[0]?.state).toBe("partial");
    expect(commonTs.snapshot?.records.some((record) => record.kind === "action")).toBeFalse();

    const esmBarrel = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.mjs", name: "esm-barrel" }),
      "src/index.mjs": 'export { hiddenPublic } from "./legacy.cjs";\n',
      "src/legacy.cjs": "export function hiddenPublic() {}\n",
    });
    expect(esmBarrel.result.ok).toBeTrue();
    expect(esmBarrel.snapshot?.coverage[0]?.state).toBe("partial");
    expect(esmBarrel.snapshot?.records.some((record) => record.kind === "action")).toBeFalse();

    for (const extension of ["mjs", "mts"]) {
      const esm = await scan({
        "package.json": JSON.stringify({
          exports: `./src/index.${extension}`,
          name: `esm-${extension}`,
        }),
        [`src/index.${extension}`]: "export function publicApi() {}\n",
      });
      expect(esm.result.ok).toBeTrue();
      expect(esm.snapshot?.coverage[0]?.state).toBe("complete");
      expect(
        esm.snapshot?.records.some(
          (record) => record.kind === "action" && record.name === "publicApi",
        ),
      ).toBeTrue();
    }
  });

  test("distinguishes lexical CommonJS globals from locally shadowed identifiers", async () => {
    const topLevelShadows = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.js", name: "top-level-shadows" }),
      "src/index.js": [
        "const exports = {};",
        "const module = { exports: {} };",
        "function require() { return {}; }",
        "exports.api = true;",
        "module.exports.api = true;",
        'require("./local-only.js");',
        "export function publicApi() {}",
      ].join("\n"),
    });
    expect(topLevelShadows.result.ok).toBeTrue();
    expect(topLevelShadows.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      topLevelShadows.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name),
    ).toEqual(["publicApi"]);

    const nestedShadows = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.js", name: "nested-shadows" }),
      "src/index.js": [
        "function local(exports, module, require) {",
        "  exports.api = true;",
        "  module.exports.api = true;",
        '  require("./local-only.js");',
        "}",
        "void local;",
        "export function publicApi() {}",
      ].join("\n"),
    });
    expect(nestedShadows.result.ok).toBeTrue();
    expect(nestedShadows.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      nestedShadows.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "publicApi",
      ),
    ).toBeTrue();

    for (const source of [
      [
        "function local(exports, module, require) {",
        "  exports.api = true;",
        "  module.exports.api = true;",
        '  require("./local-only.js");',
        "}",
        "module.exports = local;",
      ].join("\n"),
      ["{ const exports = {}; exports.local = true; }", "exports.outer = true;"].join("\n"),
    ]) {
      const unshadowedOutside = await scan({
        "package.json": JSON.stringify({ exports: "./src/index.js", name: "unshadowed-outside" }),
        "src/index.js": source,
      });
      expect(unshadowedOutside.result.ok).toBeTrue();
      expect(unshadowedOutside.snapshot?.coverage[0]?.state).toBe("partial");
      expect(
        unshadowedOutside.snapshot?.records.some((record) => record.kind === "action"),
      ).toBeFalse();
    }

    const helper = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.js", name: "common-js-helper" }),
      "src/index.js": 'Object.defineProperty(exports, "api", { value: () => true });\n',
    });
    expect(helper.result.ok).toBeTrue();
    expect(helper.snapshot?.coverage[0]?.state).toBe("partial");
    expect(helper.snapshot?.records.some((record) => record.kind === "action")).toBeFalse();

    const shadowedHelper = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.js", name: "shadowed-helper" }),
      "src/index.js": [
        "const exports = {};",
        'Object.defineProperty(exports, "api", { value: () => true });',
        "export function publicApi() {}",
      ].join("\n"),
    });
    expect(shadowedHelper.result.ok).toBeTrue();
    expect(shadowedHelper.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      shadowedHelper.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "publicApi",
      ),
    ).toBeTrue();
  });

  test("keeps static and TypeScript module var bindings within their boundaries", async () => {
    const fixtures = [
      {
        expected: "partial",
        extension: "js",
        name: "static-block-with-outer-use",
        source: [
          "class Container {",
          "  static {",
          "    var require = () => ({});",
          '    require("./local-only.js");',
          "  }",
          "}",
          'require("./outer.js");',
          "export function publicApi() {}",
        ].join("\n"),
      },
      {
        expected: "complete",
        extension: "js",
        name: "static-block-only",
        source: [
          "class Container {",
          "  static {",
          "    var require = () => ({});",
          '    require("./local-only.js");',
          "  }",
          "}",
          "export function publicApi() {}",
        ].join("\n"),
      },
      {
        expected: "partial",
        extension: "ts",
        name: "namespace-with-outer-use",
        source: [
          "namespace Internal {",
          "  export var require = () => ({});",
          '  require("./local-only.js");',
          "}",
          'require("./outer.js");',
          "export function publicApi() {}",
        ].join("\n"),
      },
      {
        expected: "complete",
        extension: "ts",
        name: "namespace-only",
        source: [
          "namespace Internal {",
          "  export var require = () => ({});",
          '  require("./local-only.js");',
          "}",
          "export function publicApi() {}",
        ].join("\n"),
      },
    ] as const;

    for (const fixture of fixtures) {
      const result = await scan({
        "package.json": JSON.stringify({
          exports: `./src/index.${fixture.extension}`,
          name: fixture.name,
        }),
        [`src/index.${fixture.extension}`]: fixture.source,
      });
      expect(result.result.ok).toBeTrue();
      expect(result.snapshot?.coverage[0]?.state).toBe(fixture.expected);
      expect(
        result.snapshot?.records.some(
          (record) => record.kind === "action" && record.name === "publicApi",
        ),
      ).toBeTrue();
    }
  });

  test("separates parameter defaults and computed keys from method bodies", async () => {
    const fixtures = [
      {
        expected: "partial",
        name: "default-before-body-var",
        source: [
          'function local(value = require("./outer.js")) {',
          "  var require = () => ({});",
          "  return value;",
          "}",
          "void local;",
          "export function publicApi() {}",
        ].join("\n"),
      },
      {
        expected: "partial",
        name: "class-computed-key",
        source: [
          "class Container {",
          '  [require("./outer.js")](require) {',
          '    require("./local-only.js");',
          "  }",
          "}",
          "void Container;",
          "export function publicApi() {}",
        ].join("\n"),
      },
      {
        expected: "partial",
        name: "object-computed-key",
        source: [
          "const container = {",
          '  [require("./outer.js")](require) {',
          '    require("./local-only.js");',
          "  },",
          "};",
          "void container;",
          "export function publicApi() {}",
        ].join("\n"),
      },
      {
        expected: "complete",
        name: "function-body-var",
        source: [
          "function local() {",
          "  var require = () => ({});",
          '  require("./local-only.js");',
          "}",
          "void local;",
          "export function publicApi() {}",
        ].join("\n"),
      },
      {
        expected: "complete",
        name: "parameter-default-shadow",
        source: [
          'function local(require, value = require("./local-only.js")) {',
          '  require("./also-local.js");',
          "  return value;",
          "}",
          "void local;",
          "export function publicApi() {}",
        ].join("\n"),
      },
      {
        expected: "complete",
        name: "ordinary-method-body-shadow",
        source: [
          "class Container {",
          "  method(require) {",
          '    require("./local-only.js");',
          "  }",
          "}",
          "void Container;",
          "export function publicApi() {}",
        ].join("\n"),
      },
      {
        expected: "complete",
        name: "ordinary-object-body-shadow",
        source: [
          "const container = {",
          "  method(require) {",
          '    require("./local-only.js");',
          "  },",
          "};",
          "void container;",
          "export function publicApi() {}",
        ].join("\n"),
      },
    ] as const;

    for (const fixture of fixtures) {
      const result = await scan({
        "package.json": JSON.stringify({ exports: "./src/index.js", name: fixture.name }),
        "src/index.js": fixture.source,
      });
      expect(result.result.ok).toBeTrue();
      expect(result.snapshot?.coverage[0]?.state).toBe(fixture.expected);
      expect(
        result.snapshot?.records.some(
          (record) => record.kind === "action" && record.name === "publicApi",
        ),
      ).toBeTrue();
    }
  });

  test("requires unshadowed Object for defineProperty CommonJS helpers", async () => {
    const sources = [
      {
        expected: "partial",
        name: "global-object-helper",
        source: [
          'Object.defineProperty(exports, "api", { value: () => true });',
          "export function publicApi() {}",
        ].join("\n"),
      },
      {
        expected: "complete",
        name: "local-object-helper",
        source: [
          "const Object = { defineProperty() {} };",
          'Object.defineProperty(exports, "api", { value: () => true });',
          "export function publicApi() {}",
        ].join("\n"),
      },
      {
        expected: "complete",
        name: "parameter-object-helper",
        source: [
          "function local(Object) {",
          '  Object.defineProperty(exports, "api", { value: () => true });',
          "}",
          "void local;",
          "export function publicApi() {}",
        ].join("\n"),
      },
    ] as const;

    for (const fixture of sources) {
      const result = await scan({
        "package.json": JSON.stringify({ exports: "./src/index.js", name: fixture.name }),
        "src/index.js": fixture.source,
      });
      expect(result.result.ok).toBeTrue();
      expect(result.snapshot?.coverage[0]?.state).toBe(fixture.expected);
      expect(
        result.snapshot?.records.some(
          (record) => record.kind === "action" && record.name === "publicApi",
        ),
      ).toBeTrue();
    }

    const importedObject = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.js", name: "imported-object-helper" }),
      "src/helpers.js": "export const objectHelper = { defineProperty() {} };\n",
      "src/index.js": [
        'import { objectHelper as Object } from "./helpers.js";',
        'Object.defineProperty(exports, "api", { value: () => true });',
        "export function publicApi() {}",
      ].join("\n"),
    });
    expect(importedObject.result.ok).toBeTrue();
    expect(importedObject.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      importedObject.snapshot?.records.some(
        (record) => record.kind === "action" && record.name === "publicApi",
      ),
    ).toBeTrue();
  });

  test("marks duplicate root tsconfig keys partial without scanning the affected scope", async () => {
    const result = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "duplicate-tsconfig" }),
      "src/index.ts": "export function api() {}\n",
      "tsconfig.json": '{"include":["src/**"],"include":["other/**"]}',
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("partial");
    expect(result.snapshot?.records).toEqual([]);
  });

  test("resolves extensionless runtime mjs file and index targets", async () => {
    const result = await scan({
      "package.json": JSON.stringify({
        exports: { ".": "./src/file", "./directory": "./src/directory" },
        name: "mjs-resolution",
      }),
      "src/directory/index.mjs": "export function directoryApi() {}\n",
      "src/file.mjs": "export function fileApi() {}\n",
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      result.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name)
        .sort(),
    ).toEqual(["directoryApi", "fileApi"]);
  });

  test("marks unshadowed require member surfaces partial", async () => {
    const result = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.js", name: "require-member" }),
      "src/index.js": "void require.cache;\nexport function publicApi() {}\n",
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      result.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name),
    ).toEqual(["publicApi"]);
  });

  test("discovers workspace members when the root manifest has no package name", async () => {
    const result = await scan({
      "package.json": JSON.stringify({ private: true, workspaces: ["packages/*"] }),
      "packages/api/package.json": JSON.stringify({
        exports: "./src/index.ts",
        name: "@fixture/api",
      }),
      "packages/api/src/index.ts":
        'import { model } from "@fixture/model";\nexport function api() { return model; }\n',
      "packages/model/package.json": JSON.stringify({
        exports: "./src/index.ts",
        name: "@fixture/model",
      }),
      "packages/model/src/index.ts": "export const model = true;\n",
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      result.snapshot?.records.some(
        (record) => record.kind === "relationship" && record.relationshipType === "imports",
      ),
    ).toBeTrue();
    expect(
      result.snapshot?.records.some(
        (record) => record.kind === "component-candidate" && record.candidate.type === "external",
      ),
    ).toBeFalse();
  });

  test("marks indirectly initialized function-typed public consts partial", async () => {
    const result = await scan({
      "package.json": JSON.stringify({ exports: "./src/index.ts", name: "typed-const" }),
      "src/index.ts": [
        "const createApi = () => () => true;",
        "export const indirectApi: () => boolean = createApi();",
        "export function safeApi() {}",
      ].join("\n"),
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      result.snapshot?.records
        .filter((record) => record.kind === "action")
        .map((record) => record.name),
    ).toEqual(["safeApi"]);
  });

  test("classifies bare Node builtins as runtime imports in source-only scopes", async () => {
    const result = await scan({
      "src/index.ts": 'import fs from "fs";\nvoid fs;\nexport function api() {}\n',
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("partial");
    expect(
      result.snapshot?.records.some(
        (record) =>
          record.kind === "component-candidate" &&
          record.candidate.type === "external" &&
          record.candidate.name === "node:fs",
      ),
    ).toBeTrue();
    expect(
      result.snapshot?.records.some(
        (record) => record.kind === "relationship" && record.relationshipType === "imports",
      ),
    ).toBeTrue();
  });

  test("normalizes a safe leading relative workspace pattern", async () => {
    const result = await scan({
      "package.json": JSON.stringify({ name: "@fixture/root", workspaces: ["./packages/*"] }),
      "packages/member/package.json": JSON.stringify({ name: "@fixture/member" }),
      "packages/member/src/index.ts": "export const member = true;\n",
    });

    expect(result.result.ok).toBeTrue();
    expect(result.snapshot?.coverage[0]?.state).toBe("complete");
    expect(
      result.snapshot?.records.some(
        (record) =>
          record.kind === "relationship" && record.relationshipType === "workspace-member",
      ),
    ).toBeTrue();
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
