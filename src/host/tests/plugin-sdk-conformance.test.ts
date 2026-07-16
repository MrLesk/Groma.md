import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createPluginRuntimeConformanceFixture,
  runPluginConformanceSuite,
  type PluginConformanceFixture,
  type PluginConformanceFixtureRequest,
  type PluginProviderConformanceCheck,
} from "groma/plugin-sdk/conformance";

import { pluginRuntimeApiVersion, type PluginRegistration } from "../../core/index.ts";
import { parseWorkspaceResourceLocator } from "../../persistence/index.ts";
import {
  createDefaultBootstrapRegistry,
  defaultHostCapabilityIds,
  defaultHostPluginIds,
} from "../index.ts";

const capabilityVersion = "1.0.0";
const hostCancellationDiagnosticCode = "host-start-cancelled";
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

function hasMethod(value: unknown, name: string): boolean {
  return (
    (typeof value === "object" &&
      value !== null &&
      typeof Reflect.get(value, name) === "function") ||
    (typeof value === "function" && typeof Reflect.get(value, name) === "function")
  );
}

function check(
  id: string,
  pluginId: string,
  verify: PluginProviderConformanceCheck["verify"],
): PluginProviderConformanceCheck {
  return Object.freeze({
    cardinality: "single",
    id,
    pluginId,
    verify,
    version: capabilityVersion,
  });
}

function checkMultiple(
  id: string,
  pluginId: string,
  verify: PluginProviderConformanceCheck["verify"],
): PluginProviderConformanceCheck {
  return Object.freeze({
    cardinality: "multiple",
    id,
    pluginId,
    verify,
    version: capabilityVersion,
  });
}

function projectionReadCheck(pluginId: string): PluginProviderConformanceCheck {
  return check(defaultHostCapabilityIds.projectionRead, pluginId, async (value) => {
    if (
      ![
        "exactCatalogEntry",
        "exactEntities",
        "exactEntity",
        "identity",
        "pageCatalog",
        "pageRelations",
      ].every((name) => hasMethod(value, name))
    ) {
      return false;
    }
    const projection = value as {
      identity(): Promise<{
        readonly ok: boolean;
        readonly value?: { readonly fingerprint: string; readonly generation: number };
      }>;
      pageCatalog(
        identity: unknown,
        request: unknown,
      ): Promise<{
        readonly ok: boolean;
        readonly value?: {
          readonly hasMore: boolean;
          readonly identity: { readonly fingerprint: string; readonly generation: number };
          readonly items: readonly unknown[];
        };
      }>;
    };
    const identity = await projection.identity();
    if (!identity.ok || identity.value === undefined) return false;
    const page = await projection.pageCatalog(identity.value, { limit: 1 });
    return (
      page.ok &&
      page.value?.hasMore === false &&
      page.value.items.length === 0 &&
      page.value.identity.fingerprint === identity.value.fingerprint &&
      page.value.identity.generation === identity.value.generation
    );
  });
}

