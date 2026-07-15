import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createLocalResourceProvider } from "../../persistence/index.ts";
import {
  createLocalPluginPackageManager,
  createYamlConfigurationParser,
  loadBootstrapConfiguration,
  localWorkspaceLocator,
  type BootstrapConfigurationLoad,
} from "../index.ts";
import type { PluginRegistration } from "../../core/index.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function fixture() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "groma-package-workspace-"));
  const userDataRoot = await mkdtemp(path.join(tmpdir(), "groma-package-user-"));
  roots.push(workspaceRoot, userDataRoot);
  await mkdir(path.join(workspaceRoot, "groma"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "groma", "groma.yaml"), "schema: groma/v0.1\n");
  const resources = await createLocalResourceProvider({ workspaceRoot });
  return { resources, userDataRoot, workspaceRoot };
}

async function bootstrap(
  resources: Awaited<ReturnType<typeof createLocalResourceProvider>>,
): Promise<BootstrapConfigurationLoad> {
  const loaded = await loadBootstrapConfiguration(
    {
      discover: async () => {
        const read = await resources.read({
          locator: localWorkspaceLocator.configuration,
          maxBytes: 64 * 1_024,
        });
        if (!read.ok) return read;
        return {
          ok: true as const,
          value: [{ bytes: read.value.bytes, locator: localWorkspaceLocator }],
        };
      },
    },
    createYamlConfigurationParser(),
  );
  if (!loaded.ok) throw new Error(loaded.diagnostics[0]?.code);
  return loaded.value;
}

async function writePackage(
  workspaceRoot: string,
  name: string,
  entries: readonly string[],
): Promise<string> {
  const relative = `./plugins/${name.replaceAll("@", "").replaceAll("/", "-")}`;
  const root = path.resolve(workspaceRoot, relative);
  await mkdir(path.join(root, "plugins"), { recursive: true });
  await writeFile(
    path.join(root, "groma.package.json"),
    `${JSON.stringify(
      {
        apiVersion: "groma.package/v1",
        name,
        plugins: entries,
        runtimeApiVersion: "groma.plugin/v1",
        sdkApiVersion: "groma.sdk/v1",
        version: "1.0.0",
      },
      null,
      2,
    )}\n`,
  );
  for (const entry of entries) {
    const file = path.resolve(root, entry);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `export const marker = ${JSON.stringify(entry)};\n`);
  }
  return relative;
}

function registration(id: string, capability?: string): PluginRegistration {
  return Object.freeze({
    manifest: Object.freeze({
      apiVersion: "groma.plugin/v1",
      id,
      phase: 1 as const,
      provides:
        capability === undefined
          ? Object.freeze([])
          : Object.freeze([
              Object.freeze({ cardinality: "multiple" as const, id: capability, version: "1.0.0" }),
            ]),
      requires: Object.freeze([]),
      version: "1.0.0",
    }),
    start: () => Object.freeze({ capabilities: Object.freeze([]) }),
  });
}

