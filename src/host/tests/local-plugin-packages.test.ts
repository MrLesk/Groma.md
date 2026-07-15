import { afterEach, describe, expect, test } from "bun:test";
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

import { createLocalResourceProvider } from "../../persistence/index.ts";
import {
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
      diagnostics: [{ code: "plugin-package-state-invalid" }],
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
      fileReadObserver: async ({ file }) => {
        if (path.basename(file) !== path.basename(swappedManifest) || swappedOnce) return;
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
      fileReadObserver: async ({ file }) => {
        if (path.basename(file) !== path.basename(growingManifest) || grew) return;
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
      diagnostics: [{ code: "plugin-package-lock-changed" }],
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
    for (const scope of ["blueprint", "personal"] as const) {
      expect(await manager.add({ scope, source: "git@github.com:org/repo.git" })).toMatchObject({
        diagnostics: [{ code: "remote-plugin-package-acquisition-out-of-scope" }],
        ok: false,
      });
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
