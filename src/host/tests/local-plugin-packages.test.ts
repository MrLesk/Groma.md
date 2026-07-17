import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  appendFile,
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createLocalResourceProvider,
  workspaceResourceLocator,
  type LocalResourceProvider,
  type WorkspaceResourceLocator,
} from "../../persistence/index.ts";
import {
  bootstrapConfigurationBounds,
  createLocalPluginPackageManager,
  createYamlConfigurationParser,
  loadBootstrapConfiguration,
  localWorkspaceLocator,
  serializeBootstrapConfiguration,
  type BootstrapConfigurationLoad,
} from "../index.ts";
import type { PluginRegistration } from "../../core/index.ts";
import { importLocalPluginModule } from "../plugin-module-loader.ts";

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
  return {
    maxEnabledPlugins: bootstrapConfigurationBounds.maxEnabledLocalPlugins,
    resources,
    userDataRoot,
    workspaceRoot,
  };
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

function registrationWithCapabilities(id: string, count: number): PluginRegistration {
  return Object.freeze({
    manifest: Object.freeze({
      apiVersion: "groma.plugin/v1",
      id,
      phase: 1 as const,
      provides: Object.freeze(
        Array.from({ length: count }, (_, index) =>
          Object.freeze({
            cardinality: "multiple" as const,
            id: `example.capability-${index}/v1`,
            version: "1.0.0",
          }),
        ),
      ),
      requires: Object.freeze([]),
      version: "1.0.0",
    }),
    start: () => Object.freeze({ capabilities: Object.freeze([]) }),
  });
}

async function verifiedModuleSource(url: string): Promise<string> {
  if (!url.startsWith("blob:")) throw new Error("expected verified in-memory module");
  return await (await fetch(url)).text();
}

function registrationModuleSource(id: string): string {
  return `export const plugin = Object.freeze({
  manifest: Object.freeze({
    apiVersion: "groma.plugin/v1",
    id: ${JSON.stringify(id)},
    phase: 1,
    provides: Object.freeze([]),
    requires: Object.freeze([]),
    version: "1.0.0"
  }),
  start: () => Object.freeze({ capabilities: Object.freeze([]) })
});\n`;
}

