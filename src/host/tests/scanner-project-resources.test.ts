import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { Result } from "../../core/index.ts";
import type { ScannerProjectResources, ScannerResourcePage } from "../../plugin-sdk/scanner.ts";
import type { BootstrapArchitecture, BootstrapPlatform } from "../bootstrap-configuration.ts";
import {
  createLocalScannerProjectResources,
  localScannerProjectResourcesBounds,
} from "../scanner-project-resources.ts";

const temporaryRoots: string[] = [];
const textDecoder = new TextDecoder();

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

interface TestRoots {
  readonly coordinationRoot?: string;
  readonly workspaceRoot: string;
}

async function fixture(): Promise<TestRoots> {
  const root = await mkdtemp(path.join(tmpdir(), "groma-scanner-project-resources-"));
  temporaryRoots.push(root);
  const workspaceRoot = path.join(root, "workspace");
  await mkdir(workspaceRoot);
  if (process.platform === "win32") return { workspaceRoot };
  const coordinationRoot = path.join(root, "coordination");
  await mkdir(coordinationRoot, { mode: 0o700 });
  return { coordinationRoot, workspaceRoot };
}

function target(roots: TestRoots, source: string) {
  return {
    architecture: (process.arch === "arm64" ? "arm64" : "x64") as BootstrapArchitecture,
    ...(roots.coordinationRoot === undefined ? {} : { coordinationRoot: roots.coordinationRoot }),
    platform: process.platform as BootstrapPlatform,
    source,
    workspaceRoot: roots.workspaceRoot,
  };
}

function diagnosticCode<T>(result: Result<T>): string | undefined {
  return result.ok ? undefined : result.diagnostics[0]?.code;
}

async function createResources(roots: TestRoots, source: string): Promise<ScannerProjectResources> {
  const created = await createLocalScannerProjectResources(target(roots, source));
  if (!created.ok) throw new Error(created.diagnostics[0]?.code);
  return created.value;
}

async function collectResources(
  resources: ScannerProjectResources,
  resource = ".",
): Promise<ScannerResourcePage[]> {
  const pages: ScannerResourcePage[] = [];
  let cursor: string | undefined;
  do {
    const page = await resources.enumerate({
      ...(cursor === undefined ? {} : { cursor }),
      limit: 2,
      maxDepth: 8,
      resource,
      scope: "source",
    });
    if (!page.ok) throw new Error(page.diagnostics[0]?.code);
    pages.push(page.value);
    cursor = page.value.nextCursor;
  } while (cursor !== undefined);
  return pages;
}

