import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { pluginRuntimeApiVersion, success, type PluginRegistration } from "../../core/index.ts";
import { allowsCustomLocalCoordinationRoot } from "../../persistence/index.ts";
import {
  bootstrapConfigurationBounds,
  createDefaultBootstrapRegistry,
  createYamlConfigurationParser,
  defaultHostCapabilityIds,
  defaultHostPluginIds,
  loadBootstrapConfiguration,
  localBootstrapConvention,
  localWorkspaceLocator,
  parseBootstrapConfiguration,
  serializeBootstrapConfiguration,
  bootstrapConfigurationStillUsable,
  type ConfigurationDiscoveryProvider,
  type HostSurface,
  type WorkspaceConfigurationCandidate,
} from "../index.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function temporaryWorkspace() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "groma-bootstrap-"));
  roots.push(workspaceRoot);
  if (!allowsCustomLocalCoordinationRoot(process.platform)) return { workspaceRoot };
  const coordinationRoot = await mkdtemp(path.join(tmpdir(), "groma-bootstrap-coordination-"));
  roots.push(coordinationRoot);
  return { coordinationRoot, workspaceRoot };
}

function idleSurface(): HostSurface {
  return Object.freeze({
    start: () => ({ completion: Promise.resolve(), stop: async () => {} }),
  });
}

async function trustedLocalPackageFixture(
  context: Awaited<ReturnType<typeof temporaryWorkspace>>,
  counterKey: string,
  providedCapabilityId?: string,
  providedCapabilityCardinality: "multiple" | "single" = "single",
): Promise<{ readonly configurationFile: string; readonly userDataRoot: string }> {
  const userDataRoot = await mkdtemp(path.join(tmpdir(), "groma-bootstrap-user-"));
  roots.push(userDataRoot);
  const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
  const packageRoot = path.join(context.workspaceRoot, "plugins", "selector-probe");
  await mkdir(path.dirname(configurationFile), { recursive: true });
  await mkdir(path.join(packageRoot, "plugins"), { recursive: true });
  await writeFile(configurationFile, "schema: groma/v0.1\n");
  await writeFile(
    path.join(packageRoot, "groma.package.json"),
    `${JSON.stringify({
      apiVersion: "groma.package/v1",
      name: "example-selector-probe",
      plugins: ["./plugins/probe.js"],
      runtimeApiVersion: "groma.plugin/v1",
      sdkApiVersion: "groma.sdk/v1",
      version: "1.0.0",
    })}\n`,
  );
  await writeFile(
    path.join(packageRoot, "plugins", "probe.js"),
    `const key = Symbol.for(${JSON.stringify(counterKey)});
globalThis[key] = (globalThis[key] ?? 0) + 1;
export const plugin = Object.freeze({
  manifest: Object.freeze({
    apiVersion: "groma.plugin/v1",
    id: "example.selector-probe",
    phase: 1,
    provides: Object.freeze(${JSON.stringify(
      providedCapabilityId === undefined
        ? []
        : [
            {
              cardinality: providedCapabilityCardinality,
              id: providedCapabilityId,
              version: "1.0.0",
            },
          ],
    )}),
    requires: Object.freeze([]),
    version: "1.0.0"
  }),
  start: () => Object.freeze({ capabilities: Object.freeze(${JSON.stringify(
    providedCapabilityId === undefined
      ? []
      : [{ id: providedCapabilityId, value: "local", version: "1.0.0" }],
  )}) })
});\n`,
  );
  const setupRegistry = createDefaultBootstrapRegistry({
    ...(context.coordinationRoot === undefined
      ? {}
      : { coordinationRoot: context.coordinationRoot }),
    loadLocalPluginPackages: false,
    surface: idleSurface(),
    userDataRoot,
  });
  const composed = await setupRegistry.compose({ workspaceRoot: context.workspaceRoot });
  if (!composed.ok) throw new Error(composed.diagnostics[0]?.code);
  expect(
    await composed.value.packages.add({
      scope: "blueprint",
      source: "./plugins/selector-probe",
    }),
  ).toMatchObject({ ok: true });
  expect(
    await composed.value.packages.enable({
      entry: "./plugins/probe.js",
      name: "example-selector-probe",
      scope: "blueprint",
      trustFullUserPermissions: true,
    }),
  ).toMatchObject({ ok: true });
  expect(await composed.value.plugins?.shutdown()).toMatchObject({ ok: true });
  Reflect.set(globalThis, Symbol.for(counterKey), 0);
  return { configurationFile, userDataRoot };
}

