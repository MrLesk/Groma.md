import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import {
  canonicalSchemaMigratorCapabilityId,
  checkPluginPackageCompatibility,
  pluginPackageManifestApiVersion,
  pluginRuntimeApiVersion,
  pluginSdkApiVersion,
  type RunningPluginGraph,
} from "groma/plugin-sdk";
import {
  createPluginRuntimeConformanceFixture,
  runPluginConformanceSuite,
  type PluginConformanceFixture,
} from "groma/plugin-sdk/conformance";

import {
  createPluginRegistrations,
  greetingCapability,
  packageManifest,
  presentationCapability,
  type GreetingCapability,
} from "./fixtures/conforming-plugin-package.ts";

describe("public plugin SDK", () => {
  test("supports a package using only the public self-reference", async () => {
    const source = await readFile(
      new URL("./fixtures/conforming-plugin-package.ts", import.meta.url),
      "utf8",
    );

    expect(source).toContain('from "groma/plugin-sdk"');
    expect(source).not.toContain("/src/");
    expect(source).not.toMatch(/\.\.\/.*(?:core|host|application|persistence|standard-model)/);
    expect(checkPluginPackageCompatibility(packageManifest)).toEqual({
      ok: true,
      value: {
        apiVersion: pluginPackageManifestApiVersion,
        name: "@example/groma-greeting",
        plugins: ["./plugins/greeting.js", "./plugins/presentation.js"],
        runtimeApiVersion: pluginRuntimeApiVersion,
        sdkApiVersion: pluginSdkApiVersion,
        version: "1.0.0",
      },
    });
  });

  test("keeps authoring and conformance on distinct public subpaths", async () => {
    const authoring = await import("groma/plugin-sdk");
    const conformance = await import("groma/plugin-sdk/conformance");

    expect("runPluginConformanceSuite" in authoring).toBeFalse();
    expect(canonicalSchemaMigratorCapabilityId).toBe("groma.schema-migrators/v1");
    expect(typeof conformance.runPluginConformanceSuite).toBe("function");
  });

  test("runs the reusable suite over a third-party-shaped package", async () => {
    const report = await runPluginConformanceSuite({
      fixture: createPluginRuntimeConformanceFixture(() => createPluginRegistrations()),
      providers: [
        {
          cardinality: "single",
          id: greetingCapability.id,
          pluginId: "example.greeting",
          verify: (value) => (value as GreetingCapability).greet("Ada") === "Hello, Ada.",
          version: greetingCapability.version,
        },
        {
          cardinality: "single",
          id: presentationCapability.id,
          pluginId: "example.presentation",
          verify: (value) =>
            (value as { readonly preview: () => string }).preview() === "Hello, Groma.",
          version: presentationCapability.version,
        },
      ],
    });

    expect(report).toEqual({
      cases: [
        { diagnostics: [], name: "deterministic-results", ok: true },
        { diagnostics: [], name: "lifecycle", ok: true },
        { diagnostics: [], name: "cancellation", ok: true },
        { diagnostics: [], name: "declared-cardinality", ok: true },
        { diagnostics: [], name: "provider-behavior", ok: true },
      ],
      diagnostics: [],
      ok: true,
    });
  });

  test("does not overlap deterministic graph instances", async () => {
    const base = createPluginRuntimeConformanceFixture(() => createPluginRegistrations());
    let activeGraphs = 0;
    let maximumActiveGraphs = 0;
    const exclusive: PluginConformanceFixture = {
      cancellationDiagnosticCode: "plugin-start-cancelled",
      start: async (request) => {
        if (activeGraphs !== 0) {
          return {
            diagnostics: [
              {
                code: "exclusive-resource-overlap",
                message: "A second graph tried to acquire an exclusive resource",
              },
            ],
            ok: false as const,
          };
        }
        const started = await base.start(request);
        if (!started.ok) return started;
        activeGraphs += 1;
        maximumActiveGraphs = Math.max(maximumActiveGraphs, activeGraphs);
        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          activeGraphs -= 1;
        };
        const graph: RunningPluginGraph = {
          cancel: async () => {
            try {
              return await started.value.cancel();
            } finally {
              release();
            }
          },
          capabilities: (id, version) => started.value.capabilities(id, version),
          inspect: () => started.value.inspect(),
          shutdown: async () => {
            try {
              return await started.value.shutdown();
            } finally {
              release();
            }
          },
        };
        return { ok: true as const, value: graph };
      },
    };

    const report = await runPluginConformanceSuite({ fixture: exclusive });

    expect(report.ok).toBeTrue();
    expect(report.diagnostics).toEqual([]);
    expect(maximumActiveGraphs).toBe(1);
    expect(activeGraphs).toBe(0);
  });

  test("reports deterministic, lifecycle, cancellation, cardinality, and provider defects", async () => {
    const onePlugin = (id: string, stop?: () => void) => {
      const original = createPluginRegistrations()[0]!;
      return [
        {
          ...original,
          manifest: { ...original.manifest, id },
          ...(stop === undefined
            ? {}
            : {
                start: () => ({
                  capabilities: [
                    {
                      id: greetingCapability.id,
                      value: { greet: (name: string) => `Hello, ${name}.` },
                      version: greetingCapability.version,
                    },
                  ],
                  stop,
                }),
              }),
        },
      ];
    };
    const forward = createPluginRuntimeConformanceFixture(() => onePlugin("example.forward"));
    const reverse = createPluginRuntimeConformanceFixture(() => onePlugin("example.reverse"));
    const changingFixture: PluginConformanceFixture = {
      cancellationDiagnosticCode: "plugin-start-cancelled",
      start: (request) =>
        (request.registrationOrder === "forward" ? forward : reverse).start(request),
    };
    const changing = await runPluginConformanceSuite({
      fixture: changingFixture,
      providers: [
        {
          cardinality: "single",
          id: greetingCapability.id,
          verify: () => false,
          version: greetingCapability.version,
        },
      ],
    });
    expect(
      changing.cases.find((item) => item.name === "deterministic-results")?.diagnostics,
    ).toMatchObject([{ code: "plugin-conformance-nondeterministic" }]);

    const orderedCapability = Object.freeze({
      cardinality: "multiple" as const,
      id: "example.ordered/v1",
      version: "1.0.0",
    });
    const orderedProvider = (id: string) => {
      const original = createPluginRegistrations()[0]!;
      return {
        ...original,
        manifest: {
          ...original.manifest,
          id,
          provides: [orderedCapability],
          requires: [],
        },
        start: () => ({
          capabilities: [
            {
              id: orderedCapability.id,
              value: Object.freeze({}),
              version: orderedCapability.version,
            },
          ],
        }),
      };
    };
    const orderedBase = createPluginRuntimeConformanceFixture(() => [
      orderedProvider("example.ordered-a"),
      orderedProvider("example.ordered-b"),
    ]);
    let forwardInspection: ReturnType<RunningPluginGraph["inspect"]> | undefined;
    let reverseInspection: ReturnType<RunningPluginGraph["inspect"]> | undefined;
    const changingProviderOrder: PluginConformanceFixture = {
      cancellationDiagnosticCode: "plugin-start-cancelled",
      start: async (request) => {
        const started = await orderedBase.start(request);
        if (!started.ok) return started;
        const base = started.value;
        const graph: RunningPluginGraph = {
          cancel: () => base.cancel(),
          capabilities: (id, version) => {
            const providers = base.capabilities(id, version);
            return request.registrationOrder === "reverse" ? [...providers].reverse() : providers;
          },
          inspect: () => {
            const inspection = base.inspect();
            if (request.registrationOrder === "reverse") reverseInspection = inspection;
            else forwardInspection = inspection;
            return inspection;
          },
          shutdown: () => base.shutdown(),
        };
        return { ok: true as const, value: graph };
      },
    };
    const providerOrder = await runPluginConformanceSuite({ fixture: changingProviderOrder });
    expect(forwardInspection).toEqual(reverseInspection);
    expect(
      providerOrder.cases.find((item) => item.name === "deterministic-results")?.diagnostics,
    ).toEqual([
      {
        code: "plugin-conformance-nondeterministic",
        message: "Equivalent registration sets produced different observable runtime snapshots",
      },
    ]);
    expect(
      changing.cases.find((item) => item.name === "provider-behavior")?.diagnostics,
    ).toMatchObject([{ code: "plugin-provider-conformance-failed" }]);

    const lifecycle = await runPluginConformanceSuite({
      fixture: createPluginRuntimeConformanceFixture(() =>
        onePlugin("example.lifecycle", () => {
          throw new Error("private cleanup failure");
        }),
      ),
    });
    expect(lifecycle.cases.find((item) => item.name === "lifecycle")?.diagnostics).toMatchObject([
      { code: "plugin-conformance-lifecycle-failed" },
      { code: "plugin-stop-failed" },
    ]);

    const ignoresCancellation: PluginConformanceFixture = {
      cancellationDiagnosticCode: "plugin-start-cancelled",
      start: (request) =>
        forward.start({
          ...request,
          cancellation: { isCancellationRequested: () => false },
        }),
    };
    const cancellation = await runPluginConformanceSuite({ fixture: ignoresCancellation });
    expect(
      cancellation.cases.find((item) => item.name === "cancellation")?.diagnostics,
    ).toMatchObject([{ code: "plugin-conformance-cancellation-failed" }]);

    const maskedCancellation: PluginConformanceFixture = {
      cancellationDiagnosticCode: "plugin-start-cancelled",
      start: (request) =>
        request.cancellation.isCancellationRequested()
          ? Promise.resolve({
              diagnostics: [
                { code: "plugin-start-cancelled", message: "Plugin startup was cancelled" },
                { code: "plugin-stop-failed", message: "Plugin cleanup also failed" },
              ],
              ok: false as const,
            })
          : forward.start(request),
    };
    const masked = await runPluginConformanceSuite({ fixture: maskedCancellation });
    expect(
      masked.cases
        .find((item) => item.name === "cancellation")
        ?.diagnostics.map((item) => item.code),
    ).toEqual(["plugin-conformance-cancellation-failed", "plugin-stop-failed"]);

    const mixedCardinality: PluginConformanceFixture = {
      cancellationDiagnosticCode: "plugin-start-cancelled",
      start: (request) => {
        if (request.cancellation.isCancellationRequested()) {
          return Promise.resolve({
            diagnostics: [
              { code: "plugin-start-cancelled", message: "Plugin startup was cancelled" },
            ],
            ok: false as const,
          });
        }
        let state: "running" | "stopped" = "running";
        const graph: RunningPluginGraph = {
          cancel: async () => ({
            ok: true,
            value: {
              state: "cancelled",
              stoppedPluginIds: ["mixed.single", "mixed.multiple"],
            },
          }),
          capabilities: (id, version) =>
            id === "example.mixed-cardinality/v1" && version === "1.0.0"
              ? [
                  { pluginId: "mixed.multiple", value: {} },
                  { pluginId: "mixed.single", value: {} },
                ]
              : [],
          inspect: () => ({
            apiVersion: pluginRuntimeApiVersion,
            plugins: [
              {
                dependencies: [],
                id: "mixed.multiple",
                phase: 1,
                provides: [
                  {
                    cardinality: "multiple",
                    id: "example.mixed-cardinality/v1",
                    version: "1.0.0",
                  },
                ],
                requires: [],
                state: state === "running" ? "running" : "stopped",
                version: "1.0.0",
              },
              {
                dependencies: [],
                id: "mixed.single",
                phase: 1,
                provides: [
                  {
                    cardinality: "single",
                    id: "example.mixed-cardinality/v1",
                    version: "1.0.0",
                  },
                ],
                requires: [],
                state: state === "running" ? "running" : "stopped",
                version: "1.0.0",
              },
            ],
            state,
          }),
          shutdown: async () => {
            state = "stopped";
            return {
              ok: true,
              value: {
                state: "stopped",
                stoppedPluginIds: ["mixed.single", "mixed.multiple"],
              },
            };
          },
        };
        return Promise.resolve({ ok: true as const, value: graph });
      },
    };
    const mixed = await runPluginConformanceSuite({ fixture: mixedCardinality });
    expect(
      mixed.cases.find((item) => item.name === "declared-cardinality")?.diagnostics,
    ).toMatchObject([{ code: "plugin-conformance-cardinality-failed" }]);

    const duplicateDeclaration: PluginConformanceFixture = {
      cancellationDiagnosticCode: "plugin-start-cancelled",
      start: async (request) => {
        const started = await forward.start(request);
        if (!started.ok) return started;
        const base = started.value;
        const graph: RunningPluginGraph = {
          cancel: () => base.cancel(),
          capabilities: (id, version) =>
            base.capabilities(id, version).flatMap((provider) => [provider, provider]),
          inspect: () => {
            const inspection = base.inspect();
            return {
              ...inspection,
              plugins: inspection.plugins.map((plugin) => ({
                ...plugin,
                provides: plugin.provides.flatMap((declaration) => {
                  const duplicated = { ...declaration, cardinality: "multiple" as const };
                  return [duplicated, duplicated];
                }),
              })),
            };
          },
          shutdown: () => base.shutdown(),
        };
        return { ok: true, value: graph };
      },
    };
    const duplicate = await runPluginConformanceSuite({ fixture: duplicateDeclaration });
    expect(
      duplicate.cases.find((item) => item.name === "declared-cardinality")?.diagnostics,
    ).toMatchObject([{ code: "plugin-conformance-cardinality-failed" }]);

    const collision = await runPluginConformanceSuite({
      fixture: createPluginRuntimeConformanceFixture(() => [
        ...onePlugin("example.collision-a"),
        ...onePlugin("example.collision-b"),
      ]),
    });
    expect(
      collision.cases.find((item) => item.name === "declared-cardinality")?.diagnostics,
    ).toMatchObject([{ code: "capability-provider-collision" }]);
  });

  test("returns stable package, SDK, runtime, and direct runtime compatibility diagnostics", () => {
    const incompatible = checkPluginPackageCompatibility({
      ...packageManifest,
      apiVersion: "groma.package/v2",
      runtimeApiVersion: "groma.plugin/v2",
      sdkApiVersion: "groma.sdk/v2",
    });

    expect(incompatible).toEqual({
      diagnostics: [
        {
          code: "unsupported-plugin-package-manifest-version",
          details: {
            actualVersion: "groma.package/v2",
            expectedVersion: pluginPackageManifestApiVersion,
          },
          message: "Plugin package manifest version is unsupported",
        },
        {
          code: "incompatible-plugin-sdk-version",
          details: { actualVersion: "groma.sdk/v2", expectedVersion: pluginSdkApiVersion },
          message: "Plugin SDK version is incompatible",
        },
        {
          code: "incompatible-plugin-runtime-version",
          details: {
            actualVersion: "groma.plugin/v2",
            expectedVersion: pluginRuntimeApiVersion,
          },
          message: "Plugin runtime API version is incompatible",
        },
      ],
      ok: false,
    });

    const runtime = createPluginRuntimeConformanceFixture(() => [
      {
        ...createPluginRegistrations()[0]!,
        manifest: { ...createPluginRegistrations()[0]!.manifest, apiVersion: "groma.plugin/v2" },
      },
    ]);
    return runtime
      .start({
        cancellation: { isCancellationRequested: () => false },
        registrationOrder: "forward",
      })
      .then((result) => {
        expect(result).toMatchObject({
          diagnostics: [
            {
              code: "incompatible-plugin-api-version",
              details: {
                actualVersion: "groma.plugin/v2",
                expectedVersion: pluginRuntimeApiVersion,
                pluginId: "example.greeting",
              },
            },
          ],
          ok: false,
        });
      });
  });

  test("fails closed on malformed package manifests before entry-point use", () => {
    for (const entry of [
      "../private.ts",
      "./%2e%2e/private.js",
      "./%2E%2E/private.js",
      "./plugins/%2fprivate.js",
      "./plugins/%5Cprivate.js",
      "./plugins/plugin.js?debug=true",
      "./plugins/plugin.js#fragment",
      "./plugins/plugin\n.js",
      "./plugins/trailing.",
    ]) {
      expect(
        checkPluginPackageCompatibility({ ...packageManifest, plugins: [entry] }),
      ).toMatchObject({
        diagnostics: [{ code: "invalid-plugin-package-manifest" }],
        ok: false,
      });
    }
    const withSurprise = checkPluginPackageCompatibility({ ...packageManifest, surprise: true });
    expect(withSurprise).toMatchObject({ ok: true, value: packageManifest });
    if (!withSurprise.ok) throw new Error("manifest with ignored source property failed");
    expect(Object.isFrozen(withSurprise.value)).toBeTrue();
    expect("surprise" in withSurprise.value).toBeFalse();

    const missingVersion: Record<string, unknown> = { ...packageManifest };
    delete missingVersion.version;
    expect(checkPluginPackageCompatibility(missingVersion)).toMatchObject({
      diagnostics: [{ code: "invalid-plugin-package-manifest" }],
      ok: false,
    });

    const revokedManifest = Proxy.revocable({}, {});
    revokedManifest.revoke();
    const revokedPlugins = Proxy.revocable([], {});
    revokedPlugins.revoke();
    for (const value of [
      revokedManifest.proxy,
      { ...packageManifest, plugins: revokedPlugins.proxy },
    ]) {
      expect(checkPluginPackageCompatibility(value)).toMatchObject({
        diagnostics: [{ code: "invalid-plugin-package-manifest" }],
        ok: false,
      });
    }

    const manifestTarget = { ...packageManifest };
    Object.defineProperty(manifestTarget, "ignored", {
      enumerable: true,
      get: () => {
        throw new Error("unknown manifest properties must not be read");
      },
    });
    let manifestOwnKeysInvoked = false;
    const manifestProxy = new Proxy(manifestTarget, {
      ownKeys: () => {
        manifestOwnKeysInvoked = true;
        throw new Error("manifest keys must not be enumerated");
      },
    });
    const canonicalManifest = checkPluginPackageCompatibility(manifestProxy);
    expect(canonicalManifest).toMatchObject({ ok: true, value: packageManifest });
    expect(manifestOwnKeysInvoked).toBeFalse();
    if (!canonicalManifest.ok) throw new Error("bounded manifest proxy unexpectedly failed");
    expect(canonicalManifest.value).not.toBe(manifestProxy);
    expect(Object.isFrozen(canonicalManifest.value)).toBeTrue();
    expect(Reflect.ownKeys(canonicalManifest.value)).toEqual([
      "apiVersion",
      "name",
      "plugins",
      "runtimeApiVersion",
      "sdkApiVersion",
      "version",
    ]);
    expect("ignored" in canonicalManifest.value).toBeFalse();

    const boundedTarget = ["./plugins/bounded.js"];
    Object.defineProperty(boundedTarget, "ignored", {
      enumerable: true,
      value: "must not survive canonicalization",
    });
    let boundedOwnKeysInvoked = false;
    const boundedPlugins = new Proxy(boundedTarget, {
      ownKeys: () => {
        boundedOwnKeysInvoked = true;
        throw new Error("bounded plugin entries must not enumerate arbitrary keys");
      },
    });
    const bounded = checkPluginPackageCompatibility({
      ...packageManifest,
      plugins: boundedPlugins,
    });
    expect(bounded).toMatchObject({
      ok: true,
      value: { plugins: ["./plugins/bounded.js"] },
    });
    expect(boundedOwnKeysInvoked).toBeFalse();
    if (!bounded.ok) throw new Error("bounded proxy manifest unexpectedly failed");
    expect(bounded.value.plugins).not.toBe(boundedPlugins);
    expect(Object.isFrozen(bounded.value.plugins)).toBeTrue();
    expect(Reflect.ownKeys(bounded.value.plugins)).toEqual(["0", "length"]);

    let oversizedOwnKeysInvoked = false;
    const oversizedPlugins = new Proxy(new Array(65), {
      ownKeys: () => {
        oversizedOwnKeysInvoked = true;
        throw new Error("oversized plugin entries must not be enumerated");
      },
    });
    expect(
      checkPluginPackageCompatibility({ ...packageManifest, plugins: oversizedPlugins }),
    ).toMatchObject({
      diagnostics: [{ code: "invalid-plugin-package-manifest" }],
      ok: false,
    });
    expect(oversizedOwnKeysInvoked).toBeFalse();

    const maximumVersion = `${"9".repeat(124)}.0.0`;
    expect(maximumVersion).toHaveLength(128);
    expect(
      checkPluginPackageCompatibility({ ...packageManifest, version: maximumVersion }),
    ).toMatchObject({
      ok: true,
      value: { version: maximumVersion },
    });
    expect(
      checkPluginPackageCompatibility({ ...packageManifest, version: `${"9".repeat(125)}.0.0` }),
    ).toMatchObject({
      diagnostics: [{ code: "invalid-plugin-package-manifest" }],
      ok: false,
    });
  });
});