describe("local scanner project resources", () => {
  test("projects a bounded root view without aggregate-owned state", async () => {
    const roots = await fixture();
    await mkdir(path.join(roots.workspaceRoot, "groma"), { recursive: true });
    await mkdir(path.join(roots.workspaceRoot, ".groma-cache"), { recursive: true });
    await mkdir(path.join(roots.workspaceRoot, ".git", "objects"), { recursive: true });
    await mkdir(path.join(roots.workspaceRoot, "src", "domain"), { recursive: true });
    await writeFile(path.join(roots.workspaceRoot, "groma", "groma.yaml"), "private");
    await writeFile(path.join(roots.workspaceRoot, ".groma-cache", "index"), "private");
    await writeFile(path.join(roots.workspaceRoot, ".git", "objects", "state"), "private");
    await writeFile(path.join(roots.workspaceRoot, "README.md"), "public");
    await writeFile(path.join(roots.workspaceRoot, "src", "domain", "model.ts"), "model");
    const resources = await createResources(roots, ".");

    const pages = await collectResources(resources);
    const entries = pages.flatMap((page) => page.entries);

    expect(entries.map((entry) => entry.resource)).toEqual([
      "README.md",
      "src",
      "src/domain",
      "src/domain/model.ts",
    ]);
    expect(entries.every((entry) => entry.scope === "source")).toBeTrue();
    expect(Object.isFrozen(resources)).toBeTrue();
    expect(pages.every(Object.isFrozen)).toBeTrue();
    expect(entries.every(Object.isFrozen)).toBeTrue();
    expect(
      diagnosticCode(
        await resources.read({ maxBytes: 64, resource: "groma/groma.yaml", scope: "source" }),
      ),
    ).toBe("resource-excluded");
    expect(
      diagnosticCode(
        await resources.enumerate({
          limit: 10,
          maxDepth: 1,
          resource: ".GROMA-CACHE",
          scope: "source",
        }),
      ),
    ).toBe("resource-excluded");
    expect(
      diagnosticCode(
        await resources.read({
          maxBytes: 64,
          resource: ".GIT/objects/state",
          scope: "source",
        }),
      ),
    ).toBe("resource-excluded");
    expect(
      diagnosticCode(
        await resources.enumerate({
          limit: 10,
          maxDepth: 4,
          resource: ".GIT",
          scope: "source",
        }),
      ),
    ).toBe("resource-excluded");
    const read = await resources.read({ maxBytes: 64, resource: "README.md", scope: "source" });
    expect(read.ok).toBeTrue();
    if (read.ok) expect(textDecoder.decode(read.value.bytes)).toBe("public");
    expect(JSON.stringify(pages)).not.toContain(roots.workspaceRoot);
  });

  test("keeps project-owned reserved names visible below a nested source", async () => {
    const roots = await fixture();
    await mkdir(path.join(roots.workspaceRoot, "apps", "api", "groma"), { recursive: true });
    await mkdir(path.join(roots.workspaceRoot, "apps", "api", ".groma-cache"), {
      recursive: true,
    });
    await mkdir(path.join(roots.workspaceRoot, "apps", "api", ".git", "objects"), {
      recursive: true,
    });
    await writeFile(path.join(roots.workspaceRoot, "apps", "api", "groma", "intent.md"), "i");
    await writeFile(path.join(roots.workspaceRoot, "apps", "api", ".groma-cache", "local"), "c");
    await writeFile(path.join(roots.workspaceRoot, "apps", "api", ".git", "objects", "state"), "h");
    const resources = await createResources(roots, "apps/api");

    const pages = await collectResources(resources);

    expect(pages.flatMap((page) => page.entries.map((entry) => entry.resource))).toEqual([
      ".git",
      ".git/objects",
      ".git/objects/state",
      ".groma-cache",
      ".groma-cache/local",
      "groma",
      "groma/intent.md",
    ]);
    const read = await resources.read({
      maxBytes: 8,
      resource: "groma/intent.md",
      scope: "source",
    });
    expect(read.ok).toBeTrue();
    if (read.ok) expect(textDecoder.decode(read.value.bytes)).toBe("i");
  });

  test("fails closed for missing, non-directory, and linked project sources", async () => {
    const roots = await fixture();
    await writeFile(path.join(roots.workspaceRoot, "file"), "not a directory");
    const outside = path.join(path.dirname(roots.workspaceRoot), "outside");
    await mkdir(outside);
    try {
      await symlink(outside, path.join(roots.workspaceRoot, "linked"), "dir");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
    }

    for (const source of ["missing", "file", "linked"]) {
      const created = await createLocalScannerProjectResources(target(roots, source));
      expect(diagnosticCode(created), source).toBe("scanner-project-resources-unavailable");
      expect(JSON.stringify(created)).not.toContain(roots.workspaceRoot);
      expect(JSON.stringify(created)).not.toContain(outside);
    }
  });

  test("enforces fixed request bounds and hostile-shape validation", async () => {
    const roots = await fixture();
    await writeFile(path.join(roots.workspaceRoot, "README.md"), "public");
    const resources = await createResources(roots, ".");
    const invalidReads: unknown[] = [
      { maxBytes: 0, resource: "README.md", scope: "source" },
      {
        maxBytes: localScannerProjectResourcesBounds.maxReadBytes + 1,
        resource: "README.md",
        scope: "source",
      },
      { maxBytes: 8, resource: "../outside", scope: "source" },
      { maxBytes: 8, resource: "/outside", scope: "source" },
      { maxBytes: 8, resource: "README.md", scope: "bad scope" },
      { extra: true, maxBytes: 8, resource: "README.md", scope: "source" },
    ];
    for (const request of invalidReads) {
      expect(
        diagnosticCode(await resources.read(request as Parameters<typeof resources.read>[0])),
      ).toBe("invalid-scanner-resource-request");
    }
    const invalidEnumerations: unknown[] = [
      { limit: 0, maxDepth: 1, resource: ".", scope: "source" },
      {
        limit: localScannerProjectResourcesBounds.maxPageSize + 1,
        maxDepth: 1,
        resource: ".",
        scope: "source",
      },
      {
        limit: 1,
        maxDepth: localScannerProjectResourcesBounds.maxEnumerationDepth + 1,
        resource: ".",
        scope: "source",
      },
      { cursor: "bad\n", limit: 1, maxDepth: 1, resource: ".", scope: "source" },
    ];
    for (const request of invalidEnumerations) {
      expect(
        diagnosticCode(
          await resources.enumerate(request as Parameters<typeof resources.enumerate>[0]),
        ),
      ).toBe("invalid-scanner-resource-request");
    }
    const hostile = new Proxy(
      { maxBytes: 8, resource: "README.md", scope: "source" },
      {
        ownKeys: () => {
          throw new Error(roots.workspaceRoot);
        },
      },
    );
    const result = await resources.read(hostile);
    expect(diagnosticCode(result)).toBe("invalid-scanner-resource-request");
    expect(JSON.stringify(result)).not.toContain(roots.workspaceRoot);
  });
});
