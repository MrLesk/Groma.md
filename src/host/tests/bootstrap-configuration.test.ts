import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { pluginRuntimeApiVersion, success, type PluginRegistration } from "../../core/index.ts";
import { allowsCustomLocalCoordinationRoot } from "../../persistence/index.ts";
import {
  createDefaultBootstrapRegistry,
  createYamlConfigurationParser,
  defaultHostCapabilityIds,
  loadBootstrapConfiguration,
  localBootstrapConvention,
  localWorkspaceLocator,
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
        architecture: "arm64",
        platform: "linux",
        workspaceRoot: "/srv/project",
      }),
    ).toMatchObject({ diagnostics: [{ code: "unsupported-bootstrap-target" }], ok: false });
  });

  test("parses the legacy marker and bounded requested plugin selection deterministically", () => {
    const parser = createYamlConfigurationParser();
    const legacy = parser.parse(new TextEncoder().encode("schema: groma/v0.1\n"));
    expect(legacy).toEqual({
      ok: true,
      value: { requestedRuntimePlugins: [], schema: "groma/v0.1" },
    });
    const extended = parser.parse(
      new TextEncoder().encode(
        "schema: groma/v0.1\nplugins:\n  - official.zeta\n  - acme.policy\n  - official.alpha\n",
      ),
    );
    expect(extended).toEqual({
      ok: true,
      value: {
        requestedRuntimePlugins: [
          { id: "acme.policy", source: "project" },
          { id: "official.alpha", source: "official" },
          { id: "official.zeta", source: "official" },
        ],
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
      "schema: groma/v0.1\nunknown: true\n",
      "schema: [\n",
    ]) {
      expect(parser.parse(new TextEncoder().encode(source))).toMatchObject({
        diagnostics: [{ code: "workspace-configuration-malformed" }],
        ok: false,
      });
    }
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
            "Project-provided plugins require validated package and trust state before loading",
        },
      ],
      ok: false,
    });
    expect({ manifestReads, starts }).toEqual({ manifestReads: 0, starts: 0 });
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