describe("local plugin package manager", () => {
  test("adds, inspects, selectively enables, disables, loads, and removes a multi-plugin blueprint package", async () => {
    const context = await fixture();
    const packageJson = path.join(context.workspaceRoot, "package.json");
    const projectLock = path.join(context.workspaceRoot, "bun.lock");
    await writeFile(packageJson, '{"private":true}\n');
    await writeFile(projectLock, "project lock\n");
    const source = await writePackage(context.workspaceRoot, "@example/multi", [
      "./plugins/alpha.js",
      "./plugins/beta.js",
    ]);
    let imports = 0;
    const importModule = async (url: string) => {
      imports += 1;
      return {
        plugin: url.includes("alpha.js")
          ? registration("example.alpha")
          : registration("example.beta"),
      };
    };
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule,
      ...context,
    });

    expect(await manager.add({ scope: "blueprint", source })).toMatchObject({
      ok: true,
      value: {
        available: ["./plugins/alpha.js", "./plugins/beta.js"],
        enabled: [],
        integrity: "exact",
        name: "@example/multi",
      },
    });
    expect(await manager.inspect({ name: "@example/multi", scope: "blueprint" })).toMatchObject({
      ok: true,
      value: { enabled: [] },
    });
    expect(
      await manager.enable({
        entry: "./plugins/alpha.js",
        name: "@example/multi",
        scope: "blueprint",
      }),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-full-user-permissions-trust-required" }],
      ok: false,
    });
    expect(imports).toBe(0);

    expect(
      await manager.enable({
        entry: "./plugins/alpha.js",
        name: "@example/multi",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ ok: true, value: { enabled: ["./plugins/alpha.js"] } });
    expect(
      await manager.enable({
        entry: "./plugins/beta.js",
        name: "@example/multi",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({
      ok: true,
      value: { enabled: ["./plugins/alpha.js", "./plugins/beta.js"] },
    });

    const configurationText = await readFile(
      path.join(context.workspaceRoot, "groma", "groma.yaml"),
      "utf8",
    );
    const lockText = await readFile(
      path.join(context.workspaceRoot, "groma", "packages.lock"),
      "utf8",
    );
    expect(configurationText).toContain('name: "@example/multi"');
    expect(configurationText).toContain('      - "./plugins/alpha.js"');
    expect(JSON.parse(lockText)).toMatchObject({
      packages: [
        {
          enabled: [
            { entry: "./plugins/alpha.js", pluginId: "example.alpha" },
            { entry: "./plugins/beta.js", pluginId: "example.beta" },
          ],
          name: "@example/multi",
          version: "1.0.0",
        },
      ],
      schema: "groma.packages-lock/v1",
    });

    const restarted = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule,
      ...context,
    });
    expect(await restarted.loadEnabled()).toMatchObject({
      ok: true,
      value: {
        personalPluginIds: [],
        registrations: [
          { manifest: { id: "example.alpha" } },
          { manifest: { id: "example.beta" } },
        ],
      },
    });

    expect(
      await manager.disable({
        entry: "./plugins/alpha.js",
        name: "@example/multi",
        scope: "blueprint",
      }),
    ).toMatchObject({ ok: true, value: { enabled: ["./plugins/beta.js"] } });
    expect(await manager.remove({ name: "@example/multi", scope: "blueprint" })).toMatchObject({
      diagnostics: [{ code: "plugin-package-still-enabled" }],
      ok: false,
    });
    expect(
      await manager.disable({
        entry: "./plugins/beta.js",
        name: "@example/multi",
        scope: "blueprint",
      }),
    ).toMatchObject({ ok: true, value: { enabled: [] } });
    expect(await manager.remove({ name: "@example/multi", scope: "blueprint" })).toEqual({
      ok: true,
      value: { removed: "@example/multi" },
    });

    expect(await readFile(packageJson, "utf8")).toBe('{"private":true}\n');
    expect(await readFile(projectLock, "utf8")).toBe("project lock\n");
  });

  test("keeps personal presentation packages outside canonical configuration and rejects semantic capabilities", async () => {
    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-personal", [
      "./plugins/panel.js",
      "./plugins/mutator.js",
    ]);
    let imports = 0;
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async (url) => {
        imports += 1;
        return {
          plugin: url.includes("mutator.js")
            ? registration("example.mutator", "groma.operations/v1")
            : registration("example.panel", "groma.presentation.panel/v1"),
        };
      },
      ...context,
    });
    await manager.add({ scope: "personal", source });
    const before = await readFile(path.join(context.workspaceRoot, "groma", "groma.yaml"), "utf8");

    expect(
      await manager.enable({
        entry: "./plugins/mutator.js",
        name: "example-personal",
        scope: "personal",
      }),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-full-user-permissions-trust-required" }],
      ok: false,
    });
    expect(imports).toBe(0);
    expect(
      await manager.enable({
        entry: "./plugins/mutator.js",
        name: "example-personal",
        scope: "personal",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ diagnostics: [{ code: "personal-plugin-capability-forbidden" }], ok: false });
    expect(
      await manager.enable({
        entry: "./plugins/panel.js",
        name: "example-personal",
        scope: "personal",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ ok: true, value: { enabled: ["./plugins/panel.js"] } });
    expect(await readFile(path.join(context.workspaceRoot, "groma", "groma.yaml"), "utf8")).toBe(
      before,
    );
    expect(await readdir(path.join(context.userDataRoot, "workspaces"))).toHaveLength(1);

    const restarted = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => ({
        plugin: registration("example.panel", "groma.presentation.panel/v1"),
      }),
      ...context,
    });
    expect(await restarted.loadEnabled()).toMatchObject({
      ok: true,
      value: {
        personalPluginIds: ["example.panel"],
        registrations: [{ manifest: { id: "example.panel" } }],
      },
    });
  });

  test("repairs lock-first disable and remove after an interrupted blueprint state write", async () => {
    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-recovery", [
      "./plugins/alpha.js",
    ]);
    const importModule = async () => ({ plugin: registration("example.recovery") });
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule,
      ...context,
    });
    await manager.add({ scope: "blueprint", source });
    await manager.enable({
      entry: "./plugins/alpha.js",
      name: "example-recovery",
      scope: "blueprint",
      trustFullUserPermissions: true,
    });

    const lockFile = path.join(context.workspaceRoot, "groma", "packages.lock");
    const lock = JSON.parse(await readFile(lockFile, "utf8"));
    lock.packages[0].enabled = [];
    await writeFile(lockFile, `${JSON.stringify(lock)}\n`);
    await rm(path.resolve(context.workspaceRoot, source), { recursive: true });

    const afterDisableInterruption = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule,
      ...context,
    });
    expect(
      await afterDisableInterruption.disable({
        entry: "./plugins/alpha.js",
        name: "example-recovery",
        scope: "blueprint",
      }),
    ).toMatchObject({ ok: true, value: { enabled: [] } });
    expect(
      await readFile(path.join(context.workspaceRoot, "groma", "groma.yaml"), "utf8"),
    ).not.toContain("./plugins/alpha.js");

    const removalLock = JSON.parse(await readFile(lockFile, "utf8"));
    removalLock.packages = [];
    await writeFile(lockFile, `${JSON.stringify(removalLock)}\n`);
    const afterRemoveInterruption = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule,
      ...context,
    });
    expect(
      await afterRemoveInterruption.remove({ name: "example-recovery", scope: "blueprint" }),
    ).toEqual({ ok: true, value: { removed: "example-recovery" } });
    expect(
      await readFile(path.join(context.workspaceRoot, "groma", "groma.yaml"), "utf8"),
    ).not.toContain("example-recovery");
  });

  test("rejects remote acquisition before filesystem work, exact-document extras, and entry drift before import", async () => {
    const context = await fixture();
    let imports = 0;
    let malformedRegistration = false;
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => {
        imports += 1;
        return {
          plugin: malformedRegistration
            ? { manifest: { id: "example.alpha", phase: 1 }, start: () => ({}) }
            : registration("example.alpha"),
        };
      },
      ...context,
    });

    expect(
      await manager.add({ scope: "blueprint", source: "npm:@example/remote@1.0.0" }),
    ).toMatchObject({
      diagnostics: [{ code: "remote-plugin-package-acquisition-out-of-scope" }],
      ok: false,
    });
    expect(imports).toBe(0);

    const source = await writePackage(context.workspaceRoot, "example-drift", [
      "./plugins/alpha.js",
    ]);
    const manifestFile = path.resolve(context.workspaceRoot, source, "groma.package.json");
    const valid = JSON.parse(await readFile(manifestFile, "utf8"));
    await writeFile(manifestFile, `${JSON.stringify({ ...valid, unexpected: true })}\n`);
    expect(await manager.add({ scope: "blueprint", source })).toMatchObject({
      diagnostics: [{ code: "invalid-plugin-package-document" }],
      ok: false,
    });
    const duplicate = `${JSON.stringify(valid).replace(
      '"apiVersion":"groma.package/v1",',
      '"apiVersion":"groma.package/v1","apiVersion":"groma.package/v1",',
    )}\n`;
    await writeFile(manifestFile, duplicate);
    expect(await manager.add({ scope: "blueprint", source })).toMatchObject({
      diagnostics: [{ code: "invalid-plugin-package-document" }],
      ok: false,
    });

    await writeFile(manifestFile, `${JSON.stringify(valid)}\n`);
    await manager.add({ scope: "blueprint", source });
    malformedRegistration = true;
    expect(
      await manager.enable({
        entry: "./plugins/alpha.js",
        name: "example-drift",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ diagnostics: [{ code: "plugin-package-entry-invalid" }], ok: false });
    malformedRegistration = false;
    await manager.enable({
      entry: "./plugins/alpha.js",
      name: "example-drift",
      scope: "blueprint",
      trustFullUserPermissions: true,
    });
    const entryFile = path.resolve(context.workspaceRoot, source, "plugins", "alpha.js");
    await writeFile(entryFile, "export const changed = true;\n");
    expect(await manager.inspect({ name: "example-drift", scope: "blueprint" })).toMatchObject({
      ok: true,
      value: { integrity: "entry-drift" },
    });
    imports = 0;
    const restarted = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => {
        imports += 1;
        return { plugin: registration("example.alpha") };
      },
      ...context,
    });
    expect(await restarted.loadEnabled()).toMatchObject({
      diagnostics: [{ code: "plugin-package-integrity-drift" }],
      ok: false,
    });
    expect(imports).toBe(0);
  });
});