describe("bootstrap configuration", () => {
  test("uses one deterministic portable locator across every supported target convention", () => {
    const targets = [
      {
        architecture: "arm64" as const,
        expected: "/Users/alex/project/groma/groma.yaml",
        platform: "darwin" as const,
        workspaceRoot: "/Users/alex/project",
      },
      {
        architecture: "x64" as const,
        expected: "/Users/alex/project/groma/groma.yaml",
        platform: "darwin" as const,
        workspaceRoot: "/Users/alex/project",
      },
      {
        architecture: "x64" as const,
        expected: "/srv/project/groma/groma.yaml",
        platform: "linux" as const,
        workspaceRoot: "/srv/project",
      },
      {
        architecture: "arm64" as const,
        expected: "/srv/project/groma/groma.yaml",
        platform: "linux" as const,
        workspaceRoot: "/srv/project",
      },
      {
        architecture: "x64" as const,
        expected: "C:\\project\\groma\\groma.yaml",
        platform: "win32" as const,
        workspaceRoot: "C:\\project",
      },
      {
        architecture: "arm64" as const,
        expected: "D:\\project\\groma\\groma.yaml",
        platform: "win32" as const,
        workspaceRoot: "D:\\project",
      },
    ];
    for (const target of targets) {
      const result = localBootstrapConvention(target);
      expect(result.ok, `${target.platform}-${target.architecture}`).toBeTrue();
      if (!result.ok) continue;
      expect(result.value).toEqual({
        absoluteConfigurationPath: target.expected,
        configurationLocator: localWorkspaceLocator.configuration,
        workspaceRoot: target.workspaceRoot,
      });
    }
    expect(
      localBootstrapConvention({
        architecture: "riscv64" as never,
        platform: "linux",
        workspaceRoot: "/srv/project",
      }),
    ).toEqual({
      diagnostics: [
        {
          code: "unsupported-bootstrap-target",
          message: "Workspace bootstrap does not support this runtime platform or architecture",
        },
      ],
      ok: false,
    });
    expect(
      localBootstrapConvention({
        architecture: "arm64",
        platform: "darwin",
        workspaceRoot: "relative/workspace",
      }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-bootstrap-workspace-root" }], ok: false });
  });

  test("parses the legacy marker and bounded requested plugin selection deterministically", () => {
    const parser = createYamlConfigurationParser();
    const legacy = parser.parse(new TextEncoder().encode("schema: groma/v0.1\n"));
    expect(legacy).toEqual({
      ok: true,
      value: { packageDeclarations: [], requestedRuntimePlugins: [], schema: "groma/v0.1" },
    });
    const extended = parser.parse(
      new TextEncoder().encode(
        "schema: groma/v0.1\nplugins:\n  - official.zeta\n  - acme.policy\n  - official.alpha\n",
      ),
    );
    expect(extended).toEqual({
      ok: true,
      value: {
        packageDeclarations: [],
        requestedRuntimePlugins: [
          { id: "acme.policy", namespace: "project" },
          { id: "official.alpha", namespace: "official" },
          { id: "official.zeta", namespace: "official" },
        ],
        schema: "groma/v0.1",
      },
    });
    const packages = parser.parse(
      new TextEncoder().encode(
        'schema: groma/v0.1\npackages:\n  - name: "example-zeta"\n    source: "./plugins/zeta"\n    enabled: ["./z.js", "./a.js"]\n  - name: "@example/alpha"\n    source: "./plugins/alpha"\n    enabled: []\n',
      ),
    );
    expect(packages).toEqual({
      ok: true,
      value: {
        packageDeclarations: [
          { enabled: [], name: "@example/alpha", source: "./plugins/alpha" },
          {
            enabled: ["./a.js", "./z.js"],
            name: "example-zeta",
            source: "./plugins/zeta",
          },
        ],
        requestedRuntimePlugins: [],
        schema: "groma/v0.1",
      },
    });
    expect(parser.parse(new TextEncoder().encode("schema: incompatible/v9\n"))).toMatchObject({
      diagnostics: [{ code: "workspace-configuration-conflict" }],
      ok: false,
    });
    for (const source of [
      "schema: groma/v0.1\nplugins: official.alpha\n",
      "schema: groma/v0.1\nplugins: [official.alpha, official.alpha]\n",
      'schema: groma/v0.1\npackages:\n  - name: "example"\n    source: "npm:example@1.0.0"\n    enabled: []\n',
      'schema: groma/v0.1\npackages:\n  - name: "example"\n    source: "./plugins/example"\n    enabled: ["../escape.js"]\n',
      'schema: groma/v0.1\npackages:\n  - name: "example"\n    source: "./plugins/example"\n    enabled: []\n    extra: true\n',
      "schema: groma/v0.1\nunknown: true\n",
      "schema: &schema groma/v0.1\n",
      "schema: !!str groma/v0.1\n",
      "schema: &schema groma/v0.1\nplugins: [*schema]\n",
      "schema: [\n",
    ]) {
      expect(parser.parse(new TextEncoder().encode(source))).toMatchObject({
        diagnostics: [{ code: "workspace-configuration-malformed" }],
        ok: false,
      });
    }
  });

  test("canonicalizes parser results once and checks expected state remains usable", () => {
    const parser = createYamlConfigurationParser();
    const alpha = parseBootstrapConfiguration(
      parser,
      new TextEncoder().encode("schema: groma/v0.1\nplugins: [official.alpha]\n"),
    );
    const beta = parseBootstrapConfiguration(
      parser,
      new TextEncoder().encode("schema: groma/v0.1\nplugins: [official.beta]\n"),
    );
    const empty = parseBootstrapConfiguration(
      parser,
      new TextEncoder().encode("schema: groma/v0.1\n"),
    );
    const packagesOnly = parseBootstrapConfiguration(
      parser,
      new TextEncoder().encode(
        'schema: groma/v0.1\npackages:\n  - name: "example"\n    source: "./plugins/example"\n    enabled: []\n',
      ),
    );
    expect(alpha.ok).toBeTrue();
    expect(beta.ok).toBeTrue();
    expect(empty.ok).toBeTrue();
    expect(packagesOnly.ok).toBeTrue();
    if (!alpha.ok || !beta.ok || !empty.ok || !packagesOnly.ok) return;
    const missing = Object.freeze({ locator: localWorkspaceLocator, state: "missing" as const });
    const configured = (configuration: typeof alpha.value) =>
      Object.freeze({
        configuration,
        locator: localWorkspaceLocator,
        state: "configured" as const,
      });

    expect(
      bootstrapConfigurationStillUsable(configured(alpha.value), configured(alpha.value)),
    ).toBeTrue();
    expect(
      bootstrapConfigurationStillUsable(configured(alpha.value), configured(beta.value)),
    ).toBeFalse();
    expect(bootstrapConfigurationStillUsable(configured(alpha.value), missing)).toBeFalse();
    expect(bootstrapConfigurationStillUsable(missing, configured(empty.value))).toBeTrue();
    expect(bootstrapConfigurationStillUsable(missing, configured(packagesOnly.value))).toBeFalse();
    expect(bootstrapConfigurationStillUsable(missing, configured(alpha.value))).toBeFalse();
    expect(
      parseBootstrapConfiguration(
        {
          parse: () =>
            success({
              requestedRuntimePlugins: [{ id: "official.alpha", namespace: "project" }],
              schema: "groma/v0.1",
            } as never),
        },
        new Uint8Array(),
      ),
    ).toMatchObject({
      diagnostics: [{ code: "workspace-configuration-parser-failed" }],
      ok: false,
    });

    const boundaryEntries = Array.from(
      { length: bootstrapConfigurationBounds.maxEnabledLocalPlugins },
      (_, index) => `./entry-${index}.js`,
    );
    expect(
      parser.parse(
        new TextEncoder().encode(
          `schema: groma/v0.1\npackages:\n  - name: example\n    source: ./plugins/example\n    enabled: ${JSON.stringify(boundaryEntries)}\n`,
        ),
      ),
    ).toMatchObject({ ok: true });
    expect(
      parser.parse(
        new TextEncoder().encode(
          `schema: groma/v0.1\npackages:\n  - name: example\n    source: ./plugins/example\n    enabled: ${JSON.stringify([...boundaryEntries, "./overflow.js"])}\n`,
        ),
      ),
    ).toMatchObject({
      diagnostics: [{ code: "workspace-configuration-malformed" }],
      ok: false,
    });
  });

  test("contains hostile replacement-parser package declarations and enabled entries", () => {
    expect(
      parseBootstrapConfiguration(
        {
          parse: () =>
            success({
              packageDeclarations: [
                {
                  enabled: ["./plugins/entry.js"],
                  name: "example",
                  source: "./plugins/example",
                },
              ],
              requestedRuntimePlugins: [],
              schema: "groma/v0.1",
            }),
        },
        new Uint8Array(),
      ),
    ).toEqual({
      ok: true,
      value: {
        packageDeclarations: [
          {
            enabled: ["./plugins/entry.js"],
            name: "example",
            source: "./plugins/example",
          },
        ],
        requestedRuntimePlugins: [],
        schema: "groma/v0.1",
      },
    });

    let getterCalls = 0;
    let traps = 0;
    const accessorPackage = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(accessorPackage, {
      enabled: {
        enumerable: true,
        get: () => {
          getterCalls += 1;
          return [];
        },
      },
      name: { enumerable: true, value: "example" },
      source: { enumerable: true, value: "./plugins/example" },
    });
    const proxiedPackages = new Proxy([], {
      getOwnPropertyDescriptor: () => {
        traps += 1;
        throw new Error("private package proxy trap");
      },
    });
    const proxiedEnabled = new Proxy([], {
      getOwnPropertyDescriptor: () => {
        traps += 1;
        throw new Error("private enabled proxy trap");
      },
    });
    for (const packageDeclarations of [
      proxiedPackages,
      [accessorPackage],
      [{ enabled: proxiedEnabled, name: "example", source: "./plugins/example" }],
    ]) {
      expect(
        parseBootstrapConfiguration(
          {
            parse: () =>
              success({
                packageDeclarations,
                requestedRuntimePlugins: [],
                schema: "groma/v0.1",
              } as never),
          },
          new Uint8Array(),
        ),
      ).toEqual({
        diagnostics: [
          {
            code: "workspace-configuration-parser-failed",
            message: "Workspace configuration parsing failed",
          },
        ],
        ok: false,
      });
    }
    expect({ getterCalls, traps }).toEqual({ getterCalls: 0, traps: 0 });
  });

  test("distinguishes missing, conflicting, and malformed discovery outcomes", async () => {
    const parser = createYamlConfigurationParser();
    let parses = 0;
    const missing = await loadBootstrapConfiguration(
      { discover: () => success(Object.freeze([])) },
      {
        parse: (bytes) => {
          parses += 1;
          return parser.parse(bytes);
        },
      },
    );
    expect(missing).toEqual({
      ok: true,
      value: { locator: localWorkspaceLocator, state: "missing" },
    });
    expect(parses).toBe(0);

    const candidate = (source: string): WorkspaceConfigurationCandidate =>
      Object.freeze({
        bytes: new TextEncoder().encode(source),
        locator: localWorkspaceLocator,
      });
    const conflicting: ConfigurationDiscoveryProvider = {
      discover: () =>
        success(
          Object.freeze([candidate("schema: groma/v0.1\n"), candidate("schema: groma/v0.1\n")]),
        ),
    };
    expect(await loadBootstrapConfiguration(conflicting, parser)).toMatchObject({
      diagnostics: [{ code: "workspace-discovery-conflict" }],
      ok: false,
    });
    expect(
      await loadBootstrapConfiguration(
        { discover: () => success(Object.freeze([candidate("schema: [\n")])) },
        parser,
      ),
    ).toMatchObject({
      diagnostics: [{ code: "workspace-configuration-malformed" }],
      ok: false,
    });
    expect(
      await loadBootstrapConfiguration(
        {
          discover: () =>
            ({
              diagnostics: [{ code: "private", message: "/private/workspace" }],
              ok: false,
            }) as never,
        },
        parser,
      ),
    ).toEqual({
      diagnostics: [
        {
          code: "workspace-discovery-failed",
          message: "Workspace configuration discovery failed",
        },
      ],
      ok: false,
    });
    expect(
      await loadBootstrapConfiguration(
        { discover: () => success(Object.freeze([candidate("schema: groma/v0.1\n")])) },
        {
          parse: () => {
            throw new Error("/private/parser");
          },
        },
      ),
    ).toMatchObject({
      diagnostics: [{ code: "workspace-configuration-parser-failed" }],
      ok: false,
    });
  });

  test("loads a requested host-owned runtime plugin through the continued graph", async () => {
    const context = await temporaryWorkspace();
    await Bun.write(
      path.join(context.workspaceRoot, "groma", "groma.yaml"),
      "schema: groma/v0.1\nplugins:\n  - official.optional\n",
    );
    let starts = 0;
    const optional: PluginRegistration = {
      manifest: {
        apiVersion: pluginRuntimeApiVersion,
        id: "official.optional",
        phase: 1,
        provides: [],
        requires: [],
        version: "1.0.0",
      },
      start: () => {
        starts += 1;
        return { capabilities: [] };
      },
    };
    const registry = createDefaultBootstrapRegistry({
      additionalRuntimePlugins: [optional],
      ...(context.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: context.coordinationRoot }),
      surface: idleSurface(),
    });
    const composed = await registry.compose({ workspaceRoot: context.workspaceRoot });
    expect(composed.ok).toBeTrue();
    if (!composed.ok) return;
    expect(starts).toBe(1);
    expect(composed.value.workspace.status()).toEqual({ state: "configured" });
    expect(composed.value.plugins?.inspect().plugins.map((plugin) => plugin.id)).toContain(
      "official.optional",
    );
    expect(await composed.value.plugins?.shutdown()).toMatchObject({ ok: true });
  });

  test("accepts a required built-in ID as a redundant profile selection", async () => {
    const context = await temporaryWorkspace();
    await Bun.write(
      path.join(context.workspaceRoot, "groma", "groma.yaml"),
      "schema: groma/v0.1\nplugins:\n  - official.kernel\n",
    );
    const registry = createDefaultBootstrapRegistry({
      ...(context.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: context.coordinationRoot }),
      surface: idleSurface(),
    });

    const composed = await registry.compose({ workspaceRoot: context.workspaceRoot });
    expect(composed.ok).toBeTrue();
    if (!composed.ok) return;
    expect(
      composed.value.plugins?.inspect().plugins.filter((plugin) => plugin.id === "official.kernel"),
    ).toHaveLength(1);
    expect(await composed.value.plugins?.shutdown()).toMatchObject({ ok: true });
  });

  test("revalidates the canonical plugin selection before any selected optional starts", async () => {
    for (const mutation of ["beta", "project", "missing", "malformed"] as const) {
      const context = await temporaryWorkspace();
      const configurationPath = path.join(context.workspaceRoot, "groma", "groma.yaml");
      await Bun.write(configurationPath, "schema: groma/v0.1\nplugins:\n  - official.alpha\n");
      let reads = 0;
      let optionalStarts = 0;
      const phaseZeroEvents: string[] = [];
      const optional: PluginRegistration = {
        manifest: {
          apiVersion: pluginRuntimeApiVersion,
          id: "official.alpha",
          phase: 1,
          provides: [],
          requires: [],
          version: "1.0.0",
        },
        start: () => {
          optionalStarts += 1;
          return { capabilities: [] };
        },
      };
      const probe: PluginRegistration = {
        manifest: {
          apiVersion: pluginRuntimeApiVersion,
          id: `official.bootstrap-probe-${mutation}`,
          phase: 0,
          provides: [],
          requires: [],
          version: "1.0.0",
        },
        start: () => {
          phaseZeroEvents.push("start");
          return {
            capabilities: [],
            stop: () => {
              phaseZeroEvents.push("stop");
            },
          };
        },
      };
      const registry = createDefaultBootstrapRegistry({
        additionalBootstrapPlugins: [probe],
        additionalRuntimePlugins: [optional],
        ...(context.coordinationRoot === undefined
          ? {}
          : { coordinationRoot: context.coordinationRoot }),
        resourceFaultInjector: async (phase) => {
          if (phase !== "read") return;
          reads += 1;
          if (reads !== 2) return;
          if (mutation === "missing") {
            await rm(configurationPath, { force: true });
          } else {
            await Bun.write(
              configurationPath,
              mutation === "beta"
                ? "schema: groma/v0.1\nplugins:\n  - official.beta\n"
                : mutation === "project"
                  ? "schema: groma/v0.1\nplugins:\n  - acme.project\n"
                  : "schema: [\n",
            );
          }
        },
        surface: idleSurface(),
      });

      expect(await registry.compose({ workspaceRoot: context.workspaceRoot }), mutation).toEqual({
        diagnostics: [
          mutation === "malformed"
            ? {
                code: "workspace-configuration-malformed",
                message:
                  "The workspace configuration must use the documented bounded groma/v0.1 schema",
              }
            : {
                code: "workspace-configuration-changed",
                message:
                  "Workspace configuration changed during bootstrap; restart after changes settle",
              },
        ],
        ok: false,
      });
      expect({ optionalStarts, phaseZeroEvents, reads }, mutation).toEqual({
        optionalStarts: 0,
        phaseZeroEvents: ["start", "stop"],
        reads: 2,
      });
    }
  });

  test("accepts peer initialization from missing to the same empty canonical configuration", async () => {
    const context = await temporaryWorkspace();
    const configurationPath = path.join(context.workspaceRoot, "groma", "groma.yaml");
    await mkdir(path.dirname(configurationPath), { recursive: true });
    let reads = 0;
    const registry = createDefaultBootstrapRegistry({
      ...(context.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: context.coordinationRoot }),
      resourceFaultInjector: async (phase) => {
        if (phase !== "read") return;
        reads += 1;
        if (reads === 2) await Bun.write(configurationPath, "schema: groma/v0.1\n");
      },
      surface: idleSurface(),
    });

    const composed = await registry.compose({ workspaceRoot: context.workspaceRoot });
    expect(composed.ok).toBeTrue();
    if (!composed.ok) return;
    expect(composed.value.workspace.status()).toEqual({ state: "configured" });
    expect(reads).toBe(3);
    expect(await composed.value.plugins?.shutdown()).toMatchObject({ ok: true });
  });

  test("fails direct composition and cleans the graph when configuration changes after revalidation", async () => {
    const context = await temporaryWorkspace();
    const configurationPath = path.join(context.workspaceRoot, "groma", "groma.yaml");
    await Bun.write(configurationPath, "schema: groma/v0.1\nplugins:\n  - official.alpha\n");
    const events: string[] = [];
    let reads = 0;
    const optional: PluginRegistration = {
      manifest: {
        apiVersion: pluginRuntimeApiVersion,
        id: "official.alpha",
        phase: 1,
        provides: [],
        requires: [],
        version: "1.0.0",
      },
      start: () => {
        events.push("optional:start");
        return {
          capabilities: [],
          stop: () => {
            events.push("optional:stop");
          },
        };
      },
    };
    const probe: PluginRegistration = {
      manifest: {
        apiVersion: pluginRuntimeApiVersion,
        id: "official.bootstrap-probe-after-revalidation",
        phase: 0,
        provides: [],
        requires: [],
        version: "1.0.0",
      },
      start: () => {
        events.push("phase-zero:start");
        return {
          capabilities: [],
          stop: () => {
            events.push("phase-zero:stop");
          },
        };
      },
    };
    const registry = createDefaultBootstrapRegistry({
      additionalBootstrapPlugins: [probe],
      additionalRuntimePlugins: [optional],
      ...(context.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: context.coordinationRoot }),
      resourceFaultInjector: async (phase) => {
        if (phase !== "read") return;
        reads += 1;
        if (reads === 4) {
          await Bun.write(configurationPath, "schema: groma/v0.1\nplugins:\n  - acme.project\n");
        }
      },
      surface: idleSurface(),
    });

    expect(await registry.compose({ workspaceRoot: context.workspaceRoot })).toEqual({
      diagnostics: [
        {
          code: "workspace-configuration-changed",
          message: "Workspace configuration changed during bootstrap; restart after changes settle",
        },
      ],
      ok: false,
    });
    expect(reads).toBe(4);
    expect(events).toContain("optional:start");
    expect(events).toContain("optional:stop");
    expect(events.at(-1)).toBe("phase-zero:stop");
  });

  test("keeps cleanup failure precedence over a post-continuation provider failure", async () => {
    const context = await temporaryWorkspace();
    await Bun.write(
      path.join(context.workspaceRoot, "groma", "groma.yaml"),
      "schema: groma/v0.1\nplugins:\n  - official.alpha\n",
    );
    const events: string[] = [];
    let reads = 0;
    const registration = (id: string, phase: 0 | 1, stop: () => void): PluginRegistration => ({
      manifest: {
        apiVersion: pluginRuntimeApiVersion,
        id,
        phase,
        provides: [],
        requires: [],
        version: "1.0.0",
      },
      start: () => {
        events.push(`${id}:start`);
        return { capabilities: [], stop };
      },
    });
    const probe = registration("official.bootstrap-cleanup-probe", 0, () => {
      events.push("official.bootstrap-cleanup-probe:stop");
    });
    const optional = registration("official.alpha", 1, () => {
      events.push("official.alpha:stop");
      throw new Error("private cleanup failure");
    });
    const registry = createDefaultBootstrapRegistry({
      additionalBootstrapPlugins: [probe],
      additionalRuntimePlugins: [optional],
      ...(context.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: context.coordinationRoot }),
      resourceFaultInjector: (phase) => {
        if (phase !== "read") return;
        reads += 1;
        if (reads === 4) throw new Error("transient read failure");
      },
      surface: idleSurface(),
    });

    expect(await registry.compose({ workspaceRoot: context.workspaceRoot })).toEqual({
      diagnostics: [{ code: "host-plugin-cleanup-failed", message: "Host plugin cleanup failed" }],
      ok: false,
    });
    expect(reads).toBe(4);
    for (const event of [
      "official.bootstrap-cleanup-probe:start",
      "official.bootstrap-cleanup-probe:stop",
      "official.alpha:start",
      "official.alpha:stop",
    ]) {
      expect(
        events.filter((item) => item === event),
        event,
      ).toHaveLength(1);
    }
  });

  test("rejects known Host selector failures before importing trusted local packages", async () => {
    for (const failureKind of [
      "project",
      "unavailable",
      "invalid-registration",
      "malformed-selected",
    ] as const) {
      const context = await temporaryWorkspace();
      const counterKey = `groma.test.selector-import.${failureKind}.${context.workspaceRoot}`;
      const local = await trustedLocalPackageFixture(context, counterKey);
      const parser = createYamlConfigurationParser();
      const parsed = parser.parse(Uint8Array.from(await readFile(local.configurationFile)));
      if (!parsed.ok) throw new Error(parsed.diagnostics[0]?.code);
      const requestedRuntimePlugins =
        failureKind === "project"
          ? Object.freeze([{ id: "acme.project", namespace: "project" as const }])
          : failureKind === "unavailable"
            ? Object.freeze([{ id: "official.missing", namespace: "official" as const }])
            : failureKind === "malformed-selected"
              ? Object.freeze([{ id: "official.malformed", namespace: "official" as const }])
              : Object.freeze([]);
      await writeFile(
        local.configurationFile,
        serializeBootstrapConfiguration(
          Object.freeze({ ...parsed.value, requestedRuntimePlugins }),
        ),
      );
      const invalidRegistration: PluginRegistration = {
        manifest: {
          apiVersion: pluginRuntimeApiVersion,
          id: "acme.host-registration",
          phase: 1,
          provides: [],
          requires: [],
          version: "1.0.0",
        },
        start: () => ({ capabilities: [] }),
      };
      const malformedSelectedRegistration: PluginRegistration = {
        manifest: {
          apiVersion: pluginRuntimeApiVersion,
          id: "official.malformed",
          phase: 1,
          provides: [],
          requires: [],
          version: "1.0",
        },
        start: () => ({ capabilities: [] }),
      };
      const registry = createDefaultBootstrapRegistry({
        ...(failureKind === "invalid-registration"
          ? { additionalRuntimePlugins: [invalidRegistration] }
          : failureKind === "malformed-selected"
            ? { additionalRuntimePlugins: [malformedSelectedRegistration] }
            : {}),
        ...(context.coordinationRoot === undefined
          ? {}
          : { coordinationRoot: context.coordinationRoot }),
        surface: idleSurface(),
        userDataRoot: local.userDataRoot,
      });

      expect(await registry.compose({ workspaceRoot: context.workspaceRoot }), failureKind).toEqual(
        {
          diagnostics: [
            failureKind === "project"
              ? {
                  code: "project-plugin-validation-required",
                  message:
                    "Project-provided plugins are unsupported in this release pending package and trust validation",
                }
              : failureKind === "unavailable"
                ? {
                    code: "runtime-plugin-unavailable",
                    message: "A requested official runtime plugin is unavailable in this host",
                  }
                : failureKind === "invalid-registration"
                  ? {
                      code: "host-runtime-registration-invalid",
                      message: "Host runtime registrations must use the official namespace",
                    }
                  : {
                      code: "host-composition-failed",
                      message: "Selected plugin resolution failed",
                    },
          ],
          ok: false,
        },
      );
      expect(Reflect.get(globalThis, Symbol.for(counterKey)), failureKind).toBe(0);
      Reflect.deleteProperty(globalThis, Symbol.for(counterKey));
    }
  });

  test("rejects project requests before inspecting or executing supplied project code", async () => {
    const context = await temporaryWorkspace();
    await Bun.write(
      path.join(context.workspaceRoot, "groma", "groma.yaml"),
      "schema: groma/v0.1\nplugins:\n  - acme.unsafe\n",
    );
    let manifestReads = 0;
    let starts = 0;
    const unsafe = Object.create(null) as PluginRegistration;
    Object.defineProperty(unsafe, "manifest", {
      enumerable: true,
      get: () => {
        manifestReads += 1;
        throw new Error("project manifest executed");
      },
    });
    Object.defineProperty(unsafe, "start", {
      enumerable: true,
      value: () => {
        starts += 1;
        return { capabilities: [] };
      },
    });
    const registry = createDefaultBootstrapRegistry({
      additionalRuntimePlugins: [unsafe],
      ...(context.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: context.coordinationRoot }),
      surface: idleSurface(),
    });

    expect(await registry.compose({ workspaceRoot: context.workspaceRoot })).toEqual({
      diagnostics: [
        {
          code: "project-plugin-validation-required",
          message:
            "Project-provided plugins are unsupported in this release pending package and trust validation",
        },
      ],
      ok: false,
    });
    expect({ manifestReads, starts }).toEqual({ manifestReads: 0, starts: 0 });
  });

  test("allows a local package to satisfy a selected Host registration requirement", async () => {
    const context = await temporaryWorkspace();
    const capabilityId = "groma.test.local-provider/v1";
    const counterKey = `groma.test.selector-local-provider.${context.workspaceRoot}`;
    const local = await trustedLocalPackageFixture(context, counterKey, capabilityId);
    const parser = createYamlConfigurationParser();
    const parsed = parser.parse(Uint8Array.from(await readFile(local.configurationFile)));
    if (!parsed.ok) throw new Error(parsed.diagnostics[0]?.code);
    await writeFile(
      local.configurationFile,
      serializeBootstrapConfiguration(
        Object.freeze({
          ...parsed.value,
          requestedRuntimePlugins: Object.freeze([
            { id: "official.local-consumer", namespace: "official" as const },
          ]),
        }),
      ),
    );
    const consumer: PluginRegistration = {
      manifest: {
        apiVersion: pluginRuntimeApiVersion,
        id: "official.local-consumer",
        phase: 1,
        provides: [],
        requires: [{ cardinality: "single", id: capabilityId, version: "1.0.0" }],
        version: "1.0.0",
      },
      start: () => ({ capabilities: [] }),
    };
    const registry = createDefaultBootstrapRegistry({
      additionalRuntimePlugins: [consumer],
      ...(context.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: context.coordinationRoot }),
      surface: idleSurface(),
      userDataRoot: local.userDataRoot,
    });

    const composed = await registry.compose({ workspaceRoot: context.workspaceRoot });
    expect(composed).toMatchObject({ ok: true });
    expect(Reflect.get(globalThis, Symbol.for(counterKey))).toBe(1);
    if (composed.ok) expect(await composed.value.plugins?.shutdown()).toMatchObject({ ok: true });
    Reflect.deleteProperty(globalThis, Symbol.for(counterKey));
  });

  test("allows a local multiple provider to satisfy a selected Host version mismatch", async () => {
    const context = await temporaryWorkspace();
    const capabilityId = "groma.test.local-versioned-provider/v1";
    const counterKey = `groma.test.selector-local-versioned-provider.${context.workspaceRoot}`;
    const local = await trustedLocalPackageFixture(context, counterKey, capabilityId, "multiple");
    const parser = createYamlConfigurationParser();
    const parsed = parser.parse(Uint8Array.from(await readFile(local.configurationFile)));
    if (!parsed.ok) throw new Error(parsed.diagnostics[0]?.code);
    await writeFile(
      local.configurationFile,
      serializeBootstrapConfiguration(
        Object.freeze({
          ...parsed.value,
          requestedRuntimePlugins: Object.freeze([
            { id: "official.host-v2", namespace: "official" as const },
            { id: "official.local-v1-consumer", namespace: "official" as const },
          ]),
        }),
      ),
    );
    const hostV2: PluginRegistration = {
      manifest: {
        apiVersion: pluginRuntimeApiVersion,
        id: "official.host-v2",
        phase: 1,
        provides: [{ cardinality: "multiple", id: capabilityId, version: "2.0.0" }],
        requires: [],
        version: "1.0.0",
      },
      start: () => ({
        capabilities: [{ id: capabilityId, value: "host-v2", version: "2.0.0" }],
      }),
    };
    const consumer: PluginRegistration = {
      manifest: {
        apiVersion: pluginRuntimeApiVersion,
        id: "official.local-v1-consumer",
        phase: 1,
        provides: [],
        requires: [{ cardinality: "multiple", id: capabilityId, version: "1.0.0" }],
        version: "1.0.0",
      },
      start: () => ({ capabilities: [] }),
    };
    const registry = createDefaultBootstrapRegistry({
      additionalRuntimePlugins: [hostV2, consumer],
      ...(context.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: context.coordinationRoot }),
      surface: idleSurface(),
      userDataRoot: local.userDataRoot,
    });

    const composed = await registry.compose({ workspaceRoot: context.workspaceRoot });
    expect(composed).toMatchObject({ ok: true });
    expect(Reflect.get(globalThis, Symbol.for(counterKey))).toBe(1);
    if (composed.ok) expect(await composed.value.plugins?.shutdown()).toMatchObject({ ok: true });
    Reflect.deleteProperty(globalThis, Symbol.for(counterKey));
  });

  test("classifies a non-official Host registration as a composition error", async () => {
    const context = await temporaryWorkspace();
    let starts = 0;
    const registration: PluginRegistration = {
      manifest: {
        apiVersion: pluginRuntimeApiVersion,
        id: "acme.host-registration",
        phase: 1,
        provides: [],
        requires: [],
        version: "1.0.0",
      },
      start: () => {
        starts += 1;
        return { capabilities: [] };
      },
    };
    const registry = createDefaultBootstrapRegistry({
      additionalRuntimePlugins: [registration],
      ...(context.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: context.coordinationRoot }),
      surface: idleSurface(),
    });

    expect(await registry.compose({ workspaceRoot: context.workspaceRoot })).toEqual({
      diagnostics: [
        {
          code: "host-runtime-registration-invalid",
          message: "Host runtime registrations must use the official namespace",
        },
      ],
      ok: false,
    });
    expect(starts).toBe(0);
  });

  test("reports ambiguous bootstrap providers before any provider starts", async () => {
    const context = await temporaryWorkspace();
    let starts = 0;
    const duplicateParser: PluginRegistration = {
      manifest: {
        apiVersion: pluginRuntimeApiVersion,
        id: "official.alternate-parser",
        phase: 0,
        provides: [
          {
            cardinality: "single",
            id: defaultHostCapabilityIds.configurationParser,
            version: "1.0.0",
          },
        ],
        requires: [],
        version: "1.0.0",
      },
      start: () => {
        starts += 1;
        return { capabilities: [] };
      },
    };
    const registry = createDefaultBootstrapRegistry({
      additionalBootstrapPlugins: [duplicateParser],
      ...(context.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: context.coordinationRoot }),
      surface: idleSurface(),
    });

    expect(await registry.compose({ workspaceRoot: context.workspaceRoot })).toEqual({
      diagnostics: [
        {
          code: "bootstrap-provider-ambiguous",
          message: "Bootstrap capabilities must have exactly one compatible provider",
        },
      ],
      ok: false,
    });
    expect(starts).toBe(0);
  });

  test("maps duplicate built-in Phase 0 provider IDs to bootstrap ambiguity before start", async () => {
    const context = await temporaryWorkspace();
    let starts = 0;
    const duplicate: PluginRegistration = {
      manifest: {
        apiVersion: pluginRuntimeApiVersion,
        id: defaultHostPluginIds.configurationParser,
        phase: 0,
        provides: [],
        requires: [],
        version: "1.0.0",
      },
      start: () => {
        starts += 1;
        return { capabilities: [] };
      },
    };
    const registry = createDefaultBootstrapRegistry({
      additionalBootstrapPlugins: [duplicate],
      ...(context.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: context.coordinationRoot }),
      surface: idleSurface(),
    });

    expect(await registry.compose({ workspaceRoot: context.workspaceRoot })).toEqual({
      diagnostics: [
        {
          code: "bootstrap-provider-ambiguous",
          message: "Bootstrap capabilities must have exactly one compatible provider",
        },
      ],
      ok: false,
    });
    expect(starts).toBe(0);
  });

  test("keeps unrelated duplicate Phase 0 IDs as generic composition failures", async () => {
    const context = await temporaryWorkspace();
    let starts = 0;
    const duplicate = (): PluginRegistration => ({
      manifest: {
        apiVersion: pluginRuntimeApiVersion,
        id: "official.unrelated-duplicate",
        phase: 0,
        provides: [],
        requires: [],
        version: "1.0.0",
      },
      start: () => {
        starts += 1;
        return { capabilities: [] };
      },
    });
    const registry = createDefaultBootstrapRegistry({
      additionalBootstrapPlugins: [duplicate(), duplicate()],
      ...(context.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: context.coordinationRoot }),
      surface: idleSurface(),
    });

    expect(await registry.compose({ workspaceRoot: context.workspaceRoot })).toEqual({
      diagnostics: [
        { code: "host-composition-failed", message: "Bootstrap plugin resolution failed" },
      ],
      ok: false,
    });
    expect(starts).toBe(0);
  });

  test("cleans every started Phase 0 provider when configuration parsing fails", async () => {
    const context = await temporaryWorkspace();
    await Bun.write(path.join(context.workspaceRoot, "groma", "groma.yaml"), "schema: [\n");
    const events: string[] = [];
    const probe: PluginRegistration = {
      manifest: {
        apiVersion: pluginRuntimeApiVersion,
        id: "official.bootstrap-probe",
        phase: 0,
        provides: [],
        requires: [],
        version: "1.0.0",
      },
      start: () => {
        events.push("start");
        return {
          capabilities: [],
          stop: () => {
            events.push("stop");
          },
        };
      },
    };
    const registry = createDefaultBootstrapRegistry({
      additionalBootstrapPlugins: [probe],
      ...(context.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: context.coordinationRoot }),
      surface: idleSurface(),
    });

    expect(await registry.compose({ workspaceRoot: context.workspaceRoot })).toMatchObject({
      diagnostics: [{ code: "workspace-configuration-malformed" }],
      ok: false,
    });
    expect(events).toEqual(["start", "stop"]);
  });
});