describe("default host plugin SDK conformance", () => {
  test("runs every applicable built-in provider through the public suite", async () => {
    let normalizedCancellationEvidence = false;
    const fixture: PluginConformanceFixture = Object.freeze({
      cancellationDiagnosticCode: hostCancellationDiagnosticCode,
      start: async (request: PluginConformanceFixtureRequest) => {
        const workspaceRoot = await mkdtemp(path.join(tmpdir(), "groma-sdk-host-"));
        roots.push(workspaceRoot);
        const controller = new AbortController();
        if (request.cancellation.isCancellationRequested()) controller.abort();
        const composed = await createDefaultBootstrapRegistry({
          entropy: (length) => new Uint8Array(length),
          surface: {
            start: () => ({ completion: Promise.resolve(), stop: async () => {} }),
          },
        }).compose({ cancellation: controller.signal, workspaceRoot });
        if (!composed.ok) {
          const item = composed.diagnostics[0];
          if (
            request.cancellation.isCancellationRequested() &&
            composed.diagnostics.length === 1 &&
            item?.code === "host-composition-failed" &&
            item.message === "Bootstrap plugin startup failed" &&
            item.details === undefined
          ) {
            // This is test-adapter evidence, not a Host diagnostic rewrite. The same
            // fixture must start successfully for every uncancelled conformance case,
            // and only this exact wrapper from an already-aborted Phase-0 start maps.
            normalizedCancellationEvidence = true;
            return {
              diagnostics: [
                {
                  code: hostCancellationDiagnosticCode,
                  message: "Default host startup was cancelled before composition completed",
                },
              ],
              ok: false as const,
            };
          }
          return composed;
        }
        return composed.value.plugins === undefined
          ? {
              diagnostics: [
                {
                  code: "plugin-conformance-fixture-failed",
                  message: "Default host did not expose its running plugin graph",
                },
              ],
              ok: false as const,
            }
          : { ok: true as const, value: composed.value.plugins };
      },
    });
    const rootLocator = parseWorkspaceResourceLocator(".");
    if (!rootLocator.ok) throw new Error("test root locator is invalid");
    const providers: readonly PluginProviderConformanceCheck[] = Object.freeze([
      check(
        defaultHostCapabilityIds.configurationParser,
        defaultHostPluginIds.configurationParser,
        (value) => {
          if (!hasMethod(value, "parse")) return false;
          return (value as { parse(bytes: Uint8Array): { readonly ok: boolean } }).parse(
            new TextEncoder().encode("schema: groma/v0.1\nplugins: []\n"),
          ).ok;
        },
      ),
      check(defaultHostCapabilityIds.resources, defaultHostPluginIds.resources, async (value) => {
        if (!hasMethod(value, "enumerate")) return false;
        const result = await (
          value as {
            enumerate(request: unknown): Promise<{
              readonly ok: boolean;
              readonly value?: { readonly entries: readonly unknown[] };
            }>;
          }
        ).enumerate({
          limit: 1,
          locator: rootLocator.value,
          maxDepth: 0,
          maxEntriesPerDirectory: 1,
        });
        return result.ok && result.value?.entries.length === 0;
      }),
      check(
        defaultHostCapabilityIds.configurationDiscovery,
        defaultHostPluginIds.configurationDiscovery,
        async (value) => {
          if (!hasMethod(value, "discover")) return false;
          const result = await (
            value as {
              discover(): Promise<{
                readonly ok: boolean;
                readonly value?: readonly unknown[];
              }>;
            }
          ).discover();
          return result.ok && result.value?.length === 0;
        },
      ),
      check(defaultHostCapabilityIds.graph, defaultHostPluginIds.kernel, (value) => {
        if (!hasMethod(value, "empty")) return false;
        const snapshot = (value as { empty(): unknown }).empty();
        return typeof snapshot === "object" && snapshot !== null;
      }),
      check(defaultHostCapabilityIds.queries, defaultHostPluginIds.kernel, (value) => {
        if (!hasMethod(value, "exact")) return false;
        return (
          value as { exact(generation: number, item: unknown): { readonly ok: boolean } }
        ).exact(0, { marker: "conformance" }).ok;
      }),
      check(defaultHostCapabilityIds.invariant, defaultHostPluginIds.model, (value) => {
        return (
          typeof value === "object" &&
          value !== null &&
          typeof Reflect.get(value, "id") === "string" &&
          hasMethod(value, "validate")
        );
      }),
      check(defaultHostCapabilityIds.model, defaultHostPluginIds.model, (value) => {
        if (!hasMethod(value, "normalize")) return false;
        return (value as { normalize(input: unknown): { readonly ok: boolean } }).normalize({
          name: "Conformance",
          type: "domain",
        }).ok;
      }),
      check(defaultHostCapabilityIds.store, defaultHostPluginIds.persistence, async (value) => {
        if (!hasMethod(value, "load")) return false;
        return (await (value as { load(): Promise<{ readonly ok: boolean }> }).load()).ok;
      }),
      check(defaultHostCapabilityIds.projection, defaultHostPluginIds.projection, async (value) => {
        if (!hasMethod(value, "load")) return false;
        const result = await (
          value as {
            load(): Promise<{ readonly ok: boolean; readonly value?: { generation: number } }>;
          }
        ).load();
        return result.ok && result.value?.generation === 0;
      }),
      projectionReadCheck(defaultHostPluginIds.projection),
      check(
        defaultHostCapabilityIds.queryEngine,
        defaultHostPluginIds.queryEngine,
        async (value) => {
          if (!hasMethod(value, "pageEntities")) return false;
          const result = await (
            value as {
              pageEntities(
                query: unknown,
                request: unknown,
              ): Promise<{
                readonly ok: boolean;
                readonly value?: {
                  readonly generation: number;
                  readonly items: readonly unknown[];
                };
              }>;
            }
          ).pageEntities({ kind: "component" }, { limit: 1 });
          return result.ok && result.value?.generation === 0 && result.value.items.length === 0;
        },
      ),
      check(
        defaultHostCapabilityIds.schemaMigrationCatalog,
        defaultHostPluginIds.persistence,
        async (value) =>
          hasMethod(value, "inspect") &&
          hasMethod(value, "load") &&
          (await (value as { load(): Promise<{ readonly ok: boolean }> }).load()).ok,
      ),
      check(
        defaultHostCapabilityIds.schemaMigrationTransactionProvider,
        defaultHostPluginIds.persistence,
        async (value) => {
          if (!hasMethod(value, "snapshot")) return false;
          return (
            typeof (await (
              value as { snapshot(resources: readonly unknown[]): Promise<unknown> }
            ).snapshot([])) === "object"
          );
        },
      ),
      checkMultiple(
        defaultHostCapabilityIds.schemaMigrators,
        defaultHostPluginIds.schemaMigrations,
        (value) =>
          typeof value === "object" &&
          value !== null &&
          Array.isArray(Reflect.get(value, "schemas")) &&
          Array.isArray(Reflect.get(value, "migrators")),
      ),
      check(
        defaultHostCapabilityIds.transactionProvider,
        defaultHostPluginIds.persistence,
        async (value) => {
          if (!hasMethod(value, "snapshot")) return false;
          const snapshot = await (
            value as { snapshot(resources: readonly unknown[]): Promise<unknown> }
          ).snapshot([]);
          return typeof snapshot === "object" && snapshot !== null;
        },
      ),
      check(defaultHostCapabilityIds.resourceMapper, defaultHostPluginIds.application, (value) => {
        if (!hasMethod(value, "resourceForComponent")) return false;
        return !(
          value as { resourceForComponent(id: string): { readonly ok: boolean } }
        ).resourceForComponent("not-an-entity").ok;
      }),
      check(
        defaultHostCapabilityIds.snapshotStateDecoder,
        defaultHostPluginIds.application,
        (value) => hasMethod(value, "decode") && hasMethod(value, "normalizeComponent"),
      ),
      check(
        defaultHostCapabilityIds.transactionEngine,
        defaultHostPluginIds.application,
        (value) => hasMethod(value, "execute") && hasMethod(value, "registerInvariant"),
      ),
      check(
        defaultHostCapabilityIds.operations,
        defaultHostPluginIds.application,
        (value) => hasMethod(value, "initialize") && hasMethod(value, "listComponents"),
      ),
      check(
        defaultHostCapabilityIds.schemaMigrationOperations,
        defaultHostPluginIds.application,
        (value) =>
          hasMethod(value, "status") && hasMethod(value, "preview") && hasMethod(value, "apply"),
      ),
      check(defaultHostCapabilityIds.workspace, defaultHostPluginIds.application, (value) => {
        if (!hasMethod(value, "status")) return false;
        return (value as { status(): { readonly state: string } }).status().state === "missing";
      }),
      check(defaultHostCapabilityIds.surface, defaultHostPluginIds.surface, (value) =>
        hasMethod(value, "start"),
      ),
    ]);

    const report = await runPluginConformanceSuite({ fixture, providers });

    expect(providers).toHaveLength(Object.keys(defaultHostCapabilityIds).length);
    expect(report.ok).toBeTrue();
    expect(report.diagnostics).toEqual([]);
    expect(normalizedCancellationEvidence).toBeTrue();
    expect(report.cases.map((item) => item.name)).toEqual([
      "deterministic-results",
      "lifecycle",
      "cancellation",
      "declared-cardinality",
      "provider-behavior",
    ]);
  });

  test("rejects an index-only replacement before bounded query use", async () => {
    let consumerStarts = 0;
    let indexMethodCalls = 0;
    const indexOnly = Object.freeze({
      load: async () => {
        indexMethodCalls += 1;
        return { diagnostics: [], ok: false as const };
      },
      rebuild: async () => {
        indexMethodCalls += 1;
        return { diagnostics: [], ok: false as const };
      },
      update: async () => {
        indexMethodCalls += 1;
        return { diagnostics: [], ok: false as const };
      },
    });
    const declaration = (id: string) => ({
      cardinality: "single" as const,
      id,
      version: capabilityVersion,
    });
    const indexProvider: PluginRegistration = {
      manifest: {
        apiVersion: pluginRuntimeApiVersion,
        id: "official.test-projection-index",
        phase: 1,
        provides: [declaration(defaultHostCapabilityIds.projection)],
        requires: [],
        version: capabilityVersion,
      },
      start: () => ({
        capabilities: [
          {
            id: defaultHostCapabilityIds.projection,
            value: indexOnly,
            version: capabilityVersion,
          },
        ],
      }),
    };
    const readConsumer: PluginRegistration = {
      manifest: {
        apiVersion: pluginRuntimeApiVersion,
        id: "official.test-query-engine",
        phase: 1,
        provides: [],
        requires: [declaration(defaultHostCapabilityIds.projectionRead)],
        version: capabilityVersion,
      },
      start: () => {
        consumerStarts += 1;
        return { capabilities: [] };
      },
    };
    const unresolved = await createPluginRuntimeConformanceFixture(() => [
      indexProvider,
      readConsumer,
    ]).start({
      cancellation: { isCancellationRequested: () => false },
      registrationOrder: "forward",
    });

    expect(unresolved).toMatchObject({
      diagnostics: [
        {
          code: "missing-capability-provider",
          details: {
            capabilityId: defaultHostCapabilityIds.projectionRead,
            pluginId: "official.test-query-engine",
            requiredVersion: capabilityVersion,
          },
        },
      ],
      ok: false,
    });
    expect(consumerStarts).toBe(0);

    const falselyAdvertisedRead: PluginRegistration = {
      manifest: {
        ...indexProvider.manifest,
        id: "official.test-projection-read",
        provides: [declaration(defaultHostCapabilityIds.projectionRead)],
      },
      start: () => ({
        capabilities: [
          {
            id: defaultHostCapabilityIds.projectionRead,
            value: indexOnly,
            version: capabilityVersion,
          },
        ],
      }),
    };
    const report = await runPluginConformanceSuite({
      fixture: createPluginRuntimeConformanceFixture(() => [falselyAdvertisedRead]),
      providers: [projectionReadCheck("official.test-projection-read")],
    });

    expect(report.ok).toBeFalse();
    expect(report.cases.filter((item) => !item.ok).map((item) => item.name)).toEqual([
      "provider-behavior",
    ]);
    expect(report.diagnostics).toEqual([
      {
        code: "plugin-provider-conformance-failed",
        details: {
          capabilityId: defaultHostCapabilityIds.projectionRead,
          pluginId: "official.test-projection-read",
          version: capabilityVersion,
        },
        message: "Provider failed its capability-specific conformance check",
      },
    ]);
    expect(indexMethodCalls).toBe(0);
  });
});
