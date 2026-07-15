import { afterEach, describe, expect, test } from "bun:test";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { checkPluginPackageCompatibility } from "groma/plugin-sdk";

import { scaffoldLocalPluginPackage } from "../plugin-scaffolding.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function workspace(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "groma-scaffold-"));
  roots.push(root);
  return root;
}

const request = Object.freeze({
  destination: "./plugins/example",
  name: "example-package",
  pluginId: "example.plugin",
  provides: Object.freeze(["example.secondary/v1", "example.capability/v1"]),
});

describe("local plugin scaffolding", () => {
  test("publishes one deterministic public-only package", async () => {
    const root = await workspace();
    const first = await scaffoldLocalPluginPackage(request, { workspaceRoot: root });
    const second = await scaffoldLocalPluginPackage(
      { ...request, destination: "./plugins/copy" },
      { workspaceRoot: root },
    );

    expect(first).toMatchObject({
      ok: true,
      value: {
        destination: "./plugins/example",
        entry: "./plugins/plugin.ts",
        files: [
          "groma.package.json",
          "package.json",
          "plugins/plugin.ts",
          "tests/conformance.test.ts",
        ],
        name: "example-package",
        pluginId: "example.plugin",
        provides: ["example.capability/v1", "example.secondary/v1"],
      },
    });
    expect(second.ok).toBeTrue();
    if (!first.ok || !second.ok) throw new Error("scaffolding failed");
    expect(Object.isFrozen(first.value)).toBeTrue();
    expect(Object.isFrozen(first.value.files)).toBeTrue();
    expect(Object.isFrozen(first.value.provides)).toBeTrue();
    for (const file of first.value.files) {
      expect(await readFile(path.join(root, first.value.destination, file))).toEqual(
        await readFile(path.join(root, second.value.destination, file)),
      );
    }
    const manifest = JSON.parse(
      await readFile(path.join(root, first.value.destination, "groma.package.json"), "utf8"),
    ) as unknown;
    expect(checkPluginPackageCompatibility(manifest)).toMatchObject({ ok: true });
    const entry = await readFile(
      path.join(root, first.value.destination, "plugins/plugin.ts"),
      "utf8",
    );
    const conformance = await readFile(
      path.join(root, first.value.destination, "tests/conformance.test.ts"),
      "utf8",
    );
    expect(entry).toContain('import type { PluginRegistration } from "groma/plugin-sdk"');
    expect(conformance).toContain('from "groma/plugin-sdk/conformance"');
    for (const source of [entry, conformance]) {
      expect(source).not.toContain("/src/");
      expect(source).not.toMatch(/\.\.\/.*(?:core|host|application|persistence|standard-model)/);
    }
  });

  test("rejects invalid, duplicate, and reserved identities before creating a destination", async () => {
    const root = await workspace();
    const cases = [
      [{ ...request, name: "Invalid Package" }, "plugin-scaffold-invalid"],
      [{ ...request, name: "groma" }, "plugin-scaffold-invalid"],
      [{ ...request, destination: "./groma/plugin" }, "plugin-scaffold-invalid"],
      [{ ...request, pluginId: "Invalid/Plugin" }, "plugin-scaffold-invalid"],
      [{ ...request, pluginId: "official.conflict" }, "plugin-package-plugin-id-reserved"],
      [
        {
          ...request,
          provides: ["example.capability/v1", "example.capability/v1"],
        },
        "plugin-scaffold-invalid",
      ],
      [{ ...request, provides: ["not-a-versioned-capability"] }, "plugin-scaffold-invalid"],
      [{ ...request, provides: ["groma.graph/v1"] }, "plugin-scaffold-capability-conflict"],
    ] as const;
    for (const [index, [item, code]] of cases.entries()) {
      const destination =
        item.destination === request.destination ? `./invalid/${index}` : item.destination;
      const result = await scaffoldLocalPluginPackage(
        { ...item, destination },
        { workspaceRoot: root },
      );
      expect(result).toMatchObject({ diagnostics: [{ code }], ok: false });
      await expect(lstat(path.join(root, destination))).rejects.toThrow();
    }
    await expect(lstat(path.join(root, "invalid"))).rejects.toThrow();
  });

  test("keeps conflicts and interrupted writes failure-atomic", async () => {
    const root = await workspace();
    const conflict = path.join(root, "existing");
    await writeFile(conflict, "owned by the user\n");
    expect(
      await scaffoldLocalPluginPackage(
        { ...request, destination: "./existing" },
        { workspaceRoot: root },
      ),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-scaffold-destination-conflict" }],
      ok: false,
    });
    expect(await readFile(conflict, "utf8")).toBe("owned by the user\n");

    const blockedParent = path.join(root, "blocked-parent");
    await writeFile(blockedParent, "also owned by the user\n");
    expect(
      await scaffoldLocalPluginPackage(
        { ...request, destination: "./blocked-parent/example" },
        { workspaceRoot: root },
      ),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-scaffold-destination-conflict" }],
      ok: false,
    });
    expect(await readFile(blockedParent, "utf8")).toBe("also owned by the user\n");

    const lateDestination = path.join(root, "late-conflict");
    expect(
      await scaffoldLocalPluginPackage(
        { ...request, destination: "./late-conflict" },
        {
          faultInjector: async (phase) => {
            if (phase === "before-publish") await mkdir(lateDestination);
          },
          workspaceRoot: root,
        },
      ),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-scaffold-destination-conflict" }],
      ok: false,
    });
    expect(await readdir(lateDestination)).toEqual([]);

    const externallyChanged = path.join(root, "externally-changed");
    expect(
      await scaffoldLocalPluginPackage(
        { ...request, destination: "./externally-changed" },
        {
          faultInjector: async (phase) => {
            if (phase === "after-reservation") {
              await writeFile(path.join(externallyChanged, "owned.txt"), "external\n");
              throw new Error("private injected failure");
            }
          },
          workspaceRoot: root,
        },
      ),
    ).toMatchObject({
      diagnostics: [{ code: "plugin-scaffold-publication-failed" }],
      ok: false,
    });
    expect(await readFile(path.join(externallyChanged, "owned.txt"), "utf8")).toBe("external\n");

    for (const phase of [
      "after-entry-write",
      "after-manifest-write",
      "before-publish",
      "after-reservation",
      "during-publish",
    ] as const) {
      const destination = `./${phase}`;
      expect(
        await scaffoldLocalPluginPackage(
          { ...request, destination },
          {
            faultInjector: (current) => {
              if (current === phase) throw new Error("private injected failure");
            },
            workspaceRoot: root,
          },
        ),
      ).toEqual({
        diagnostics: [
          {
            code: "plugin-scaffold-publication-failed",
            message: "Plugin scaffold could not be published",
          },
        ],
        ok: false,
      });
      await expect(lstat(path.join(root, destination))).rejects.toThrow();
      expect((await readdir(root)).filter((item) => item.startsWith(".groma-scaffold-"))).toEqual(
        [],
      );
    }
  });

  test("rejects destinations that cannot feed the portable blueprint package workflow", async () => {
    const root = await workspace();
    const outside = await workspace();
    await symlink(outside, path.join(root, "outside"), "dir");
    for (const destination of ["../escape", path.join(outside, "absolute"), "./outside/package"]) {
      const result = await scaffoldLocalPluginPackage(
        { ...request, destination },
        { workspaceRoot: root },
      );
      expect(result).toMatchObject({ ok: false });
    }
    await expect(lstat(path.join(outside, "absolute"))).rejects.toThrow();
    await expect(lstat(path.join(outside, "package"))).rejects.toThrow();
    expect(await readdir(outside)).toEqual([]);
  });

  test("contains an unavailable workspace root as a stable publication failure", async () => {
    const root = await workspace();
    await rm(root, { force: true, recursive: true });

    expect(await scaffoldLocalPluginPackage(request, { workspaceRoot: root })).toEqual({
      diagnostics: [
        {
          code: "plugin-scaffold-publication-failed",
          message: "Plugin scaffold could not be published",
        },
      ],
      ok: false,
    });
  });
});