describe("local plugin package manager", () => {
  test("keeps empty startup usable for a home-contained absent user root and fails closed when state is needed", async () => {
    if (process.platform === "win32") return;

    const context = await fixture();
    const containedUserDataRoot = path.join(context.workspaceRoot, ".groma");
    const blueprintSource = await writePackage(
      context.workspaceRoot,
      "example-contained-blueprint",
      ["./plugins/entry.js"],
    );
    const personalSource = await writePackage(context.workspaceRoot, "example-contained-personal", [
      "./plugins/panel.js",
    ]);
    let imports = 0;
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => {
        imports += 1;
        return { plugin: registration("example.contained") };
      },
      ...context,
      userDataRoot: containedUserDataRoot,
    });
    expect(imports).toBe(0);

    expect(await manager.loadEnabled()).toEqual({
      ok: true,
      value: { personalPluginIds: [], registrations: [] },
    });
    expect(imports).toBe(0);
    await expect(lstat(containedUserDataRoot)).rejects.toThrow();
    expect(await manager.add({ scope: "blueprint", source: blueprintSource })).toMatchObject({
      ok: true,
    });
    expect(imports).toBe(0);
    const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
    const lockFile = path.join(context.workspaceRoot, "groma", "packages.lock");
    const blueprintBytes = await Promise.all([readFile(configurationFile), readFile(lockFile)]);

    expect(
      await manager.enable({
        entry: "./plugins/entry.js",
        name: "example-contained-blueprint",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-package-user-state-unavailable" }],
      ok: false,
    });
    expect(imports).toBe(0);
    expect(
      await manager.add({ scope: "personal", source: "git@github.com:org/repo.git" }),
    ).toMatchObject({
      diagnostics: [{ code: "remote-plugin-package-acquisition-out-of-scope" }],
      ok: false,
    });
    expect(await manager.add({ scope: "personal", source: personalSource })).toMatchObject({
      diagnostics: [{ code: "plugin-package-user-state-unavailable" }],
      ok: false,
    });
    expect(imports).toBe(0);
    expect(await Promise.all([readFile(configurationFile), readFile(lockFile)])).toEqual(
      blueprintBytes,
    );
    await expect(lstat(containedUserDataRoot)).rejects.toThrow();

    const workspaceIdentity = createHash("sha256").update(context.workspaceRoot).digest("hex");
    const stateFile = path.join(containedUserDataRoot, "workspaces", `${workspaceIdentity}.json`);
    await mkdir(path.dirname(stateFile), { mode: 0o700, recursive: true });
    await chmod(containedUserDataRoot, 0o700);
    const seededState = `${JSON.stringify(
      { packages: [], schema: "groma.user-packages/v1", trust: [] },
      null,
      2,
    )}\n`;
    await writeFile(stateFile, seededState);
    const restarted = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      ...context,
      userDataRoot: containedUserDataRoot,
    });
    expect(await restarted.loadEnabled()).toMatchObject({
      diagnostics: [{ code: "plugin-package-user-state-unavailable" }],
      ok: false,
    });
    expect(await readFile(stateFile, "utf8")).toBe(seededState);
  });

  test("rejects a missing contained user root through a symlink ancestor without creating it", async () => {
    if (process.platform === "win32") return;

    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-contained-alias", [
      "./plugins/panel.js",
    ]);
    const aliasParent = await mkdtemp(path.join(tmpdir(), "groma-package-home-alias-"));
    roots.push(aliasParent);
    const workspaceAlias = path.join(aliasParent, "home");
    await symlink(context.workspaceRoot, workspaceAlias, "dir");
    const requestedUserDataRoot = path.join(workspaceAlias, ".groma");
    const actualUserDataRoot = path.join(context.workspaceRoot, ".groma");
    let openedFiles = 0;
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      fileReadObserver: () => {
        openedFiles += 1;
      },
      ...context,
      userDataRoot: requestedUserDataRoot,
    });

    expect(await manager.add({ scope: "personal", source })).toMatchObject({
      diagnostics: [{ code: "plugin-package-user-state-unavailable" }],
      ok: false,
    });
    expect(openedFiles).toBe(0);
    await expect(lstat(requestedUserDataRoot)).rejects.toThrow();
    await expect(lstat(actualUserDataRoot)).rejects.toThrow();
  });

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
        plugin: (await verifiedModuleSource(url)).includes("alpha.js")
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
          plugin: (await verifiedModuleSource(url)).includes("mutator.js")
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

  test("loads personal entries against the complete lock when configuration declares no blueprint packages", async () => {
    if (process.platform === "win32") return;

    const context = await fixture();
    const personalSource = await writePackage(
      context.workspaceRoot,
      "example-lock-first-personal-startup",
      ["./plugins/panel.js"],
    );
    const blueprintSource = await writePackage(
      context.workspaceRoot,
      "example-interrupted-blueprint-add",
      ["./plugins/entry.js"],
    );
    const setup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => ({
        plugin: registration("example.personal-startup", "groma.presentation.panel/v1"),
      }),
      ...context,
    });
    expect(await setup.add({ scope: "personal", source: personalSource })).toMatchObject({
      ok: true,
    });
    expect(
      await setup.enable({
        entry: "./plugins/panel.js",
        name: "example-lock-first-personal-startup",
        scope: "personal",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ ok: true });
    const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
    const configurationBefore = await readFile(configurationFile);
    const interruptedResources = await createLocalResourceProvider({
      faultInjector: (phase, fault) => {
        if (phase === "rename" && fault?.locator === "groma/groma.yaml") {
          throw new Error("private interrupted blueprint declaration");
        }
      },
      workspaceRoot: context.workspaceRoot,
    });
    const interrupted = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      ...context,
      resources: interruptedResources,
    });
    expect(await interrupted.add({ scope: "blueprint", source: blueprintSource })).toMatchObject({
      diagnostics: [{ code: "plugin-package-state-indeterminate" }],
      ok: false,
    });
    expect(await readFile(configurationFile)).toEqual(configurationBefore);
    expect(
      JSON.parse(
        await readFile(path.join(context.workspaceRoot, "groma", "packages.lock"), "utf8"),
      ),
    ).toMatchObject({
      packages: [{ name: "example-interrupted-blueprint-add" }],
    });

    let imports = 0;
    const restarted = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => {
        imports += 1;
        return {
          plugin: registration("example.personal-startup", "groma.presentation.panel/v1"),
        };
      },
      ...context,
    });
    expect(await restarted.loadEnabled()).toMatchObject({
      ok: true,
      value: {
        personalPluginIds: ["example.personal-startup"],
        registrations: [{ manifest: { id: "example.personal-startup" } }],
      },
    });
    expect(imports).toBe(1);
  });

  test("rejects the reserved Host plugin namespace before trust or package state is written", async () => {
    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-reserved-id", [
      "./plugins/entry.js",
    ]);
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => ({ plugin: registration("official.application") }),
      ...context,
    });
    expect(await manager.add({ scope: "blueprint", source })).toMatchObject({ ok: true });
    const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
    const lockFile = path.join(context.workspaceRoot, "groma", "packages.lock");
    const before = await Promise.all([readFile(configurationFile), readFile(lockFile)]);

    expect(
      await manager.enable({
        entry: "./plugins/entry.js",
        name: "example-reserved-id",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-package-plugin-id-reserved" }],
      ok: false,
    });
    expect(await Promise.all([readFile(configurationFile), readFile(lockFile)])).toEqual(before);
    expect(await readdir(context.userDataRoot)).toEqual([]);
  });

  test("preflights local entries with the ordinary Host capability bound", async () => {
    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-host-bounds", [
      "./plugins/sixteen.js",
      "./plugins/seventeen.js",
    ]);
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async (url) => {
        const source = await verifiedModuleSource(url);
        const count = source.includes("seventeen.js") ? 17 : 16;
        return { plugin: registrationWithCapabilities(`example.bound-${count}`, count) };
      },
      ...context,
    });
    expect(await manager.add({ scope: "blueprint", source })).toMatchObject({ ok: true });
    expect(
      await manager.enable({
        entry: "./plugins/sixteen.js",
        name: "example-host-bounds",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ ok: true });
    const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
    const lockFile = path.join(context.workspaceRoot, "groma", "packages.lock");
    const stateFile = path.join(
      context.userDataRoot,
      "workspaces",
      (await readdir(path.join(context.userDataRoot, "workspaces")))[0]!,
    );
    const before = await Promise.all([
      readFile(configurationFile),
      readFile(lockFile),
      readFile(stateFile),
    ]);

    expect(
      await manager.enable({
        entry: "./plugins/seventeen.js",
        name: "example-host-bounds",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ diagnostics: [{ code: "plugin-package-entry-invalid" }], ok: false });
    expect(
      await Promise.all([readFile(configurationFile), readFile(lockFile), readFile(stateFile)]),
    ).toEqual(before);
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

  test("recovers configured disable when the lock or package entry is missing", async () => {
    for (const recovery of ["missing-lock", "missing-package"] as const) {
      const context = await fixture();
      const source = await writePackage(context.workspaceRoot, `example-${recovery}-recovery`, [
        "./plugins/alpha.js",
      ]);
      const name = `example-${recovery}-recovery`;
      const setup = createLocalPluginPackageManager({
        bootstrap: await bootstrap(context.resources),
        importModule: async () => ({ plugin: registration(`example.${recovery}`) }),
        ...context,
      });
      expect(await setup.add({ scope: "blueprint", source })).toMatchObject({ ok: true });
      expect(
        await setup.enable({
          entry: "./plugins/alpha.js",
          name,
          scope: "blueprint",
          trustFullUserPermissions: true,
        }),
      ).toMatchObject({ ok: true });
      const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
      const lockFile = path.join(context.workspaceRoot, "groma", "packages.lock");
      if (recovery === "missing-lock") {
        await rm(lockFile);
      } else {
        const lock = JSON.parse(await readFile(lockFile, "utf8"));
        lock.packages = [];
        await writeFile(lockFile, `${JSON.stringify(lock, null, 2)}\n`);
      }
      await rm(path.resolve(context.workspaceRoot, source), { recursive: true });

      let imports = 0;
      const manager = createLocalPluginPackageManager({
        bootstrap: await bootstrap(context.resources),
        importModule: async () => {
          imports += 1;
          return { plugin: registration(`example.${recovery}`) };
        },
        ...context,
      });
      expect(await manager.loadEnabled(), recovery).toMatchObject({
        diagnostics: [{ code: "plugin-package-lock-missing" }],
        ok: false,
      });
      expect(
        await manager.disable({
          entry: "./plugins/alpha.js",
          name,
          scope: "blueprint",
        }),
        recovery,
      ).toMatchObject({ ok: true, value: { enabled: [] } });
      expect(imports, recovery).toBe(0);
      expect(await readFile(configurationFile, "utf8"), recovery).not.toContain(
        "./plugins/alpha.js",
      );

      const configurationAfterDisable = await readFile(configurationFile);
      const lockAfterDisable = await readFile(lockFile);
      expect(
        await manager.disable({
          entry: "./plugins/alpha.js",
          name,
          scope: "blueprint",
        }),
        recovery,
      ).toMatchObject({
        diagnostics: [{ code: "plugin-package-entry-not-enabled" }],
        ok: false,
      });
      expect(await readFile(configurationFile), recovery).toEqual(configurationAfterDisable);
      expect(await readFile(lockFile), recovery).toEqual(lockAfterDisable);
      expect(await manager.remove({ name, scope: "blueprint" }), recovery).toEqual({
        ok: true,
        value: { removed: name },
      });
      expect(await readFile(configurationFile, "utf8"), recovery).toBe("schema: groma/v0.1\n");
      expect(await readFile(lockFile, "utf8"), recovery).toBe(
        '{\n  "packages": [],\n  "schema": "groma.packages-lock/v1"\n}\n',
      );
    }
  });

  test("rejects blueprint selection mismatch before package access and preserves disable recovery", async () => {
    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-selection-mismatch", [
      "./plugins/alpha.js",
      "./plugins/beta.js",
    ]);
    const setup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      ...context,
    });
    expect(await setup.add({ scope: "blueprint", source })).toMatchObject({ ok: true });
    const loaded = await bootstrap(context.resources);
    if (loaded.state !== "configured") throw new Error("expected configured workspace");
    const mismatchedConfiguration = Object.freeze({
      ...loaded.configuration,
      packageDeclarations: Object.freeze(
        loaded.configuration.packageDeclarations.map((declaration) =>
          Object.freeze({
            ...declaration,
            enabled: Object.freeze(["./plugins/alpha.js"]),
          }),
        ),
      ),
    });
    const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
    const lockFile = path.join(context.workspaceRoot, "groma", "packages.lock");
    await writeFile(configurationFile, serializeBootstrapConfiguration(mismatchedConfiguration));
    const exactBytes = await Promise.all([readFile(configurationFile), readFile(lockFile)]);
    await rm(path.resolve(context.workspaceRoot, source), { recursive: true });
    let openedFiles = 0;
    let imports = 0;
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      fileReadObserver: () => {
        openedFiles += 1;
      },
      importModule: async () => {
        imports += 1;
        return { plugin: registration("example.selection-mismatch") };
      },
      trustRootPlatform: "win32",
      ...context,
    });

    expect(
      await manager.enable({
        entry: "./plugins/beta.js",
        name: "example-selection-mismatch",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-package-lock-mismatch" }],
      ok: false,
    });
    expect({ imports, openedFiles }).toEqual({ imports: 0, openedFiles: 0 });
    expect(await Promise.all([readFile(configurationFile), readFile(lockFile)])).toEqual(
      exactBytes,
    );

    expect(
      await manager.disable({
        entry: "./plugins/alpha.js",
        name: "example-selection-mismatch",
        scope: "blueprint",
      }),
    ).toMatchObject({ ok: true, value: { enabled: [] } });
    expect(await readFile(configurationFile, "utf8")).not.toContain("./plugins/alpha.js");
    expect({ imports, openedFiles }).toEqual({ imports: 0, openedFiles: 0 });
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

  test("reports manifest drift without resolving entries absent from the changed manifest", async () => {
    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-manifest-drift", [
      "./plugins/alpha.js",
      "./plugins/beta.js",
    ]);
    const packageRoot = path.resolve(context.workspaceRoot, source);
    const manifestFile = path.join(packageRoot, "groma.package.json");
    const alphaFile = path.join(packageRoot, "plugins", "alpha.js");
    const exactManifest = await readFile(manifestFile);
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => ({ plugin: registration("example.manifest-drift") }),
      ...context,
    });
    expect(await manager.add({ scope: "blueprint", source })).toMatchObject({ ok: true });
    expect(
      await manager.enable({
        entry: "./plugins/alpha.js",
        name: "example-manifest-drift",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ ok: true });

    const changedManifest = JSON.parse(exactManifest.toString()) as { plugins: string[] };
    changedManifest.plugins = ["./plugins/beta.js"];
    Object.assign(changedManifest, { name: "example-manifest-drift-renamed", version: "2.0.0" });
    await writeFile(manifestFile, `${JSON.stringify(changedManifest, null, 2)}\n`);
    await rm(alphaFile);
    expect(
      await manager.inspect({ name: "example-manifest-drift", scope: "blueprint" }),
    ).toMatchObject({
      ok: true,
      value: {
        available: ["./plugins/beta.js"],
        enabled: ["./plugins/alpha.js"],
        integrity: "manifest-drift",
        name: "example-manifest-drift",
        version: "1.0.0",
      },
    });

    await writeFile(manifestFile, exactManifest);
    await writeFile(alphaFile, "export const changed = true;\n");
    expect(
      await manager.inspect({ name: "example-manifest-drift", scope: "blueprint" }),
    ).toMatchObject({ ok: true, value: { integrity: "entry-drift" } });
  });

  test("rejects every non-canonical blueprint source before publication", async () => {
    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-existing", [
      "./plugins/entry.js",
    ]);
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      ...context,
    });
    expect(await manager.add({ scope: "blueprint", source })).toMatchObject({ ok: true });

    const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
    const lockFile = path.join(context.workspaceRoot, "groma", "packages.lock");
    const configurationBefore = await readFile(configurationFile);
    const lockBefore = await readFile(lockFile);
    for (const invalid of ["./plugin space", "./plugins/../x"]) {
      expect(await manager.add({ scope: "blueprint", source: invalid })).toMatchObject({
        diagnostics: [{ code: "invalid-blueprint-plugin-package-source" }],
        ok: false,
      });
      expect(await readFile(configurationFile)).toEqual(configurationBefore);
      expect(await readFile(lockFile)).toEqual(lockBefore);
    }
  });

  test("preflights the 65th blueprint package without mutating configuration or lock bytes", async () => {
    const context = await fixture();
    const declarations = Object.freeze(
      Array.from({ length: 64 }, (_, index) => {
        const suffix = String(index).padStart(2, "0");
        return Object.freeze({
          enabled: Object.freeze([]),
          name: `pkg-${suffix}`,
          source: `./packages/pkg-${suffix}`,
        });
      }),
    );
    const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
    const lockFile = path.join(context.workspaceRoot, "groma", "packages.lock");
    await writeFile(
      configurationFile,
      serializeBootstrapConfiguration(
        Object.freeze({
          packageDeclarations: declarations,
          requestedRuntimePlugins: Object.freeze([]),
          schema: "groma/v0.1" as const,
        }),
      ),
    );
    await writeFile(
      lockFile,
      `${JSON.stringify(
        {
          packages: declarations.map((declaration) => ({
            enabled: [],
            manifestIntegrity: `sha256:${"0".repeat(64)}`,
            name: declaration.name,
            source: declaration.source,
            version: "1.0.0",
          })),
          schema: "groma.packages-lock/v1",
        },
        null,
        2,
      )}\n`,
    );
    const source = await writePackage(context.workspaceRoot, "pkg-64", ["./plugins/entry.js"]);
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      ...context,
    });
    const configurationBefore = await readFile(configurationFile);
    const lockBefore = await readFile(lockFile);

    expect(await manager.add({ scope: "blueprint", source })).toMatchObject({
      diagnostics: [
        {
          code: "plugin-package-state-limit-exceeded",
          message: "Blueprint plugin package declarations exceed the maximum of 64",
        },
      ],
      ok: false,
    });
    expect(await readFile(configurationFile)).toEqual(configurationBefore);
    expect(await readFile(lockFile)).toEqual(lockBefore);
  });

  test("evaluates the exact verified entry bytes even when the source path is swapped before import", async () => {
    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-exact-bytes", [
      "./plugins/entry.js",
    ]);
    const entryFile = path.resolve(context.workspaceRoot, source, "plugins", "entry.js");
    await writeFile(entryFile, registrationModuleSource("example.original"));
    let imports = 0;
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async (url) => {
        imports += 1;
        await writeFile(entryFile, registrationModuleSource("example.swapped"));
        return importLocalPluginModule(url);
      },
      ...context,
    });
    await manager.add({ scope: "blueprint", source });
    expect(
      await manager.enable({
        entry: "./plugins/entry.js",
        name: "example-exact-bytes",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ ok: true });
    expect(imports).toBe(1);
    expect(
      JSON.parse(
        await readFile(path.join(context.workspaceRoot, "groma", "packages.lock"), "utf8"),
      ),
    ).toMatchObject({ packages: [{ enabled: [{ pluginId: "example.original" }] }] });

    imports = 0;
    const restarted = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async (url) => {
        imports += 1;
        return importLocalPluginModule(url);
      },
      ...context,
    });
    expect(await restarted.loadEnabled()).toMatchObject({
      diagnostics: [{ code: "plugin-package-integrity-drift" }],
      ok: false,
    });
    expect(imports).toBe(0);
  });

  test("rejects manifest links, path swaps, and growth during bounded reads", async () => {
    if (process.platform === "win32") return;

    const linked = await fixture();
    const linkedSource = await writePackage(linked.workspaceRoot, "example-linked", [
      "./plugins/entry.js",
    ]);
    const linkedManifest = path.resolve(linked.workspaceRoot, linkedSource, "groma.package.json");
    const linkedTarget = `${linkedManifest}.real`;
    await rename(linkedManifest, linkedTarget);
    await symlink(path.basename(linkedTarget), linkedManifest);
    const linkedManager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(linked.resources),
      ...linked,
    });
    expect(await linkedManager.add({ scope: "blueprint", source: linkedSource })).toMatchObject({
      diagnostics: [{ code: "plugin-package-file-invalid" }],
      ok: false,
    });

    const swapped = await fixture();
    const swappedSource = await writePackage(swapped.workspaceRoot, "example-swapped", [
      "./plugins/entry.js",
    ]);
    const swappedManifest = path.resolve(
      swapped.workspaceRoot,
      swappedSource,
      "groma.package.json",
    );
    let swappedOnce = false;
    const swappedManager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(swapped.resources),
      fileReadObserver: async ({ file, phase }) => {
        if (
          phase !== "opened" ||
          path.basename(file) !== path.basename(swappedManifest) ||
          swappedOnce
        )
          return;
        swappedOnce = true;
        await rename(file, `${file}.old`);
        await writeFile(file, "{}\n");
      },
      ...swapped,
    });
    expect(await swappedManager.add({ scope: "blueprint", source: swappedSource })).toMatchObject({
      diagnostics: [{ code: "plugin-package-file-invalid" }],
      ok: false,
    });

    const growing = await fixture();
    const growingSource = await writePackage(growing.workspaceRoot, "example-growing", [
      "./plugins/entry.js",
    ]);
    const growingManifest = path.resolve(
      growing.workspaceRoot,
      growingSource,
      "groma.package.json",
    );
    let grew = false;
    const growingManager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(growing.resources),
      fileReadObserver: async ({ file, phase }) => {
        if (phase !== "opened" || path.basename(file) !== path.basename(growingManifest) || grew)
          return;
        grew = true;
        await appendFile(file, "x".repeat(256 * 1_024));
      },
      ...growing,
    });
    expect(await growingManager.add({ scope: "blueprint", source: growingSource })).toMatchObject({
      diagnostics: [{ code: "plugin-package-file-invalid" }],
      ok: false,
    });
  });

  test("rejects package-root and entry-ancestor swaps after canonical path checks", async () => {
    if (process.platform === "win32") return;

    const manifestContext = await fixture();
    const manifestSource = await writePackage(
      manifestContext.workspaceRoot,
      "example-manifest-ancestor-swap",
      ["./plugins/entry.js"],
    );
    const packageRoot = path.resolve(manifestContext.workspaceRoot, manifestSource);
    const outsideManifestRoot = path.join(manifestContext.workspaceRoot, "outside-manifest-root");
    await mkdir(outsideManifestRoot);
    await writeFile(
      path.join(outsideManifestRoot, "groma.package.json"),
      await readFile(path.join(packageRoot, "groma.package.json")),
    );
    const configurationFile = path.join(manifestContext.workspaceRoot, "groma", "groma.yaml");
    const configurationBefore = await readFile(configurationFile);
    let manifestSwapped = false;
    const manifestManager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(manifestContext.resources),
      fileReadObserver: async ({ file, phase }) => {
        if (
          manifestSwapped ||
          phase !== "ancestry-checked" ||
          path.basename(file) !== "groma.package.json"
        ) {
          return;
        }
        manifestSwapped = true;
        await rename(packageRoot, `${packageRoot}.original`);
        await symlink(outsideManifestRoot, packageRoot, "dir");
      },
      ...manifestContext,
    });
    expect(await manifestManager.add({ scope: "blueprint", source: manifestSource })).toMatchObject(
      {
        diagnostics: [{ code: "plugin-package-file-invalid" }],
        ok: false,
      },
    );
    expect(manifestSwapped).toBe(true);
    expect(await readFile(configurationFile)).toEqual(configurationBefore);
    await expect(
      lstat(path.join(manifestContext.workspaceRoot, "groma", "packages.lock")),
    ).rejects.toThrow();

    const entryContext = await fixture();
    const entrySource = await writePackage(
      entryContext.workspaceRoot,
      "example-entry-ancestor-swap",
      ["./plugins/nested/entry.js"],
    );
    const setup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(entryContext.resources),
      ...entryContext,
    });
    expect(await setup.add({ scope: "blueprint", source: entrySource })).toMatchObject({
      ok: true,
    });
    const nestedRoot = path.resolve(entryContext.workspaceRoot, entrySource, "plugins", "nested");
    const outsideEntryRoot = path.join(entryContext.workspaceRoot, "outside-entry-root");
    await mkdir(outsideEntryRoot);
    await writeFile(
      path.join(outsideEntryRoot, "entry.js"),
      registrationModuleSource("example.outside-entry"),
    );
    const entryConfigurationFile = path.join(entryContext.workspaceRoot, "groma", "groma.yaml");
    const entryLockFile = path.join(entryContext.workspaceRoot, "groma", "packages.lock");
    const entryBytesBefore = await Promise.all([
      readFile(entryConfigurationFile),
      readFile(entryLockFile),
    ]);
    let entrySwapped = false;
    let imports = 0;
    const entryManager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(entryContext.resources),
      fileReadObserver: async ({ file, phase }) => {
        if (
          entrySwapped ||
          phase !== "ancestry-checked" ||
          !file.endsWith(path.join("plugins", "nested", "entry.js"))
        ) {
          return;
        }
        entrySwapped = true;
        await rename(nestedRoot, `${nestedRoot}.original`);
        await symlink(outsideEntryRoot, nestedRoot, "dir");
      },
      importModule: async () => {
        imports += 1;
        return { plugin: registration("example.outside-entry") };
      },
      ...entryContext,
    });
    expect(
      await entryManager.enable({
        entry: "./plugins/nested/entry.js",
        name: "example-entry-ancestor-swap",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-package-entry-invalid" }],
      ok: false,
    });
    expect({ entrySwapped, imports }).toEqual({ entrySwapped: true, imports: 0 });
    expect(await Promise.all([readFile(entryConfigurationFile), readFile(entryLockFile)])).toEqual(
      entryBytesBefore,
    );
    expect(await readdir(entryContext.userDataRoot)).toEqual([]);
  });

  test("rejects insecure user-data roots before personal state publication", async () => {
    if (process.platform === "win32") return;

    const permissive = await fixture();
    const permissiveSource = await writePackage(permissive.workspaceRoot, "example-permissive", [
      "./plugins/entry.js",
    ]);
    await chmod(permissive.userDataRoot, 0o755);
    const permissiveManager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(permissive.resources),
      ...permissive,
    });
    expect(
      await permissiveManager.add({ scope: "personal", source: permissiveSource }),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-package-user-state-unavailable" }],
      ok: false,
    });
    expect(await readdir(permissive.userDataRoot)).toEqual([]);
    await chmod(permissive.userDataRoot, 0o700);

    const linked = await fixture();
    const linkedSource = await writePackage(linked.workspaceRoot, "example-user-link", [
      "./plugins/entry.js",
    ]);
    const linkParent = await mkdtemp(path.join(tmpdir(), "groma-package-user-link-"));
    roots.push(linkParent);
    const linkedRoot = path.join(linkParent, "user-data");
    await symlink(linked.userDataRoot, linkedRoot, "dir");
    const linkedManager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(linked.resources),
      ...linked,
      userDataRoot: linkedRoot,
    });
    expect(await linkedManager.add({ scope: "personal", source: linkedSource })).toMatchObject({
      diagnostics: [{ code: "plugin-package-user-state-unavailable" }],
      ok: false,
    });
  });

  test("never authorizes execution from an unattested Windows trust root", async () => {
    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-windows-trust", [
      "./plugins/entry.js",
    ]);
    const trusted = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => ({ plugin: registration("example.windows-trust") }),
      trustRootPlatform: "posix",
      ...context,
    });
    await trusted.add({ scope: "blueprint", source });
    expect(
      await trusted.enable({
        entry: "./plugins/entry.js",
        name: "example-windows-trust",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ ok: true });

    let imports = 0;
    const unattested = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => {
        imports += 1;
        return { plugin: registration("example.windows-trust") };
      },
      trustRootPlatform: "win32",
      ...context,
    });
    expect(await unattested.loadEnabled()).toMatchObject({
      diagnostics: [{ code: "plugin-package-trust-root-unattested" }],
      ok: false,
    });
    expect(imports).toBe(0);

    const fresh = await fixture();
    await rm(fresh.userDataRoot, { recursive: true });
    const freshWindows = createLocalPluginPackageManager({
      bootstrap: await bootstrap(fresh.resources),
      importModule: async () => {
        imports += 1;
        return {};
      },
      trustRootPlatform: "win32",
      ...fresh,
    });
    expect(await freshWindows.loadEnabled()).toEqual({
      ok: true,
      value: { personalPluginIds: [], registrations: [] },
    });
    await expect(lstat(fresh.userDataRoot)).rejects.toThrow();
    expect(imports).toBe(0);
  });

  test("fails Windows enable before import or trust-root creation", async () => {
    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-windows-enable", [
      "./plugins/entry.js",
    ]);
    await rm(context.userDataRoot, { recursive: true });
    let imports = 0;
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => {
        imports += 1;
        return { plugin: registration("example.windows-enable") };
      },
      trustRootPlatform: "win32",
      ...context,
    });
    expect(await manager.add({ scope: "blueprint", source })).toMatchObject({ ok: true });
    expect(
      await manager.enable({
        entry: "./plugins/entry.js",
        name: "example-windows-enable",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-package-trust-root-unattested" }],
      ok: false,
    });
    expect(imports).toBe(0);
    await expect(lstat(context.userDataRoot)).rejects.toThrow();
  });

  test("removes an inert Windows blueprint package only when the trust root is absent", async () => {
    const existing = await fixture();
    const existingSource = await writePackage(existing.workspaceRoot, "example-existing-windows", [
      "./plugins/entry.js",
    ]);
    const existingManager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(existing.resources),
      trustRootPlatform: "win32",
      ...existing,
    });
    expect(await existingManager.add({ scope: "blueprint", source: existingSource })).toMatchObject(
      { ok: true },
    );
    const existingConfigurationFile = path.join(existing.workspaceRoot, "groma", "groma.yaml");
    const existingLockFile = path.join(existing.workspaceRoot, "groma", "packages.lock");
    const existingConfigurationBytes = await readFile(existingConfigurationFile);
    const existingLockBytes = await readFile(existingLockFile);
    expect(
      await existingManager.remove({ name: "example-existing-windows", scope: "blueprint" }),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-package-trust-root-unattested" }],
      ok: false,
    });
    expect(await readFile(existingConfigurationFile)).toEqual(existingConfigurationBytes);
    expect(await readFile(existingLockFile)).toEqual(existingLockBytes);

    const absent = await fixture();
    const absentSource = await writePackage(absent.workspaceRoot, "example-fresh-windows", [
      "./plugins/entry.js",
    ]);
    const configurationFile = path.join(absent.workspaceRoot, "groma", "groma.yaml");
    const configurationBefore = await readFile(configurationFile);
    await rm(absent.userDataRoot, { recursive: true });
    let imports = 0;
    const absentManager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(absent.resources),
      importModule: async () => {
        imports += 1;
        return {};
      },
      trustRootPlatform: "win32",
      ...absent,
    });
    expect(await absentManager.add({ scope: "blueprint", source: absentSource })).toMatchObject({
      ok: true,
      value: { enabled: [], name: "example-fresh-windows", scope: "blueprint" },
    });
    expect(
      await absentManager.inspect({ name: "example-fresh-windows", scope: "blueprint" }),
    ).toMatchObject({
      ok: true,
      value: { enabled: [], name: "example-fresh-windows", scope: "blueprint" },
    });
    expect(
      await absentManager.remove({ name: "example-fresh-windows", scope: "blueprint" }),
    ).toEqual({ ok: true, value: { removed: "example-fresh-windows" } });
    expect(await readFile(configurationFile)).toEqual(configurationBefore);
    expect(await readFile(path.join(absent.workspaceRoot, "groma", "packages.lock"), "utf8")).toBe(
      '{\n  "packages": [],\n  "schema": "groma.packages-lock/v1"\n}\n',
    );
    await expect(lstat(absent.userDataRoot)).rejects.toThrow();
    expect(imports).toBe(0);
  });

  test("supersedes obsolete exact trust grants for one logical package entry", async () => {
    if (process.platform === "win32") return;

    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-bounded-trust", [
      "./plugins/entry.js",
    ]);
    const entryFile = path.resolve(context.workspaceRoot, source, "plugins", "entry.js");
    const originalEntry = await readFile(entryFile);
    let imports = 0;
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => {
        imports += 1;
        return { plugin: registration("example.bounded-trust") };
      },
      ...context,
    });
    expect(await manager.add({ scope: "blueprint", source })).toMatchObject({ ok: true });
    expect(
      await manager.enable({
        entry: "./plugins/entry.js",
        name: "example-bounded-trust",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ ok: true });

    const stateDirectory = path.join(context.userDataRoot, "workspaces");
    const stateFiles = await readdir(stateDirectory);
    expect(stateFiles).toHaveLength(1);
    const stateFile = path.join(stateDirectory, stateFiles[0]!);
    const integrities = new Set<string>();
    const assertBoundedCanonicalTrust = async (): Promise<string> => {
      const bytes = await readFile(stateFile, "utf8");
      const state = JSON.parse(bytes) as {
        readonly trust: readonly Record<string, unknown>[];
      };
      expect(Object.keys(state)).toEqual(["packages", "schema", "trust"]);
      expect(state.trust).toHaveLength(1);
      expect(Object.keys(state.trust[0]!)).toEqual([
        "entry",
        "entryIntegrity",
        "manifestIntegrity",
        "packageLocation",
        "packageName",
        "scope",
        "workspaceLocation",
      ]);
      expect(bytes).toBe(`${JSON.stringify(state, null, 2)}\n`);
      expect(new TextEncoder().encode(bytes).byteLength).toBeLessThan(1_024 * 1_024);
      const integrity = state.trust[0]!.entryIntegrity;
      expect(typeof integrity).toBe("string");
      integrities.add(integrity as string);
      return bytes;
    };
    await assertBoundedCanonicalTrust();

    for (let revision = 1; revision <= 3; revision += 1) {
      expect(
        await manager.disable({
          entry: "./plugins/entry.js",
          name: "example-bounded-trust",
          scope: "blueprint",
        }),
      ).toMatchObject({ ok: true });
      await writeFile(entryFile, `export const marker = "revision-${revision}";\n`);
      const beforeTrust = imports;
      expect(
        await manager.enable({
          entry: "./plugins/entry.js",
          name: "example-bounded-trust",
          scope: "blueprint",
        }),
      ).toMatchObject({
        diagnostics: [{ code: "plugin-full-user-permissions-trust-required" }],
        ok: false,
      });
      expect(imports).toBe(beforeTrust);
      expect(
        await manager.enable({
          entry: "./plugins/entry.js",
          name: "example-bounded-trust",
          scope: "blueprint",
          trustFullUserPermissions: true,
        }),
      ).toMatchObject({ ok: true });
      await assertBoundedCanonicalTrust();
      expect(integrities.size).toBe(revision + 1);
    }

    expect(
      await manager.disable({
        entry: "./plugins/entry.js",
        name: "example-bounded-trust",
        scope: "blueprint",
      }),
    ).toMatchObject({ ok: true });
    await writeFile(entryFile, originalEntry);
    const trustBeforeRevert = await readFile(stateFile);
    const importsBeforeRevert = imports;
    expect(
      await manager.enable({
        entry: "./plugins/entry.js",
        name: "example-bounded-trust",
        scope: "blueprint",
      }),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-full-user-permissions-trust-required" }],
      ok: false,
    });
    expect(imports).toBe(importsBeforeRevert);
    expect(await readFile(stateFile)).toEqual(trustBeforeRevert);
  });

  test("rejects persisted trust with multiple exact hashes for one logical subject", async () => {
    if (process.platform === "win32") return;

    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-ambiguous-trust", [
      "./plugins/entry.js",
    ]);
    const setup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => ({ plugin: registration("example.ambiguous-trust") }),
      ...context,
    });
    expect(await setup.add({ scope: "blueprint", source })).toMatchObject({ ok: true });
    expect(
      await setup.enable({
        entry: "./plugins/entry.js",
        name: "example-ambiguous-trust",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await setup.disable({
        entry: "./plugins/entry.js",
        name: "example-ambiguous-trust",
        scope: "blueprint",
      }),
    ).toMatchObject({ ok: true });

    const stateFiles = await readdir(path.join(context.userDataRoot, "workspaces"));
    expect(stateFiles).toHaveLength(1);
    const stateFile = path.join(context.userDataRoot, "workspaces", stateFiles[0]!);
    const state = JSON.parse(await readFile(stateFile, "utf8")) as {
      trust: Array<Record<string, string>>;
    };
    expect(state.trust).toHaveLength(1);
    const current = state.trust[0]!;
    const zeroIntegrity = `sha256:${"0".repeat(64)}`;
    const oneIntegrity = `sha256:${"1".repeat(64)}`;
    const alternate = Object.freeze({
      ...current,
      entryIntegrity: current.entryIntegrity === zeroIntegrity ? oneIntegrity : zeroIntegrity,
    });
    state.trust = [current, alternate].sort((left, right) =>
      left.entryIntegrity < right.entryIntegrity
        ? -1
        : left.entryIntegrity > right.entryIntegrity
          ? 1
          : 0,
    );
    const seededBytes = `${JSON.stringify(state, null, 2)}\n`;
    await writeFile(stateFile, seededBytes);

    let imports = 0;
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => {
        imports += 1;
        return { plugin: registration("example.ambiguous-trust") };
      },
      ...context,
    });
    expect(await manager.loadEnabled()).toMatchObject({
      diagnostics: [{ code: "plugin-package-user-state-malformed" }],
      ok: false,
    });
    expect(
      await manager.enable({
        entry: "./plugins/entry.js",
        name: "example-ambiguous-trust",
        scope: "blueprint",
      }),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-package-user-state-malformed" }],
      ok: false,
    });
    expect(imports).toBe(0);
    expect(await readFile(stateFile, "utf8")).toBe(seededBytes);
  });

  test("rejects an enabled locked blueprint entry without an exact trust grant", async () => {
    if (process.platform === "win32") return;

    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-startup-trust", [
      "./plugins/entry.js",
    ]);
    const setup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => ({ plugin: registration("example.startup-trust") }),
      ...context,
    });
    expect(await setup.add({ scope: "blueprint", source })).toMatchObject({ ok: true });
    expect(
      await setup.enable({
        entry: "./plugins/entry.js",
        name: "example-startup-trust",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ ok: true });
    const stateFiles = await readdir(path.join(context.userDataRoot, "workspaces"));
    const stateFile = path.join(context.userDataRoot, "workspaces", stateFiles[0]!);
    const state = JSON.parse(await readFile(stateFile, "utf8"));
    state.trust = [];
    const untrustedBytes = `${JSON.stringify(state, null, 2)}\n`;
    await writeFile(stateFile, untrustedBytes);

    let imports = 0;
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => {
        imports += 1;
        return { plugin: registration("example.startup-trust") };
      },
      ...context,
    });
    expect(await manager.loadEnabled()).toMatchObject({
      diagnostics: [{ code: "plugin-full-user-permissions-trust-required" }],
      ok: false,
    });
    expect(imports).toBe(0);
    expect(await readFile(stateFile, "utf8")).toBe(untrustedBytes);
  });

  test("rejects duplicate enabled plugin IDs across entries and scopes without changing state", async () => {
    if (process.platform === "win32") return;

    const context = await fixture();
    const blueprintSource = await writePackage(context.workspaceRoot, "example-id-blueprint", [
      "./plugins/alpha.js",
      "./plugins/beta.js",
    ]);
    const personalSource = await writePackage(context.workspaceRoot, "example-id-personal", [
      "./plugins/panel.js",
    ]);
    let imports = 0;
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => {
        imports += 1;
        return { plugin: registration("example.shared-id", "groma.presentation.panel/v1") };
      },
      ...context,
    });
    expect(await manager.add({ scope: "blueprint", source: blueprintSource })).toMatchObject({
      ok: true,
    });
    expect(
      await manager.enable({
        entry: "./plugins/alpha.js",
        name: "example-id-blueprint",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ ok: true });
    const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
    const lockFile = path.join(context.workspaceRoot, "groma", "packages.lock");
    const stateFiles = await readdir(path.join(context.userDataRoot, "workspaces"));
    const stateFile = path.join(context.userDataRoot, "workspaces", stateFiles[0]!);
    const bytesBeforeReenable = await Promise.all([
      readFile(configurationFile),
      readFile(lockFile),
      readFile(stateFile),
    ]);
    expect(
      await manager.enable({
        entry: "./plugins/alpha.js",
        name: "example-id-blueprint",
        scope: "blueprint",
      }),
    ).toMatchObject({ ok: true });
    expect(
      await Promise.all([readFile(configurationFile), readFile(lockFile), readFile(stateFile)]),
    ).toEqual(bytesBeforeReenable);

    const beforeBeta = await Promise.all([
      readFile(configurationFile),
      readFile(lockFile),
      readFile(stateFile),
    ]);
    expect(
      await manager.enable({
        entry: "./plugins/beta.js",
        name: "example-id-blueprint",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-package-plugin-id-conflict" }],
      ok: false,
    });
    expect(
      await Promise.all([readFile(configurationFile), readFile(lockFile), readFile(stateFile)]),
    ).toEqual(beforeBeta);

    expect(await manager.add({ scope: "personal", source: personalSource })).toMatchObject({
      ok: true,
    });
    const beforePersonal = await Promise.all([
      readFile(configurationFile),
      readFile(lockFile),
      readFile(stateFile),
    ]);
    expect(
      await manager.enable({
        entry: "./plugins/panel.js",
        name: "example-id-personal",
        scope: "personal",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-package-plugin-id-conflict" }],
      ok: false,
    });
    expect(
      await Promise.all([readFile(configurationFile), readFile(lockFile), readFile(stateFile)]),
    ).toEqual(beforePersonal);
    expect(imports).toBe(4);
  });

  test("treats a post-lock configuration failure as indeterminate and reserves lock-first plugin IDs", async () => {
    if (process.platform === "win32") return;

    const context = await fixture();
    const blueprintSource = await writePackage(context.workspaceRoot, "example-id-lock-first", [
      "./plugins/entry.js",
    ]);
    const personalSource = await writePackage(
      context.workspaceRoot,
      "example-id-lock-first-personal",
      ["./plugins/panel.js"],
    );
    const setup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      ...context,
    });
    expect(await setup.add({ scope: "blueprint", source: blueprintSource })).toMatchObject({
      ok: true,
    });
    expect(await setup.add({ scope: "personal", source: personalSource })).toMatchObject({
      ok: true,
    });
    const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
    const lockFile = path.join(context.workspaceRoot, "groma", "packages.lock");
    const configurationBefore = await readFile(configurationFile);
    const resources = await createLocalResourceProvider({
      faultInjector: (phase, fault) => {
        if (phase === "rename" && fault?.locator === "groma/groma.yaml") {
          throw new Error("private definite configuration replacement failure");
        }
      },
      workspaceRoot: context.workspaceRoot,
    });
    const interrupted = createLocalPluginPackageManager({
      bootstrap: await bootstrap(resources),
      importModule: async () => ({
        plugin: registration("example.lock-first-shared", "groma.presentation.panel/v1"),
      }),
      ...context,
      resources,
    });
    expect(
      await interrupted.enable({
        entry: "./plugins/entry.js",
        name: "example-id-lock-first",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-package-state-indeterminate" }],
      ok: false,
    });
    expect(await readFile(configurationFile)).toEqual(configurationBefore);
    expect(await readFile(lockFile, "utf8")).toContain("example.lock-first-shared");
    const stateFiles = await readdir(path.join(context.userDataRoot, "workspaces"));
    const stateFile = path.join(context.userDataRoot, "workspaces", stateFiles[0]!);
    const interruptedBytes = await Promise.all([
      readFile(configurationFile),
      readFile(lockFile),
      readFile(stateFile),
    ]);

    let imports = 0;
    const lockFirst = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => {
        imports += 1;
        return {
          plugin: registration("example.lock-first-shared", "groma.presentation.panel/v1"),
        };
      },
      ...context,
    });
    expect(
      await lockFirst.enable({
        entry: "./plugins/panel.js",
        name: "example-id-lock-first-personal",
        scope: "personal",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-package-plugin-id-conflict" }],
      ok: false,
    });
    expect(imports).toBe(1);
    expect(
      await Promise.all([readFile(configurationFile), readFile(lockFile), readFile(stateFile)]),
    ).toEqual(interruptedBytes);

    expect(
      await lockFirst.disable({
        entry: "./plugins/entry.js",
        name: "example-id-lock-first",
        scope: "blueprint",
      }),
    ).toMatchObject({ ok: true, value: { enabled: [] } });
    expect(await readFile(configurationFile, "utf8")).not.toContain("./plugins/entry.js");
    expect(JSON.parse(await readFile(lockFile, "utf8"))).toMatchObject({
      packages: [{ enabled: [], name: "example-id-lock-first" }],
    });
  });

  test("preserves an indeterminate package result when coordination release also fails", async () => {
    if (process.platform === "win32") return;

    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-release-failure", [
      "./plugins/entry.js",
    ]);
    const setup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      ...context,
    });
    expect(await setup.add({ scope: "blueprint", source })).toMatchObject({ ok: true });
    const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
    const lockFile = path.join(context.workspaceRoot, "groma", "packages.lock");
    const configurationBefore = await readFile(configurationFile);
    const lockBefore = await readFile(lockFile);
    const resources = await createLocalResourceProvider({
      faultInjector: (phase, fault) => {
        if (phase === "rename" && fault?.locator === "groma/groma.yaml") {
          throw new Error("private definite configuration replacement failure");
        }
        if (phase === "coordination-release") {
          throw new Error("private coordination release failure");
        }
      },
      workspaceRoot: context.workspaceRoot,
    });
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(resources),
      importModule: async () => ({ plugin: registration("example.release-failure") }),
      ...context,
      resources,
    });

    expect(
      await manager.enable({
        entry: "./plugins/entry.js",
        name: "example-release-failure",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toEqual({
      diagnostics: [
        {
          code: "plugin-package-state-indeterminate",
          message:
            "Blueprint plugin package state may have committed; review groma/groma.yaml and groma/packages.lock before retrying, and reconcile a mismatch with package disable or remove",
        },
      ],
      ok: false,
    });
    expect(await readFile(configurationFile)).toEqual(configurationBefore);
    expect(await readFile(lockFile)).not.toEqual(lockBefore);
    expect(await readFile(lockFile, "utf8")).toContain("example.release-failure");
  });

  test("reports an indeterminate result when coordination release fails after both blueprint writes", async () => {
    if (process.platform === "win32") return;

    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-release-after-commit", [
      "./plugins/entry.js",
    ]);
    const setup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      ...context,
    });
    expect(await setup.add({ scope: "blueprint", source })).toMatchObject({ ok: true });
    const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
    const lockFile = path.join(context.workspaceRoot, "groma", "packages.lock");
    const configurationBefore = await readFile(configurationFile);
    const lockBefore = await readFile(lockFile);
    const resources = await createLocalResourceProvider({
      faultInjector: (phase) => {
        if (phase === "coordination-release") {
          throw new Error("private post-commit coordination release failure");
        }
      },
      workspaceRoot: context.workspaceRoot,
    });
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(resources),
      importModule: async () => ({ plugin: registration("example.release-after-commit") }),
      ...context,
      resources,
    });

    expect(
      await manager.enable({
        entry: "./plugins/entry.js",
        name: "example-release-after-commit",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toEqual({
      diagnostics: [
        {
          code: "plugin-package-state-indeterminate",
          message:
            "Blueprint plugin package state may have committed; review groma/groma.yaml and groma/packages.lock before retrying, and reconcile a mismatch with package disable or remove",
        },
      ],
      ok: false,
    });
    expect(await readFile(configurationFile)).not.toEqual(configurationBefore);
    expect(await readFile(lockFile)).not.toEqual(lockBefore);
    expect(await readFile(configurationFile, "utf8")).toContain("./plugins/entry.js");
    expect(await readFile(lockFile, "utf8")).toContain("example.release-after-commit");
  });

  test("reports committed personal state when its coordination release fails", async () => {
    if (process.platform === "win32") return;

    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-personal-release", [
      "./plugins/panel.js",
    ]);
    const setup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      ...context,
    });
    expect(await setup.add({ scope: "personal", source })).toMatchObject({ ok: true });
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => ({
        plugin: registration("example.personal-release", "groma.presentation.panel/v1"),
      }),
      userResourceFaultInjector: (phase) => {
        if (phase === "coordination-release") throw new Error("private release failure");
      },
      ...context,
    });

    expect(
      await manager.enable({
        entry: "./plugins/panel.js",
        name: "example-personal-release",
        scope: "personal",
        trustFullUserPermissions: true,
      }),
    ).toEqual({
      diagnostics: [
        {
          code: "plugin-package-state-indeterminate",
          message:
            "Personal plugin package state may have committed; inspect the personal package before retrying; not found confirms removal",
        },
      ],
      ok: false,
    });
    expect(
      await manager.disable({
        entry: "./plugins/panel.js",
        name: "example-personal-release",
        scope: "personal",
      }),
    ).toEqual({
      diagnostics: [
        {
          code: "plugin-package-state-unavailable",
          message:
            "Local plugin package state is changing or unavailable; retry after changes settle",
        },
      ],
      ok: false,
    });
    const restarted = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      ...context,
    });
    expect(
      await restarted.inspect({ name: "example-personal-release", scope: "personal" }),
    ).toMatchObject({ ok: true, value: { enabled: ["./plugins/panel.js"] } });
  });

  test("reports committed blueprint trust when its coordination release fails", async () => {
    if (process.platform === "win32") return;

    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-blueprint-trust-release", [
      "./plugins/entry.js",
    ]);
    const setup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      ...context,
    });
    expect(await setup.add({ scope: "blueprint", source })).toMatchObject({ ok: true });
    const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
    const lockFile = path.join(context.workspaceRoot, "groma", "packages.lock");
    const before = await Promise.all([readFile(configurationFile), readFile(lockFile)]);
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => ({ plugin: registration("example.blueprint-trust-release") }),
      userResourceFaultInjector: (phase) => {
        if (phase === "coordination-release") throw new Error("private release failure");
      },
      ...context,
    });

    expect(
      await manager.enable({
        entry: "./plugins/entry.js",
        name: "example-blueprint-trust-release",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toEqual({
      diagnostics: [
        {
          code: "plugin-package-state-indeterminate",
          message:
            "Blueprint plugin trust state may have committed; verify the exact package entry and current selection before retrying",
        },
      ],
      ok: false,
    });
    expect(await Promise.all([readFile(configurationFile), readFile(lockFile)])).toEqual(before);

    const restarted = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => ({ plugin: registration("example.blueprint-trust-release") }),
      ...context,
    });
    expect(
      await restarted.enable({
        entry: "./plugins/entry.js",
        name: "example-blueprint-trust-release",
        scope: "blueprint",
      }),
    ).toMatchObject({ ok: true });
  });

  test("rechecks current blueprint selections before startup imports", async () => {
    if (process.platform === "win32") return;

    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-stale-startup", [
      "./plugins/entry.js",
    ]);
    const setup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => ({ plugin: registration("example.stale-startup") }),
      ...context,
    });
    expect(await setup.add({ scope: "blueprint", source })).toMatchObject({ ok: true });
    expect(
      await setup.enable({
        entry: "./plugins/entry.js",
        name: "example-stale-startup",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ ok: true });

    const staleBootstrap = await bootstrap(context.resources);
    let imports = 0;
    const stale = createLocalPluginPackageManager({
      bootstrap: staleBootstrap,
      importModule: async () => {
        imports += 1;
        return { plugin: registration("example.stale-startup") };
      },
      ...context,
    });
    expect(
      await setup.disable({
        entry: "./plugins/entry.js",
        name: "example-stale-startup",
        scope: "blueprint",
      }),
    ).toMatchObject({ ok: true });

    expect(await stale.loadEnabled()).toEqual({
      diagnostics: [
        {
          code: "workspace-configuration-changed",
          message: "Workspace configuration changed during bootstrap; restart after changes settle",
        },
      ],
      ok: false,
    });
    expect(imports).toBe(0);
  });

  test("fences an empty startup projection and revalidates direct edits", async () => {
    if (process.platform === "win32") return;

    const context = await fixture();
    const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
    let coordinationClaims = 0;
    let lockReads = 0;
    let mutateOnLockRead = false;
    const resources = await createLocalResourceProvider({
      faultInjector: async (phase, event) => {
        if (phase === "coordination-claim") coordinationClaims += 1;
        if (phase !== "read" || event?.locator !== "groma/packages.lock") return;
        lockReads += 1;
        if (mutateOnLockRead && lockReads === 1) {
          await writeFile(configurationFile, "schema: groma/v0.1\nplugins:\n  - official.model\n");
        }
      },
      workspaceRoot: context.workspaceRoot,
    });
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(resources),
      ...context,
      resources,
    });

    expect(await manager.loadEnabled()).toEqual({
      ok: true,
      value: { personalPluginIds: [], registrations: [] },
    });
    expect(coordinationClaims).toBe(2);

    lockReads = 0;
    mutateOnLockRead = true;
    expect(await manager.loadEnabled()).toMatchObject({
      diagnostics: [{ code: "workspace-configuration-changed" }],
      ok: false,
    });
    expect(coordinationClaims).toBe(4);
  });

  test("serves eight contending startup observations without package-state writes", async () => {
    if (process.platform === "win32") return;

    const context = await fixture();
    const loadedBootstrap = await bootstrap(context.resources);
    const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
    const configurationBefore = await readFile(configurationFile);
    const userRootBefore = await readdir(context.userDataRoot);
    let coordinations = 0;
    let stages = 0;
    const resources = new Proxy(context.resources, {
      get(resourceTarget, property) {
        if (property === "withCoordination") {
          return (
            request: Parameters<LocalResourceProvider["withCoordination"]>[0],
            action: () => unknown | Promise<unknown>,
          ) => {
            coordinations += 1;
            return resourceTarget.withCoordination(request, action);
          };
        }
        if (property === "stageReplacement") {
          return (
            locator: Parameters<LocalResourceProvider["stageReplacement"]>[0],
            bytes: Uint8Array,
          ) => {
            stages += 1;
            return resourceTarget.stageReplacement(locator, bytes);
          };
        }
        const value = Reflect.get(resourceTarget, property, resourceTarget) as unknown;
        return typeof value === "function" ? value.bind(resourceTarget) : value;
      },
    }) as LocalResourceProvider;
    const managers = Array.from({ length: 8 }, () =>
      createLocalPluginPackageManager({
        ...context,
        bootstrap: loadedBootstrap,
        resources,
      }),
    );

    const results = await Promise.all(managers.map((manager) => manager.loadEnabled()));
    for (const result of results) {
      expect(result).toEqual({
        ok: true,
        value: { personalPluginIds: [], registrations: [] },
      });
    }
    expect(coordinations).toBeGreaterThanOrEqual(16);
    expect(stages).toBe(0);
    expect(await readFile(configurationFile)).toEqual(configurationBefore);
    expect(await readdir(context.userDataRoot)).toEqual(userRootBefore);
  });

  test("bounds a persistently contended startup fence without reads or writes", async () => {
    const context = await fixture();
    const loadedBootstrap = await bootstrap(context.resources);
    let coordinations = 0;
    let reads = 0;
    let stages = 0;
    const resources = new Proxy(context.resources, {
      get(resourceTarget, property) {
        if (property === "withCoordination") {
          return async () => {
            coordinations += 1;
            return {
              diagnostics: [
                {
                  code: "resource-coordination-contended",
                  message: "fixture package-state coordination remains held",
                },
              ],
              ok: false as const,
            };
          };
        }
        if (property === "read") {
          return (request: Parameters<LocalResourceProvider["read"]>[0]) => {
            reads += 1;
            return resourceTarget.read(request);
          };
        }
        if (property === "stageReplacement") {
          return (
            locator: Parameters<LocalResourceProvider["stageReplacement"]>[0],
            bytes: Uint8Array,
          ) => {
            stages += 1;
            return resourceTarget.stageReplacement(locator, bytes);
          };
        }
        const value = Reflect.get(resourceTarget, property, resourceTarget) as unknown;
        return typeof value === "function" ? value.bind(resourceTarget) : value;
      },
    }) as LocalResourceProvider;
    const manager = createLocalPluginPackageManager({
      ...context,
      bootstrap: loadedBootstrap,
      resources,
    });

    expect(await manager.loadEnabled()).toMatchObject({
      diagnostics: [{ code: "plugin-package-state-unavailable" }],
      ok: false,
    });
    expect(coordinations).toBe(81);
    expect(reads).toBe(0);
    expect(stages).toBe(0);
  });

  test("does not follow mixed package-state coordination failures in either order", async () => {
    const context = await fixture();
    const loadedBootstrap = await bootstrap(context.resources);
    for (const contentionFirst of [false, true]) {
      let coordinations = 0;
      let reads = 0;
      const first = contentionFirst
        ? {
            code: "resource-coordination-contended",
            message: "fixture contention is not the complete acquisition result",
          }
        : {
            code: "coordination-release-failed",
            message: "fixture release failed",
          };
      const second = contentionFirst
        ? {
            code: "coordination-release-failed",
            message: "fixture release failed",
          }
        : {
            code: "resource-coordination-contended",
            message: "fixture secondary contention must not authorize following",
          };
      const resources = new Proxy(context.resources, {
        get(resourceTarget, property) {
          if (property === "withCoordination") {
            return async () => {
              coordinations += 1;
              return { diagnostics: [first, second], ok: false as const };
            };
          }
          if (property === "read") {
            return (request: Parameters<LocalResourceProvider["read"]>[0]) => {
              reads += 1;
              return resourceTarget.read(request);
            };
          }
          const value = Reflect.get(resourceTarget, property, resourceTarget) as unknown;
          return typeof value === "function" ? value.bind(resourceTarget) : value;
        },
      }) as LocalResourceProvider;
      const manager = createLocalPluginPackageManager({
        ...context,
        bootstrap: loadedBootstrap,
        resources,
      });

      expect(await manager.loadEnabled(), `${contentionFirst}`).toMatchObject({
        diagnostics: [{ code: "plugin-package-state-unavailable" }],
        ok: false,
      });
      expect(coordinations, `${contentionFirst}`).toBe(1);
      expect(reads, `${contentionFirst}`).toBe(0);
    }
  });

  test("revalidates package state after the final startup import", async () => {
    if (process.platform === "win32") return;

    const context = await fixture();
    const name = "example-final-startup-revalidation";
    const pluginId = "example.final-startup-revalidation";
    const source = await writePackage(context.workspaceRoot, name, ["./plugins/entry.js"]);
    const setup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => ({ plugin: registration(pluginId) }),
      ...context,
    });
    expect(await setup.add({ scope: "blueprint", source })).toMatchObject({ ok: true });
    expect(
      await setup.enable({
        entry: "./plugins/entry.js",
        name,
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ ok: true });
    const mutator = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      ...context,
    });
    let imports = 0;
    const startup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => {
        imports += 1;
        expect(
          await mutator.disable({
            entry: "./plugins/entry.js",
            name,
            scope: "blueprint",
          }),
        ).toMatchObject({ ok: true });
        return { plugin: registration(pluginId) };
      },
      ...context,
    });

    expect(await startup.loadEnabled()).toMatchObject({
      diagnostics: [{ code: "workspace-configuration-changed" }],
      ok: false,
    });
    expect(imports).toBe(1);
  });

  test("follows a contended package mutation and rejects its stale bootstrap", async () => {
    if (process.platform === "win32") return;

    for (const mutation of ["disable", "remove"] as const) {
      const context = await fixture();
      const name = `example-startup-${mutation}`;
      const pluginId = `example.startup-${mutation}`;
      const source = await writePackage(context.workspaceRoot, name, ["./plugins/entry.js"]);
      const setup = createLocalPluginPackageManager({
        bootstrap: await bootstrap(context.resources),
        importModule: async () => ({ plugin: registration(pluginId) }),
        ...context,
      });
      expect(await setup.add({ scope: "blueprint", source })).toMatchObject({ ok: true });
      if (mutation === "disable") {
        expect(
          await setup.enable({
            entry: "./plugins/entry.js",
            name,
            scope: "blueprint",
            trustFullUserPermissions: true,
          }),
        ).toMatchObject({ ok: true });
      }
      let imports = 0;
      let signalContention!: () => void;
      const contentionObserved = new Promise<void>((resolve) => {
        signalContention = resolve;
      });
      const startupResources = new Proxy(context.resources, {
        get(resourceTarget, property) {
          if (property === "withCoordination") {
            return async (
              request: Parameters<LocalResourceProvider["withCoordination"]>[0],
              action: () => unknown | Promise<unknown>,
            ) => {
              const result = await resourceTarget.withCoordination(request, action);
              if (
                request.locator === "groma/package-state" &&
                !result.ok &&
                result.diagnostics.length === 1 &&
                result.diagnostics[0]?.code === "resource-coordination-contended"
              ) {
                signalContention();
              }
              return result;
            };
          }
          const value = Reflect.get(resourceTarget, property, resourceTarget) as unknown;
          return typeof value === "function" ? value.bind(resourceTarget) : value;
        },
      }) as LocalResourceProvider;
      const startup = createLocalPluginPackageManager({
        bootstrap: await bootstrap(startupResources),
        importModule: async () => {
          imports += 1;
          return { plugin: registration(pluginId) };
        },
        ...context,
        resources: startupResources,
      });
      let enteredWrite!: () => void;
      let releaseWrite!: () => void;
      const entered = new Promise<void>((resolve) => {
        enteredWrite = resolve;
      });
      const release = new Promise<void>((resolve) => {
        releaseWrite = resolve;
      });
      let paused = false;
      const mutationResources = await createLocalResourceProvider({
        faultInjector: async (phase, fault) => {
          if (paused || phase !== "write" || fault?.locator !== "groma/packages.lock") return;
          paused = true;
          enteredWrite();
          await release;
        },
        workspaceRoot: context.workspaceRoot,
      });
      const manager = createLocalPluginPackageManager({
        bootstrap: await bootstrap(mutationResources),
        ...context,
        resources: mutationResources,
      });
      const changing =
        mutation === "disable"
          ? manager.disable({
              entry: "./plugins/entry.js",
              name,
              scope: "blueprint",
            })
          : manager.remove({ name, scope: "blueprint" });
      await entered;
      const loading = startup.loadEnabled();
      await contentionObserved;
      expect(imports, mutation).toBe(0);
      releaseWrite();
      expect(await changing, mutation).toMatchObject({ ok: true });
      expect(await loading, mutation).toMatchObject({
        diagnostics: [{ code: "workspace-configuration-changed" }],
        ok: false,
      });
      expect(imports, mutation).toBe(0);
    }
  });

  test("never imports through a supported disable-enable ABA package-state tuple", async () => {
    if (process.platform === "win32") return;

    const context = await fixture();
    const name = "example-startup-aba";
    const pluginId = "example.startup-aba";
    const entry = "./plugins/entry.js";
    const source = await writePackage(context.workspaceRoot, name, [entry]);
    const setup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => ({ plugin: registration(pluginId) }),
      ...context,
    });
    expect(await setup.add({ scope: "blueprint", source })).toMatchObject({ ok: true });
    expect(
      await setup.enable({
        entry,
        name,
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ ok: true });

    let configurationWrites = 0;
    let signalMixedTuple!: () => void;
    let releaseMixedTuple!: () => void;
    const mixedTupleVisible = new Promise<void>((resolve) => {
      signalMixedTuple = resolve;
    });
    const mixedTupleReleased = new Promise<void>((resolve) => {
      releaseMixedTuple = resolve;
    });
    const mutationResources = await createLocalResourceProvider({
      faultInjector: async (phase, fault) => {
        if (phase !== "write" || fault?.locator !== "groma/groma.yaml") return;
        configurationWrites += 1;
        if (configurationWrites !== 2) return;
        signalMixedTuple();
        await mixedTupleReleased;
      },
      workspaceRoot: context.workspaceRoot,
    });
    const mutator = createLocalPluginPackageManager({
      bootstrap: await bootstrap(mutationResources),
      importModule: async () => ({ plugin: registration(pluginId) }),
      ...context,
      resources: mutationResources,
    });

    let signalReaderContention!: () => void;
    const readerContended = new Promise<void>((resolve) => {
      signalReaderContention = resolve;
    });
    const startupResources = new Proxy(context.resources, {
      get(resourceTarget, property) {
        if (property === "withCoordination") {
          return async (
            request: Parameters<LocalResourceProvider["withCoordination"]>[0],
            action: () => unknown | Promise<unknown>,
          ) => {
            const result = await resourceTarget.withCoordination(request, action);
            if (
              request.locator === "groma/package-state" &&
              !result.ok &&
              result.diagnostics.length === 1 &&
              result.diagnostics[0]?.code === "resource-coordination-contended"
            ) {
              signalReaderContention();
            }
            return result;
          };
        }
        const value = Reflect.get(resourceTarget, property, resourceTarget) as unknown;
        return typeof value === "function" ? value.bind(resourceTarget) : value;
      },
    }) as LocalResourceProvider;
    let abaMutation: Promise<unknown> | undefined;
    let mutationStarted = false;
    let imports = 0;
    const startup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(startupResources),
      fileReadObserver: async (event) => {
        if (
          mutationStarted ||
          event.phase !== "opened" ||
          !event.file.endsWith(path.join("plugins", "entry.js"))
        ) {
          return;
        }
        mutationStarted = true;
        expect(await mutator.disable({ entry, name, scope: "blueprint" })).toMatchObject({
          ok: true,
        });
        abaMutation = mutator.enable({
          entry,
          name,
          scope: "blueprint",
          trustFullUserPermissions: true,
        });
        await mixedTupleVisible;
      },
      importModule: async () => {
        imports += 1;
        return { plugin: registration(pluginId) };
      },
      ...context,
      resources: startupResources,
    });

    const loading = startup.loadEnabled();
    await mixedTupleVisible;
    await readerContended;
    const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
    const lockFile = path.join(context.workspaceRoot, "groma", "packages.lock");
    const stateFile = path.join(
      context.userDataRoot,
      "workspaces",
      (await readdir(path.join(context.userDataRoot, "workspaces")))[0]!,
    );
    const mixedConfiguration = await readFile(configurationFile, "utf8");
    const mixedLock = JSON.parse(await readFile(lockFile, "utf8")) as {
      packages: Array<{ enabled: unknown[]; name: string }>;
    };
    const mixedUserState = JSON.parse(await readFile(stateFile, "utf8")) as {
      packages: unknown[];
      trust: unknown[];
    };
    expect(mixedConfiguration).not.toContain(`      - ${JSON.stringify(entry)}`);
    expect(mixedLock.packages.find((item) => item.name === name)?.enabled).toHaveLength(1);
    expect(mixedUserState.packages).toHaveLength(0);
    expect(mixedUserState.trust).toHaveLength(1);
    expect(imports).toBe(0);

    releaseMixedTuple();
    if (abaMutation === undefined) throw new Error("missing ABA mutation fixture");
    expect(await abaMutation).toMatchObject({ ok: true });
    expect(await loading).toMatchObject({
      ok: true,
      value: { registrations: [{ manifest: { id: pluginId } }] },
    });
    expect(imports).toBe(1);
  });

  test("requires one coherent C1-L1-U0 observation across supported package mutations", async () => {
    if (process.platform === "win32") return;

    const context = await fixture();
    const blueprintName = "example-coherent-blueprint";
    const blueprintId = "example.coherent-blueprint";
    const personalName = "example-coherent-personal";
    const personalId = "example.coherent-personal";
    const entry = "./plugins/entry.js";
    const blueprintSource = await writePackage(context.workspaceRoot, blueprintName, [entry]);
    const personalSource = await writePackage(context.workspaceRoot, personalName, [entry]);
    const blueprintSetup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => ({ plugin: registration(blueprintId) }),
      ...context,
    });
    expect(await blueprintSetup.add({ scope: "blueprint", source: blueprintSource })).toMatchObject(
      { ok: true },
    );
    expect(
      await blueprintSetup.enable({
        entry,
        name: blueprintName,
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ ok: true });

    const personalSetup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => ({
        plugin: registration(personalId, "groma.presentation.panel/v1"),
      }),
      ...context,
    });
    expect(await personalSetup.add({ scope: "personal", source: personalSource })).toMatchObject({
      ok: true,
    });
    expect(
      await personalSetup.enable({
        entry,
        name: personalName,
        scope: "personal",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await personalSetup.disable({ entry, name: personalName, scope: "personal" }),
    ).toMatchObject({ ok: true });

    const initialStateFile = path.join(
      context.userDataRoot,
      "workspaces",
      (await readdir(path.join(context.userDataRoot, "workspaces")))[0]!,
    );
    const packageLockLocator = workspaceResourceLocator("groma", "packages.lock");
    if (!packageLockLocator.ok) throw new Error("missing package lock locator");
    const readPackageResource = async (locator: WorkspaceResourceLocator) => {
      const result = await context.resources.read({ locator, maxBytes: 4 * 1_024 * 1_024 });
      if (!result.ok) throw new Error(result.diagnostics[0]?.code);
      return result.value.bytes;
    };
    const initialConfiguration = await readPackageResource(localWorkspaceLocator.configuration);
    const initialLock = await readPackageResource(packageLockLocator.value);
    const initialUserState = await readFile(initialStateFile);
    const sameTestBytes = (left: Uint8Array, right: Uint8Array) =>
      left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
    const currentJointState = async () => {
      const currentConfiguration = await readPackageResource(localWorkspaceLocator.configuration);
      const currentLock = await readPackageResource(packageLockLocator.value);
      const currentUserState = await readFile(initialStateFile);
      return [
        sameTestBytes(currentConfiguration, initialConfiguration) ? "C1" : "C0",
        sameTestBytes(currentLock, initialLock) ? "L1" : "L0",
        sameTestBytes(currentUserState, initialUserState) ? "U0" : "U1",
      ].join("-");
    };
    type Manager = ReturnType<typeof createLocalPluginPackageManager>;
    const enablePersonal = async (manager: Manager, schedule: string[]) => {
      expect(
        await manager.enable({
          entry,
          name: personalName,
          scope: "personal",
          trustFullUserPermissions: true,
        }),
      ).toMatchObject({ ok: true });
      schedule.push("U1");
    };
    const disableBlueprint = async (manager: Manager, schedule: string[]) => {
      expect(
        await manager.disable({ entry, name: blueprintName, scope: "blueprint" }),
      ).toMatchObject({ ok: true });
      schedule.push("C0-L0-U1");
    };
    const disablePersonal = async (manager: Manager, schedule: string[]) => {
      expect(await manager.disable({ entry, name: personalName, scope: "personal" })).toMatchObject(
        { ok: true },
      );
      schedule.push("C0-L0-U0");
    };

    const legacyMutator = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => ({
        plugin: registration(personalId, "groma.presentation.panel/v1"),
      }),
      ...context,
    });
    const legacySchedule: string[] = [];
    await enablePersonal(legacyMutator, legacySchedule);
    const observedJointStates = [await currentJointState()];
    const legacyConfigurationObservation = await readPackageResource(
      localWorkspaceLocator.configuration,
    );
    const legacyLockObservation = await readPackageResource(packageLockLocator.value);
    await disableBlueprint(legacyMutator, legacySchedule);
    observedJointStates.push(await currentJointState());
    await disablePersonal(legacyMutator, legacySchedule);
    observedJointStates.push(await currentJointState());
    const legacyUserStateObservation = await readFile(initialStateFile);
    expect(observedJointStates).toEqual(["C1-L1-U1", "C0-L0-U1", "C0-L0-U0"]);
    expect(observedJointStates).not.toContain("C1-L1-U0");
    expect(legacyConfigurationObservation).toEqual(initialConfiguration);
    expect(legacyLockObservation).toEqual(initialLock);
    expect(legacyUserStateObservation).toEqual(initialUserState);
    expect(legacySchedule).toEqual(["U1", "C0-L0-U1", "C0-L0-U0"]);

    const blueprintRestorer = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => ({ plugin: registration(blueprintId) }),
      ...context,
    });
    expect(
      await blueprintRestorer.enable({
        entry,
        name: blueprintName,
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ ok: true });
    expect(await readPackageResource(localWorkspaceLocator.configuration)).toEqual(
      initialConfiguration,
    );
    expect(await readPackageResource(packageLockLocator.value)).toEqual(initialLock);
    expect(await readFile(initialStateFile)).toEqual(initialUserState);

    const fencedMutator = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => ({
        plugin: registration(personalId, "groma.presentation.panel/v1"),
      }),
      ...context,
    });
    const fencedSchedule: string[] = [];
    let packageStateClaims = 0;
    const startupResources = new Proxy(context.resources, {
      get(resourceTarget, property) {
        if (property === "withCoordination") {
          return async <T>(
            request: Parameters<LocalResourceProvider["withCoordination"]>[0],
            action: () => T | Promise<T>,
          ) => {
            if (request.locator === "groma/package-state") {
              packageStateClaims += 1;
              if (packageStateClaims === 2) {
                await enablePersonal(fencedMutator, fencedSchedule);
                await disableBlueprint(fencedMutator, fencedSchedule);
                await disablePersonal(fencedMutator, fencedSchedule);
              }
            }
            return resourceTarget.withCoordination(request, action);
          };
        }
        const value = Reflect.get(resourceTarget, property, resourceTarget) as unknown;
        return typeof value === "function" ? value.bind(resourceTarget) : value;
      },
    }) as LocalResourceProvider;
    let imports = 0;
    const startup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(startupResources),
      importModule: async () => {
        imports += 1;
        return { plugin: registration(blueprintId) };
      },
      ...context,
      resources: startupResources,
    });

    expect(await startup.loadEnabled()).toMatchObject({
      diagnostics: [{ code: "workspace-configuration-changed" }],
      ok: false,
    });
    expect(packageStateClaims).toBe(2);
    expect(fencedSchedule).toEqual(["U1", "C0-L0-U1", "C0-L0-U0"]);
    expect(await readFile(initialStateFile)).toEqual(initialUserState);
    expect(imports).toBe(0);
  });

  test("revalidates direct configuration and lock edits after materialization before import", async () => {
    if (process.platform === "win32") return;

    for (const mutation of ["configuration", "lock"] as const) {
      const context = await fixture();
      const name = `example-direct-${mutation}`;
      const source = await writePackage(context.workspaceRoot, name, ["./plugins/entry.js"]);
      const setup = createLocalPluginPackageManager({
        bootstrap: await bootstrap(context.resources),
        importModule: async () => ({ plugin: registration(`example.direct-${mutation}`) }),
        ...context,
      });
      expect(await setup.add({ scope: "blueprint", source })).toMatchObject({ ok: true });
      expect(
        await setup.enable({
          entry: "./plugins/entry.js",
          name,
          scope: "blueprint",
          trustFullUserPermissions: true,
        }),
      ).toMatchObject({ ok: true });
      const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
      const lockFile = path.join(context.workspaceRoot, "groma", "packages.lock");
      let mutated = false;
      let imports = 0;
      const manager = createLocalPluginPackageManager({
        bootstrap: await bootstrap(context.resources),
        fileReadObserver: async (event) => {
          if (
            mutated ||
            event.phase !== "opened" ||
            !event.file.endsWith(path.join("plugins", "entry.js"))
          ) {
            return;
          }
          mutated = true;
          if (mutation === "configuration") {
            const current = await readFile(configurationFile, "utf8");
            await writeFile(
              configurationFile,
              current.replace('      - "./plugins/entry.js"\n', ""),
            );
          } else {
            const current = JSON.parse(await readFile(lockFile, "utf8"));
            current.packages = [];
            await writeFile(lockFile, `${JSON.stringify(current, null, 2)}\n`);
          }
        },
        importModule: async () => {
          imports += 1;
          return { plugin: registration(`example.direct-${mutation}`) };
        },
        ...context,
      });

      expect(await manager.loadEnabled(), mutation).toMatchObject({
        diagnostics: [
          {
            code:
              mutation === "configuration"
                ? "workspace-configuration-changed"
                : "plugin-package-lock-changed",
          },
        ],
        ok: false,
      });
      expect(mutated, mutation).toBe(true);
      expect(imports, mutation).toBe(0);
    }
  });

  test("revalidates every canonical package surface immediately before enable import", async () => {
    if (process.platform === "win32") return;

    for (const mutation of ["configuration", "lock", "user-state"] as const) {
      const context = await fixture();
      const blueprintSource = await writePackage(
        context.workspaceRoot,
        `example-enable-${mutation}`,
        ["./plugins/entry.js"],
      );
      const personalSource = await writePackage(
        context.workspaceRoot,
        `example-enable-${mutation}-personal-state`,
        ["./plugins/panel.js"],
      );
      const setup = createLocalPluginPackageManager({
        bootstrap: await bootstrap(context.resources),
        ...context,
      });
      expect(await setup.add({ scope: "blueprint", source: blueprintSource })).toMatchObject({
        ok: true,
      });
      expect(await setup.add({ scope: "personal", source: personalSource })).toMatchObject({
        ok: true,
      });
      const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
      const lockFile = path.join(context.workspaceRoot, "groma", "packages.lock");
      const stateFile = path.join(
        context.userDataRoot,
        "workspaces",
        (await readdir(path.join(context.userDataRoot, "workspaces")))[0]!,
      );
      const files = [configurationFile, lockFile, stateFile] as const;
      let expectedBytes: string[] | undefined;
      let mutated = false;
      let imports = 0;
      const manager = createLocalPluginPackageManager({
        bootstrap: await bootstrap(context.resources),
        fileReadObserver: async (event) => {
          if (
            mutated ||
            event.phase !== "opened" ||
            !event.file.endsWith(path.join("plugins", "entry.js"))
          ) {
            return;
          }
          mutated = true;
          if (mutation === "configuration") {
            const parser = createYamlConfigurationParser();
            const parsed = parser.parse(Uint8Array.from(await readFile(configurationFile)));
            if (!parsed.ok) throw new Error(parsed.diagnostics[0]?.code);
            await writeFile(
              configurationFile,
              serializeBootstrapConfiguration(
                Object.freeze({
                  ...parsed.value,
                  requestedRuntimePlugins: Object.freeze([
                    { id: "official.direct-edit", namespace: "official" as const },
                  ]),
                }),
              ),
            );
          } else {
            const file = mutation === "lock" ? lockFile : stateFile;
            const document = JSON.parse(await readFile(file, "utf8"));
            document.packages[0].version = "1.0.1";
            await writeFile(file, `${JSON.stringify(document, null, 2)}\n`);
          }
          expectedBytes = (await Promise.all(files.map((file) => readFile(file)))).map((bytes) =>
            bytes.toString("base64"),
          );
        },
        importModule: async () => {
          imports += 1;
          return { plugin: registration(`example.enable-${mutation}`) };
        },
        ...context,
      });

      expect(
        await manager.enable({
          entry: "./plugins/entry.js",
          name: `example-enable-${mutation}`,
          scope: "blueprint",
          trustFullUserPermissions: true,
        }),
        mutation,
      ).toMatchObject({
        diagnostics: [
          {
            code:
              mutation === "configuration"
                ? "workspace-configuration-changed"
                : mutation === "lock"
                  ? "plugin-package-lock-changed"
                  : "plugin-package-user-state-changed",
          },
        ],
        ok: false,
      });
      expect(mutated, mutation).toBe(true);
      expect(imports, mutation).toBe(0);
      if (expectedBytes === undefined) throw new Error(`missing ${mutation} race snapshot`);
      expect(
        (await Promise.all(files.map((file) => readFile(file)))).map((bytes) =>
          bytes.toString("base64"),
        ),
        mutation,
      ).toEqual(expectedBytes);
    }
  });

  test("preserves a late enable configuration provider failure before import", async () => {
    if (process.platform === "win32") return;

    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-enable-provider", [
      "./plugins/entry.js",
    ]);
    const setup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      ...context,
    });
    expect(await setup.add({ scope: "blueprint", source })).toMatchObject({ ok: true });
    const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
    const lockFile = path.join(context.workspaceRoot, "groma", "packages.lock");
    const before = await Promise.all([readFile(configurationFile), readFile(lockFile)]);
    const loadedBootstrap = await bootstrap(context.resources);
    let reads = 0;
    const resources = await createLocalResourceProvider({
      faultInjector: (phase) => {
        if (phase === "read" && ++reads === 2) {
          throw new Error("private late configuration provider failure");
        }
      },
      workspaceRoot: context.workspaceRoot,
    });
    let imports = 0;
    const manager = createLocalPluginPackageManager({
      bootstrap: loadedBootstrap,
      importModule: async () => {
        imports += 1;
        return { plugin: registration("example.enable-provider") };
      },
      ...context,
      resources,
    });

    const result = await manager.enable({
      entry: "./plugins/entry.js",
      name: "example-enable-provider",
      scope: "blueprint",
      trustFullUserPermissions: true,
    });
    expect(result).toEqual({
      diagnostics: [
        {
          code: "workspace-configuration-provider-failure",
          message: "Workspace configuration access failed",
        },
      ],
      ok: false,
    });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(imports).toBe(0);
    expect(await Promise.all([readFile(configurationFile), readFile(lockFile)])).toEqual(before);
    expect(await readdir(context.userDataRoot)).toEqual([]);
  });

  test("rejects duplicate stored plugin IDs before startup imports", async () => {
    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-seeded-id-conflict", [
      "./plugins/alpha.js",
      "./plugins/beta.js",
    ]);
    let setupImports = 0;
    const setup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => ({
        plugin: registration(`example.seeded-${++setupImports}`),
      }),
      ...context,
    });
    expect(await setup.add({ scope: "blueprint", source })).toMatchObject({ ok: true });
    for (const entry of ["./plugins/alpha.js", "./plugins/beta.js"]) {
      expect(
        await setup.enable({
          entry,
          name: "example-seeded-id-conflict",
          scope: "blueprint",
          trustFullUserPermissions: true,
        }),
      ).toMatchObject({ ok: true });
    }
    const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
    const lockFile = path.join(context.workspaceRoot, "groma", "packages.lock");
    const stateFiles = await readdir(path.join(context.userDataRoot, "workspaces"));
    const stateFile = path.join(context.userDataRoot, "workspaces", stateFiles[0]!);
    const lock = JSON.parse(await readFile(lockFile, "utf8"));
    lock.packages[0].enabled[1].pluginId = lock.packages[0].enabled[0].pluginId;
    await writeFile(lockFile, `${JSON.stringify(lock, null, 2)}\n`);
    const exactBytes = await Promise.all([
      readFile(configurationFile),
      readFile(lockFile),
      readFile(stateFile),
    ]);
    let imports = 0;
    const restarted = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => {
        imports += 1;
        return {};
      },
      ...context,
    });
    expect(await restarted.loadEnabled()).toMatchObject({
      diagnostics: [{ code: "plugin-package-plugin-id-conflict" }],
      ok: false,
    });
    expect(imports).toBe(0);
    expect(
      await Promise.all([readFile(configurationFile), readFile(lockFile), readFile(stateFile)]),
    ).toEqual(exactBytes);
  });

  test("enforces one enabled-entry capacity across blueprint and personal packages", async () => {
    if (process.platform === "win32") return;

    const boundary = await fixture();
    const boundarySource = await writePackage(boundary.workspaceRoot, "example-capacity", [
      "./plugins/alpha.js",
      "./plugins/beta.js",
    ]);
    let boundaryImports = 0;
    const boundaryManager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(boundary.resources),
      importModule: async () => {
        boundaryImports += 1;
        return { plugin: registration(`example.capacity-${boundaryImports}`) };
      },
      ...boundary,
      maxEnabledPlugins: 1,
    });
    expect(await boundaryManager.add({ scope: "blueprint", source: boundarySource })).toMatchObject(
      { ok: true },
    );
    expect(
      await boundaryManager.enable({
        entry: "./plugins/alpha.js",
        name: "example-capacity",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ ok: true });
    const boundaryConfiguration = path.join(boundary.workspaceRoot, "groma", "groma.yaml");
    const boundaryLock = path.join(boundary.workspaceRoot, "groma", "packages.lock");
    const boundaryStateFiles = await readdir(path.join(boundary.userDataRoot, "workspaces"));
    const boundaryState = path.join(boundary.userDataRoot, "workspaces", boundaryStateFiles[0]!);
    const bytesBeforeOverflow = await Promise.all([
      readFile(boundaryConfiguration),
      readFile(boundaryLock),
      readFile(boundaryState),
    ]);
    expect(
      await boundaryManager.enable({
        entry: "./plugins/beta.js",
        name: "example-capacity",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-package-enabled-limit-exceeded" }],
      ok: false,
    });
    expect(boundaryImports).toBe(1);
    expect(
      await Promise.all([
        readFile(boundaryConfiguration),
        readFile(boundaryLock),
        readFile(boundaryState),
      ]),
    ).toEqual(bytesBeforeOverflow);

    const interrupted = await fixture();
    const interruptedBlueprintSource = await writePackage(
      interrupted.workspaceRoot,
      "example-lock-first-capacity",
      ["./plugins/alpha.js", "./plugins/beta.js"],
    );
    const interruptedPersonalSource = await writePackage(
      interrupted.workspaceRoot,
      "example-lock-first-personal",
      ["./plugins/panel.js"],
    );
    const interruptedSetup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(interrupted.resources),
      importModule: async () => ({ plugin: registration("example.lock-first-alpha") }),
      ...interrupted,
      maxEnabledPlugins: 2,
    });
    expect(
      await interruptedSetup.add({ scope: "blueprint", source: interruptedBlueprintSource }),
    ).toMatchObject({ ok: true });
    expect(
      await interruptedSetup.enable({
        entry: "./plugins/alpha.js",
        name: "example-lock-first-capacity",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await interruptedSetup.add({ scope: "personal", source: interruptedPersonalSource }),
    ).toMatchObject({ ok: true });
    const interruptedResources = await createLocalResourceProvider({
      faultInjector: (phase) => {
        if (phase === "after-rename") throw new Error("private interrupted lock publication");
      },
      workspaceRoot: interrupted.workspaceRoot,
    });
    let interruptedImports = 0;
    const lockFirstManager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(interrupted.resources),
      importModule: async () => {
        interruptedImports += 1;
        return { plugin: registration("example.lock-first-beta") };
      },
      ...interrupted,
      maxEnabledPlugins: 2,
      resources: interruptedResources,
    });
    expect(
      await lockFirstManager.enable({
        entry: "./plugins/beta.js",
        name: "example-lock-first-capacity",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-package-state-indeterminate" }],
      ok: false,
    });
    expect(interruptedImports).toBe(1);
    const interruptedConfiguration = path.join(interrupted.workspaceRoot, "groma", "groma.yaml");
    const interruptedLock = path.join(interrupted.workspaceRoot, "groma", "packages.lock");
    const interruptedStateFiles = await readdir(path.join(interrupted.userDataRoot, "workspaces"));
    const interruptedState = path.join(
      interrupted.userDataRoot,
      "workspaces",
      interruptedStateFiles[0]!,
    );
    expect(await readFile(interruptedConfiguration, "utf8")).not.toContain("./plugins/beta.js");
    expect(await readFile(interruptedLock, "utf8")).toContain("./plugins/beta.js");
    const interruptedBytes = await Promise.all([
      readFile(interruptedConfiguration),
      readFile(interruptedLock),
      readFile(interruptedState),
    ]);
    let overflowImports = 0;
    const afterInterruption = createLocalPluginPackageManager({
      bootstrap: await bootstrap(interrupted.resources),
      importModule: async () => {
        overflowImports += 1;
        return {
          plugin: registration("example.lock-first-personal", "groma.presentation.panel/v1"),
        };
      },
      ...interrupted,
      maxEnabledPlugins: 2,
    });
    expect(
      await afterInterruption.enable({
        entry: "./plugins/panel.js",
        name: "example-lock-first-personal",
        scope: "personal",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-package-enabled-limit-exceeded" }],
      ok: false,
    });
    expect(overflowImports).toBe(0);
    expect(
      await Promise.all([
        readFile(interruptedConfiguration),
        readFile(interruptedLock),
        readFile(interruptedState),
      ]),
    ).toEqual(interruptedBytes);

    const combined = await fixture();
    const blueprintSource = await writePackage(
      combined.workspaceRoot,
      "example-capacity-blueprint",
      ["./plugins/entry.js"],
    );
    const personalSource = await writePackage(combined.workspaceRoot, "example-capacity-personal", [
      "./plugins/panel.js",
    ]);
    let setupImports = 0;
    const setup = createLocalPluginPackageManager({
      bootstrap: await bootstrap(combined.resources),
      importModule: async () => {
        setupImports += 1;
        return {
          plugin:
            setupImports === 1
              ? registration("example.capacity-blueprint")
              : registration("example.capacity-personal", "groma.presentation.panel/v1"),
        };
      },
      ...combined,
      maxEnabledPlugins: 2,
    });
    expect(await setup.add({ scope: "blueprint", source: blueprintSource })).toMatchObject({
      ok: true,
    });
    expect(
      await setup.enable({
        entry: "./plugins/entry.js",
        name: "example-capacity-blueprint",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ ok: true });
    expect(await setup.add({ scope: "personal", source: personalSource })).toMatchObject({
      ok: true,
    });
    expect(
      await setup.enable({
        entry: "./plugins/panel.js",
        name: "example-capacity-personal",
        scope: "personal",
        trustFullUserPermissions: true,
      }),
    ).toMatchObject({ ok: true });
    const combinedConfiguration = path.join(combined.workspaceRoot, "groma", "groma.yaml");
    const combinedLock = path.join(combined.workspaceRoot, "groma", "packages.lock");
    const combinedStateFiles = await readdir(path.join(combined.userDataRoot, "workspaces"));
    const combinedState = path.join(combined.userDataRoot, "workspaces", combinedStateFiles[0]!);
    const combinedBytes = await Promise.all([
      readFile(combinedConfiguration),
      readFile(combinedLock),
      readFile(combinedState),
    ]);
    let startupImports = 0;
    const restarted = createLocalPluginPackageManager({
      bootstrap: await bootstrap(combined.resources),
      importModule: async () => {
        startupImports += 1;
        return {};
      },
      ...combined,
      maxEnabledPlugins: 1,
    });
    expect(await restarted.loadEnabled()).toMatchObject({
      diagnostics: [{ code: "plugin-package-enabled-limit-exceeded" }],
      ok: false,
    });
    expect(startupImports).toBe(0);
    expect(
      await Promise.all([
        readFile(combinedConfiguration),
        readFile(combinedLock),
        readFile(combinedState),
      ]),
    ).toEqual(combinedBytes);
  });

  test("coordinates cross-scope enables before conflict and capacity commits", async () => {
    if (process.platform === "win32") return;

    for (const scenario of ["duplicate", "capacity"] as const) {
      const context = await fixture();
      const blueprintSource = await writePackage(
        context.workspaceRoot,
        `example-race-blueprint-${scenario}`,
        ["./plugins/entry.js"],
      );
      const personalSource = await writePackage(
        context.workspaceRoot,
        `example-race-personal-${scenario}`,
        ["./plugins/panel.js"],
      );
      const setup = createLocalPluginPackageManager({
        bootstrap: await bootstrap(context.resources),
        ...context,
        maxEnabledPlugins: scenario === "capacity" ? 1 : 2,
      });
      expect(await setup.add({ scope: "blueprint", source: blueprintSource })).toMatchObject({
        ok: true,
      });
      expect(await setup.add({ scope: "personal", source: personalSource })).toMatchObject({
        ok: true,
      });
      let enteredImport!: () => void;
      let releaseImport!: () => void;
      const imported = new Promise<void>((resolve) => {
        enteredImport = resolve;
      });
      const release = new Promise<void>((resolve) => {
        releaseImport = resolve;
      });
      const personalResources = await createLocalResourceProvider({
        workspaceRoot: context.workspaceRoot,
      });
      const blueprintResources = await createLocalResourceProvider({
        workspaceRoot: context.workspaceRoot,
      });
      const personalId = scenario === "duplicate" ? "example.race-shared" : "example.race-panel";
      const personal = createLocalPluginPackageManager({
        bootstrap: await bootstrap(personalResources),
        importModule: async () => {
          enteredImport();
          await release;
          return { plugin: registration(personalId, "groma.presentation.panel/v1") };
        },
        ...context,
        maxEnabledPlugins: scenario === "capacity" ? 1 : 2,
        resources: personalResources,
      });
      let blueprintImports = 0;
      const blueprint = createLocalPluginPackageManager({
        bootstrap: await bootstrap(blueprintResources),
        importModule: async () => {
          blueprintImports += 1;
          return {
            plugin: registration(
              scenario === "duplicate" ? "example.race-shared" : "example.race-blueprint",
            ),
          };
        },
        ...context,
        maxEnabledPlugins: scenario === "capacity" ? 1 : 2,
        resources: blueprintResources,
      });

      const personalEnable = personal.enable({
        entry: "./plugins/panel.js",
        name: `example-race-personal-${scenario}`,
        scope: "personal",
        trustFullUserPermissions: true,
      });
      await imported;
      expect(
        await blueprint.add({ scope: "blueprint", source: "git@github.com:org/repo.git" }),
        scenario,
      ).toMatchObject({
        diagnostics: [{ code: "remote-plugin-package-acquisition-out-of-scope" }],
        ok: false,
      });
      const blueprintEnable = await blueprint.enable({
        entry: "./plugins/entry.js",
        name: `example-race-blueprint-${scenario}`,
        scope: "blueprint",
        trustFullUserPermissions: true,
      });
      releaseImport();

      expect(blueprintEnable, scenario).toMatchObject({
        diagnostics: [{ code: "plugin-package-state-unavailable" }],
        ok: false,
      });
      expect(await personalEnable, scenario).toMatchObject({ ok: true });
      expect(blueprintImports, scenario).toBe(0);
      let startupImports = 0;
      const restarted = createLocalPluginPackageManager({
        bootstrap: await bootstrap(context.resources),
        importModule: async () => {
          startupImports += 1;
          return { plugin: registration(personalId, "groma.presentation.panel/v1") };
        },
        ...context,
        maxEnabledPlugins: scenario === "capacity" ? 1 : 2,
      });
      expect(await restarted.loadEnabled(), scenario).toMatchObject({
        ok: true,
        value: {
          personalPluginIds: [personalId],
          registrations: [{ manifest: { id: personalId } }],
        },
      });
      expect(startupImports, scenario).toBe(1);
    }
  });

  test("maps package lock and user-state resource failures to stable startup diagnostics", async () => {
    if (process.platform === "win32") return;

    for (const failureKind of ["unreadable", "oversize", "provider"] as const) {
      const context = await fixture();
      const source = await writePackage(context.workspaceRoot, `example-lock-${failureKind}`, [
        "./plugins/entry.js",
      ]);
      const setup = createLocalPluginPackageManager({
        bootstrap: await bootstrap(context.resources),
        ...context,
      });
      expect(await setup.add({ scope: "blueprint", source })).toMatchObject({ ok: true });
      const loadedBootstrap = await bootstrap(context.resources);
      let resources = context.resources;
      if (failureKind === "oversize") {
        await writeFile(
          path.join(context.workspaceRoot, "groma", "packages.lock"),
          "x".repeat(1_048_577),
        );
      } else {
        let resourceReads = 0;
        resources = await createLocalResourceProvider({
          faultInjector: (phase) => {
            if (phase !== "read" || ++resourceReads !== 2) return;
            if (failureKind === "unreadable") {
              throw Object.assign(new Error("private unreadable lock"), { code: "EACCES" });
            }
            throw new Error("private lock provider failure");
          },
          workspaceRoot: context.workspaceRoot,
        });
      }
      const manager = createLocalPluginPackageManager({
        bootstrap: loadedBootstrap,
        ...context,
        resources,
      });
      const result = await manager.loadEnabled();
      expect(result, failureKind).toMatchObject({
        diagnostics: [{ code: "plugin-package-lock-unavailable" }],
        ok: false,
      });
      expect(JSON.stringify(result), failureKind).not.toContain("resource-");
      expect(JSON.stringify(result), failureKind).not.toContain("private");
    }

    for (const failureKind of ["oversize", "unsupported"] as const) {
      const context = await fixture();
      const source = await writePackage(context.workspaceRoot, `example-state-${failureKind}`, [
        "./plugins/panel.js",
      ]);
      const setup = createLocalPluginPackageManager({
        bootstrap: await bootstrap(context.resources),
        ...context,
      });
      expect(await setup.add({ scope: "personal", source })).toMatchObject({ ok: true });
      const stateFiles = await readdir(path.join(context.userDataRoot, "workspaces"));
      const stateFile = path.join(context.userDataRoot, "workspaces", stateFiles[0]!);
      if (failureKind === "oversize") {
        await writeFile(stateFile, "x".repeat(1_048_577));
      } else {
        await rm(stateFile);
        await mkdir(stateFile);
      }
      const manager = createLocalPluginPackageManager({
        bootstrap: await bootstrap(context.resources),
        ...context,
      });
      const result = await manager.loadEnabled();
      expect(result, failureKind).toMatchObject({
        diagnostics: [{ code: "plugin-package-user-state-unavailable" }],
        ok: false,
      });
      expect(JSON.stringify(result), failureKind).not.toContain("resource-");
    }

    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-configuration-provider", [
      "./plugins/entry.js",
    ]);
    const loadedBootstrap = await bootstrap(context.resources);
    let reads = 0;
    const resources = await createLocalResourceProvider({
      faultInjector: (phase) => {
        if (phase === "read" && ++reads === 2) {
          throw new Error("private configuration provider failure");
        }
      },
      workspaceRoot: context.workspaceRoot,
    });
    const manager = createLocalPluginPackageManager({
      bootstrap: loadedBootstrap,
      ...context,
      resources,
    });
    const result = await manager.add({ scope: "blueprint", source });
    expect(result).toEqual({
      diagnostics: [
        {
          code: "workspace-configuration-provider-failure",
          message: "Workspace configuration access failed",
        },
      ],
      ok: false,
    });
    expect(JSON.stringify(result)).not.toContain("resource-");
    expect(JSON.stringify(result)).not.toContain("private");
  });

  test("compares the exact lock under coordination before publishing blueprint state", async () => {
    const context = await fixture();
    const source = await writePackage(context.workspaceRoot, "example-cas", ["./plugins/entry.js"]);
    let enteredImport!: () => void;
    let releaseImport!: () => void;
    const imported = new Promise<void>((resolve) => {
      enteredImport = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseImport = resolve;
    });
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => {
        enteredImport();
        await release;
        return { plugin: registration("example.cas") };
      },
      ...context,
    });
    await manager.add({ scope: "blueprint", source });
    const configurationFile = path.join(context.workspaceRoot, "groma", "groma.yaml");
    const lockFile = path.join(context.workspaceRoot, "groma", "packages.lock");
    const configurationBefore = await readFile(configurationFile);
    const enabling = manager.enable({
      entry: "./plugins/entry.js",
      name: "example-cas",
      scope: "blueprint",
      trustFullUserPermissions: true,
    });
    await imported;
    const concurrentLock = JSON.parse(await readFile(lockFile, "utf8"));
    concurrentLock.packages.push({
      enabled: [],
      manifestIntegrity: `sha256:${"1".repeat(64)}`,
      name: "parallel",
      source: "./plugins/parallel",
      version: "1.0.0",
    });
    concurrentLock.packages.sort((left: { name: string }, right: { name: string }) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
    await writeFile(lockFile, `${JSON.stringify(concurrentLock, null, 2)}\n`);
    releaseImport();

    expect(await enabling).toMatchObject({
      diagnostics: [
        {
          code: "plugin-package-state-indeterminate",
          message:
            "Blueprint plugin trust state may have committed; verify the exact package entry and current selection before retrying",
        },
      ],
      ok: false,
    });
    expect(await readFile(configurationFile)).toEqual(configurationBefore);
    expect(JSON.parse(await readFile(lockFile, "utf8"))).toMatchObject({
      packages: [{ name: "example-cas" }, { name: "parallel" }],
    });
  });

  test("rejects Git shorthand remotely in both scopes before touching user state", async () => {
    const context = await fixture();
    let imports = 0;
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => {
        imports += 1;
        return {};
      },
      ...context,
    });
    for (const source of [
      "git@github.com:org/repo.git",
      "github.com:org/repo.git",
      "example.com:team/plugin.git",
    ]) {
      for (const scope of ["blueprint", "personal"] as const) {
        expect(await manager.add({ scope, source }), `${scope}:${source}`).toMatchObject({
          diagnostics: [{ code: "remote-plugin-package-acquisition-out-of-scope" }],
          ok: false,
        });
      }
    }
    expect(imports).toBe(0);
    expect(await readdir(context.userDataRoot)).toEqual([]);
  });

  test("prunes trust by stable scope and package identity when a symlink source disappears", async () => {
    if (process.platform === "win32") return;

    const context = await fixture();
    const targetSource = await writePackage(context.workspaceRoot, "example-symlink-trust", [
      "./plugins/entry.js",
    ]);
    const linkSource = "./plugins/trusted-link";
    const linkPath = path.resolve(context.workspaceRoot, linkSource);
    await symlink(path.resolve(context.workspaceRoot, targetSource), linkPath, "dir");
    let imports = 0;
    const manager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.resources),
      importModule: async () => {
        imports += 1;
        return { plugin: registration("example.symlink-trust") };
      },
      ...context,
    });
    await manager.add({ scope: "blueprint", source: linkSource });
    await manager.enable({
      entry: "./plugins/entry.js",
      name: "example-symlink-trust",
      scope: "blueprint",
      trustFullUserPermissions: true,
    });
    await manager.disable({
      entry: "./plugins/entry.js",
      name: "example-symlink-trust",
      scope: "blueprint",
    });
    await unlink(linkPath);
    expect(
      await manager.remove({ name: "example-symlink-trust", scope: "blueprint" }),
    ).toMatchObject({ ok: true });
    await symlink(path.resolve(context.workspaceRoot, targetSource), linkPath, "dir");
    await manager.add({ scope: "blueprint", source: linkSource });
    const beforeEnable = imports;
    expect(
      await manager.enable({
        entry: "./plugins/entry.js",
        name: "example-symlink-trust",
        scope: "blueprint",
      }),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-full-user-permissions-trust-required" }],
      ok: false,
    });
    expect(imports).toBe(beforeEnable);
  });
});
