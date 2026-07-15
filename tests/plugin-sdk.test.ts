import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import {
  checkPluginPackageCompatibility,
  createPluginRuntimeConformanceFixture,
  pluginPackageManifestApiVersion,
  pluginRuntimeApiVersion,
  pluginSdkApiVersion,
  runPluginConformanceSuite,
  type PluginConformanceFixture,
  type RunningPluginGraph,
} from "groma/plugin-sdk";

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
    expect(checkPluginPackageCompatibility({ ...packageManifest, surprise: true })).toMatchObject({
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
