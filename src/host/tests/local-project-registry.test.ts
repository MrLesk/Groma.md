import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { canonicalizeObservationSessionBegin } from "../../core/index.ts";
import {
  createLocalResourceProvider,
  evidenceSourceLocator,
  type LocalResourceProvider,
  type StagedReplacementHandle,
} from "../../persistence/index.ts";
import {
  bootstrapConfigurationBounds,
  createLocalPluginPackageManager,
  createLocalProjectRegistry,
  createYamlConfigurationParser,
  projectObservationBoundary,
  resolveProjectSourcePath,
  serializeBootstrapConfiguration,
  type BootstrapConfigurationLoad,
  type ProjectRegistrationInput,
} from "../index.ts";

const roots: string[] = [];
const configurationRelative = path.join("groma", "groma.yaml");

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

function projectInput(name: string, source = ".", resourceRoot = "."): ProjectRegistrationInput {
  return Object.freeze({
    coverage: Object.freeze([Object.freeze({ id: "source", resourceRoot })]),
    name,
    scanners: Object.freeze([]),
    source,
  });
}

function bytes(value: number): (length: number) => Uint8Array {
  return (length) => new Uint8Array(length).fill(value);
}

async function fixture() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "groma-project-registry-"));
  const userDataRoot = await mkdtemp(path.join(tmpdir(), "groma-project-user-"));
  roots.push(workspaceRoot, userDataRoot);
  await mkdir(path.join(workspaceRoot, "groma"), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, configurationRelative),
    serializeBootstrapConfiguration({
      packageDeclarations: [],
      projectRegistrations: [
        {
          coverage: [{ id: "source", resourceRoot: "." as never }],
          id: "project.default",
          name: "Default",
          scanners: [],
          source: "." as never,
        },
      ],
      requestedRuntimePlugins: [{ id: "official.alpha", namespace: "official" }],
      retiredProjectIds: [],
      schema: "groma/v0.1",
    }),
  );
  const resources = await createLocalResourceProvider({ workspaceRoot });
  return { resources, userDataRoot, workspaceRoot };
}

async function bootstrap(workspaceRoot: string): Promise<BootstrapConfigurationLoad> {
  const parser = createYamlConfigurationParser();
  const parsed = parser.parse(
    Uint8Array.from(await readFile(path.join(workspaceRoot, configurationRelative))),
  );
  if (!parsed.ok) throw new Error(parsed.diagnostics[0]?.code);
  return Object.freeze({
    configuration: parsed.value,
    locator: Object.freeze({ configuration: "groma/groma.yaml" as never, root: "." as never }),
    state: "configured" as const,
  });
}

async function writePackage(workspaceRoot: string, name: string): Promise<string> {
  const relative = `./plugins/${name}`;
  const root = path.join(workspaceRoot, "plugins", name);
  await mkdir(path.join(root, "plugins"), { recursive: true });
  await writeFile(
    path.join(root, "groma.package.json"),
    `${JSON.stringify(
      {
        apiVersion: "groma.package/v1",
        name,
        plugins: ["./plugins/entry.js"],
        runtimeApiVersion: "groma.plugin/v1",
        sdkApiVersion: "groma.sdk/v1",
        version: "1.0.0",
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(path.join(root, "plugins", "entry.js"), "export const marker = true;\n");
  return relative;
}

function forwardingResources(
  resources: LocalResourceProvider,
  commitReplacement: LocalResourceProvider["commitReplacement"],
): LocalResourceProvider {
  return Object.freeze({
    acquireCoordination: resources.acquireCoordination.bind(resources),
    cleanupReplacementStages: resources.cleanupReplacementStages.bind(resources),
    commitReplacement,
    discardReplacement: resources.discardReplacement.bind(resources),
    enumerate: resources.enumerate.bind(resources),
    read: resources.read.bind(resources),
    releaseCoordination: resources.releaseCoordination.bind(resources),
    removeResource: resources.removeResource.bind(resources),
    stageReplacement: resources.stageReplacement.bind(resources),
    withCoordination: resources.withCoordination.bind(resources),
  });
}

describe("local project registry", () => {
  test("adds, gets, lists, updates, no-ops, removes, and permanently retires stable identities", async () => {
    const context = await fixture();
    let commits = 0;
    let stages = 0;
    const forwarded = forwardingResources(context.resources, async (handle) => {
      commits += 1;
      return await context.resources.commitReplacement(handle);
    });
    const resources = Object.freeze({
      ...forwarded,
      stageReplacement: async (...args: Parameters<LocalResourceProvider["stageReplacement"]>) => {
        stages += 1;
        return await context.resources.stageReplacement(...args);
      },
    });
    const registry = createLocalProjectRegistry({ entropy: bytes(0), resources });
    const added = await registry.add(
      Object.freeze({
        coverage: [
          { id: "tests", resourceRoot: "test" },
          { id: "source", resourceRoot: "src" },
        ],
        name: 'API "edge" \\ 🚀',
        scanners: [{ configuration: { z: true, a: [1, null] }, id: "official.typescript" }],
        source: "apps/api",
      }),
    );
    expect(added).toMatchObject({
      ok: true,
      value: {
        availability: "unavailable",
        coverage: [
          { id: "source", resourceRoot: "src" },
          { id: "tests", resourceRoot: "test" },
        ],
        id: "project_00000000000000000000000000000000",
      },
    });
    if (!added.ok) return;
    expect(await registry.get({ id: added.value.id })).toEqual(added);
    expect(await registry.list()).toMatchObject({
      ok: true,
      value: [{ id: "project.default" }, { id: added.value.id }],
    });

    const beforeNoOp = await readFile(path.join(context.workspaceRoot, configurationRelative));
    const mutationsBeforeNoOp = { commits, stages };
    const noOp = await registry.update({
      coverage: added.value.coverage,
      expectedRevision: added.value.revision,
      id: added.value.id,
      name: added.value.name,
      scanners: added.value.scanners,
      source: added.value.source,
    });
    expect(noOp).toEqual(added);
    expect(await readFile(path.join(context.workspaceRoot, configurationRelative))).toEqual(
      beforeNoOp,
    );
    expect({ commits, stages }).toEqual(mutationsBeforeNoOp);

    const updated = await registry.update({
      ...projectInput("API updated", "apps/api", "src"),
      expectedRevision: added.value.revision,
      id: added.value.id,
    });
    expect(updated).toMatchObject({ ok: true, value: { name: "API updated" } });
    expect(
      await registry.update({
        ...projectInput("stale"),
        expectedRevision: added.value.revision,
        id: added.value.id,
      }),
    ).toMatchObject({ diagnostics: [{ code: "project-revision-conflict" }], ok: false });
    if (!updated.ok) return;
    expect(
      await registry.remove({ id: added.value.id, expectedRevision: updated.value.revision }),
    ).toMatchObject({
      ok: true,
      value: { removed: added.value.id },
    });

    const restarted = createLocalProjectRegistry({
      entropy: bytes(0),
      resources: context.resources,
    });
    expect(await restarted.add(projectInput("Must not reuse"))).toMatchObject({
      diagnostics: [{ code: "project-identity-unavailable" }],
      ok: false,
    });
    const parsed = createYamlConfigurationParser().parse(
      Uint8Array.from(await readFile(path.join(context.workspaceRoot, configurationRelative))),
    );
    expect(parsed).toMatchObject({
      ok: true,
      value: { retiredProjectIds: [added.value.id] },
    });
  });

  test("derives bounded availability without exposing absolute paths or touching sources", async () => {
    const context = await fixture();
    for (const directory of ["empty", "one", "two", "large"]) {
      await mkdir(path.join(context.workspaceRoot, directory));
    }
    await writeFile(path.join(context.workspaceRoot, "one", "a"), "a");
    await writeFile(path.join(context.workspaceRoot, "two", "a"), "a");
    await writeFile(path.join(context.workspaceRoot, "two", "b"), "b");
    for (let index = 0; index < 128; index += 1) {
      await writeFile(
        path.join(context.workspaceRoot, "large", String(index).padStart(3, "0")),
        "x",
      );
    }
    await writeFile(path.join(context.workspaceRoot, "file"), "unchanged");
    await symlink("empty", path.join(context.workspaceRoot, "link"));
    const registry = createLocalProjectRegistry({
      entropy: (() => {
        let next = 1;
        return (length: number) => new Uint8Array(length).fill(next++);
      })(),
      resources: context.resources,
    });
    for (const [source, availability] of [
      ["empty", "available"],
      ["one", "available"],
      ["two", "available"],
      ["large", "available"],
      ["file", "unavailable"],
      ["link", "unavailable"],
      ["missing", "unavailable"],
    ] as const) {
      expect(await registry.add(projectInput(source, source))).toMatchObject({
        ok: true,
        value: { availability, source },
      });
    }
    expect(await readFile(path.join(context.workspaceRoot, "file"), "utf8")).toBe("unchanged");
    const listed = await registry.list();
    expect(JSON.stringify(listed)).not.toContain(context.workspaceRoot);
  });

  test("fails availability closed for hostile and malformed enumeration results", async () => {
    let accessorCalls = 0;
    const hostileOuter = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(hostileOuter, {
      ok: {
        enumerable: true,
        get: () => {
          accessorCalls += 1;
          return true;
        },
      },
      value: {
        enumerable: true,
        value: Object.freeze({ entries: Object.freeze([]), truncatedByDepth: false }),
      },
    });
    const hostilePage = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(hostilePage, {
      entries: {
        enumerable: true,
        get: () => {
          accessorCalls += 1;
          return [];
        },
      },
      truncatedByDepth: { enumerable: true, value: false },
    });
    const exactOverflow = Object.freeze({
      diagnostics: Object.freeze([
        Object.freeze({
          code: "resource-directory-overflow",
          details: Object.freeze({ maximum: 1 }),
          message: "A directory exceeds the explicit enumeration entry bound",
        }),
      ]),
      ok: false as const,
    });
    const rawResults: readonly unknown[] = Object.freeze([
      new Proxy(
        Object.freeze({
          ok: true as const,
          value: Object.freeze({ entries: Object.freeze([]), truncatedByDepth: false }),
        }),
        {},
      ),
      hostileOuter,
      Object.freeze({ ok: true as const }),
      Object.freeze({ ok: true as const, value: hostilePage }),
      Object.freeze({
        ok: true as const,
        value: Object.freeze({
          entries: Object.freeze([new Proxy({ kind: "file", locator: "file", size: 1 }, {})]),
          truncatedByDepth: false,
        }),
      }),
      Object.freeze({
        ok: true as const,
        value: Object.freeze({
          entries: Object.freeze([{ kind: "file", locator: "../escape", size: 1 }]),
          truncatedByDepth: false,
        }),
      }),
      Object.freeze({
        ok: true as const,
        value: Object.freeze({
          entries: Object.freeze([{ kind: "directory", locator: "directory", size: 1 }]),
          truncatedByDepth: false,
        }),
      }),
      Object.freeze({
        ok: true as const,
        value: Object.freeze({
          entries: Object.freeze([]),
          nextCursor: "x".repeat(64 * 1_024 + 1),
          truncatedByDepth: false,
        }),
      }),
      Object.freeze({
        ok: true as const,
        value: Object.freeze({ entries: Object.freeze([]), truncatedByDepth: "false" }),
      }),
      Object.freeze({
        diagnostics: Object.freeze([
          Object.freeze({
            ...exactOverflow.diagnostics[0],
            details: Object.freeze({ maximum: 1, unexpected: true }),
          }),
        ]),
        ok: false as const,
      }),
      Object.freeze({
        diagnostics: new Proxy(exactOverflow.diagnostics, {}),
        ok: false as const,
      }),
    ]);
    for (let index = 0; index < rawResults.length; index += 1) {
      const context = await fixture();
      const base = forwardingResources(
        context.resources,
        context.resources.commitReplacement.bind(context.resources),
      );
      const resources = Object.freeze({
        ...base,
        enumerate: async () => rawResults[index] as never,
      });
      const registry = createLocalProjectRegistry({ entropy: bytes(index + 80), resources });
      expect(await registry.add(projectInput(`Hostile ${index}`))).toMatchObject({
        ok: true,
        value: { availability: "unavailable" },
      });
    }
    expect(accessorCalls).toBe(0);
  });

  test("preserves source-relative coverage and pure target conventions", () => {
    for (const target of [
      {
        absoluteSourcePath: "/work/blueprint/apps/api",
        architecture: "x64" as const,
        platform: "darwin" as const,
        workspaceRoot: "/work/blueprint",
      },
      {
        absoluteSourcePath: "/work/blueprint/apps/api",
        architecture: "arm64" as const,
        platform: "linux" as const,
        workspaceRoot: "/work/blueprint",
      },
      {
        absoluteSourcePath: "C:\\work\\blueprint\\apps\\api",
        architecture: "x64" as const,
        platform: "win32" as const,
        workspaceRoot: "C:\\work\\blueprint",
      },
      {
        absoluteSourcePath: "D:\\work\\blueprint\\apps\\api",
        architecture: "arm64" as const,
        platform: "win32" as const,
        workspaceRoot: "D:\\work\\blueprint",
      },
    ]) {
      const { absoluteSourcePath, ...runtime } = target;
      expect(resolveProjectSourcePath({ ...runtime, source: "apps/api" })).toMatchObject({
        ok: true,
        value: { absoluteSourcePath, source: "apps/api" },
      });
    }
    for (const source of [
      "/absolute",
      "C:/drive",
      "C:\\drive",
      "\\\\server\\share",
      "../escape",
      "apps\\api",
    ]) {
      expect(
        resolveProjectSourcePath({
          architecture: "x64",
          platform: "linux",
          source,
          workspaceRoot: "/work/blueprint",
        }),
      ).toMatchObject({ diagnostics: [{ code: "invalid-project-source-locator" }], ok: false });
    }
    const boundary = projectObservationBoundary({
      coverage: [{ id: "source", resourceRoot: "src" as never }],
      id: "project.default",
      name: "API",
      scanners: [],
      source: "apps/api" as never,
    });
    expect(boundary).toEqual({
      projectId: "project.default",
      projectSource: "apps/api" as never,
      scopes: [{ id: "source", resourceRoot: "src" }],
    });
  });

  test("carries distinct registry identities through observation and evidence lanes", async () => {
    const context = await fixture();
    let identity = 20;
    const registry = createLocalProjectRegistry({
      entropy: (length) => new Uint8Array(length).fill(identity++),
      resources: context.resources,
    });
    const first = await registry.add(projectInput("First"));
    const second = await registry.add(projectInput("Second"));
    if (!first.ok || !second.ok) throw new Error("project fixture failed");
    const snapshots = [first.value, second.value];
    const lanes = snapshots.map((snapshot) => {
      const boundary = projectObservationBoundary({
        coverage: snapshot.coverage as never,
        id: snapshot.id,
        name: snapshot.name,
        scanners: snapshot.scanners,
        source: snapshot.source as never,
      });
      const begin = canonicalizeObservationSessionBegin({
        apiVersion: "groma.observation/v1",
        epoch: "epoch-1",
        projectId: boundary.projectId,
        scopes: boundary.scopes,
        source: { id: "official.test", instance: "default", version: "1.0.0" },
      });
      if (!begin.ok) throw new Error(begin.diagnostics[0]?.code);
      const evidenceIdentity = {
        key: "component.api",
        projectId: begin.value.projectId,
        scope: begin.value.scopes[0]!.id,
        sourceId: begin.value.source.id,
        sourceInstance: begin.value.source.instance,
      };
      return {
        evidenceIdentity,
        locator: evidenceSourceLocator(evidenceIdentity),
        observationProjectId: begin.value.projectId,
      };
    });
    expect(lanes.map((lane) => lane.observationProjectId)).toEqual([
      first.value.id,
      second.value.id,
    ]);
    expect(lanes.map((lane) => lane.evidenceIdentity.projectId)).toEqual([
      first.value.id,
      second.value.id,
    ]);
    expect(lanes[0]!.locator).not.toEqual(lanes[1]!.locator);
  });

  test("rebases project and package ownership under one coordination lane", async () => {
    const context = await fixture();
    const sourceA = await writePackage(context.workspaceRoot, "package-a");
    const sourceB = await writePackage(context.workspaceRoot, "package-b");
    const packageManager = createLocalPluginPackageManager({
      bootstrap: await bootstrap(context.workspaceRoot),
      maxEnabledPlugins: 53,
      resources: context.resources,
      userDataRoot: context.userDataRoot,
      workspaceRoot: context.workspaceRoot,
    });
    let identity = 2;
    const projects = createLocalProjectRegistry({
      entropy: (length) => new Uint8Array(length).fill(identity++),
      resources: context.resources,
    });
    const added = await projects.add(projectInput("Second"));
    expect(added).toMatchObject({ ok: true });
    expect(await packageManager.add({ scope: "blueprint", source: sourceA })).toMatchObject({
      ok: true,
    });
    if (!added.ok) return;
    expect(await projects.get({ id: added.value.id })).toMatchObject({
      ok: true,
      value: { revision: added.value.revision },
    });
    const updated = await projects.update({
      ...projectInput("Second updated"),
      expectedRevision: added.value.revision,
      id: added.value.id,
    });
    expect(updated).toMatchObject({ ok: true });

    const concurrentProject = projects.add(projectInput("Concurrent"));
    const concurrentPackage = packageManager.add({ scope: "blueprint" as const, source: sourceB });
    const concurrent = await Promise.all([concurrentProject, concurrentPackage]);
    for (let index = 0; index < concurrent.length; index += 1) {
      if (concurrent[index]!.ok) continue;
      if (index === 0)
        expect(await projects.add(projectInput("Concurrent retry"))).toMatchObject({ ok: true });
      else
        expect(await packageManager.add({ scope: "blueprint", source: sourceB })).toMatchObject({
          ok: true,
        });
    }
    const parsed = createYamlConfigurationParser().parse(
      Uint8Array.from(await readFile(path.join(context.workspaceRoot, configurationRelative))),
    );
    expect(parsed).toMatchObject({
      ok: true,
      value: {
        packageDeclarations: [{ name: "package-a" }, { name: "package-b" }],
        projectRegistrations: [
          { id: "project.default" },
          { name: "Second updated" },
          { name: expect.any(String) },
        ],
        requestedRuntimePlugins: [{ id: "official.alpha" }],
      },
    });
    if (updated.ok) {
      expect(await projects.get({ id: updated.value.id })).toMatchObject({
        ok: true,
        value: { revision: updated.value.revision },
      });
    }
  });

  test("reports thrown and malformed post-commit settlements as indeterminate", async () => {
    for (const mode of ["throw", "malformed"] as const) {
      const context = await fixture();
      const realCommit = context.resources.commitReplacement.bind(context.resources);
      const resources = forwardingResources(context.resources, async (handle) => {
        await realCommit(handle);
        if (mode === "throw") throw new Error("after commit");
        return Object.freeze({ state: "unknown" }) as never;
      });
      const registry = createLocalProjectRegistry({ entropy: bytes(9), resources });
      expect(await registry.add(projectInput(mode))).toMatchObject({
        diagnostics: [{ code: "project-registry-state-indeterminate" }],
        ok: false,
      });
      expect(
        await createLocalProjectRegistry({
          entropy: bytes(10),
          resources: context.resources,
        }).list(),
      ).toMatchObject({
        ok: true,
        value: [{ id: "project.default" }, { name: mode }],
      });
    }
  });

  test("reports a mismatched post-commit readback as indeterminate", async () => {
    const context = await fixture();
    let committed = false;
    const base = forwardingResources(
      context.resources,
      context.resources.commitReplacement.bind(context.resources),
    );
    const resources = Object.freeze({
      ...base,
      commitReplacement: async (
        handle: Parameters<LocalResourceProvider["commitReplacement"]>[0],
      ) => {
        const outcome = await base.commitReplacement(handle);
        committed = outcome.state === "committed";
        return outcome;
      },
      read: async (request: Parameters<LocalResourceProvider["read"]>[0]) => {
        const result = await base.read(request);
        if (!committed || !result.ok) return result;
        const changed = Uint8Array.from(result.value.bytes);
        changed[0] = changed[0] === 0 ? 1 : 0;
        return Object.freeze({
          ok: true as const,
          value: Object.freeze({ bytes: changed }),
        });
      },
    });
    const registry = createLocalProjectRegistry({ entropy: bytes(11), resources });
    expect(await registry.add(projectInput("Readback mismatch"))).toMatchObject({
      diagnostics: [{ code: "project-registry-state-indeterminate" }],
      ok: false,
    });
    expect(
      await createLocalProjectRegistry({ entropy: bytes(12), resources: context.resources }).list(),
    ).toMatchObject({
      ok: true,
      value: [{ id: "project.default" }, { name: "Readback mismatch" }],
    });
  });

  test("contains hostile or substituted coordination settlements after commit", async () => {
    const modes = [
      "outer-malformed",
      "outer-proxy",
      "outer-accessor",
      "substituted-settlement",
      "nested-proxy",
    ] as const;
    let accessorCalls = 0;
    for (let index = 0; index < modes.length; index += 1) {
      const mode = modes[index]!;
      const context = await fixture();
      const base = forwardingResources(
        context.resources,
        context.resources.commitReplacement.bind(context.resources),
      );
      const withCoordination: LocalResourceProvider["withCoordination"] = async (
        request,
        action,
      ) => {
        const ordinary = await base.withCoordination(request, action);
        if (!ordinary.ok) return ordinary;
        if (mode === "outer-malformed") return Object.freeze({ ok: true }) as never;
        if (mode === "outer-proxy") return new Proxy(ordinary, {}) as never;
        if (mode === "outer-accessor") {
          const hostile = Object.create(null) as Record<string, unknown>;
          Object.defineProperties(hostile, {
            ok: {
              enumerable: true,
              get: () => {
                accessorCalls += 1;
                return true;
              },
            },
            value: { enumerable: true, value: ordinary.value },
          });
          return hostile as never;
        }
        if (mode === "substituted-settlement") {
          return Object.freeze({
            ok: true as const,
            value: Object.freeze({ ok: true as const, value: ordinary.value }),
          }) as never;
        }
        return Object.freeze({
          ok: true as const,
          value: new Proxy(ordinary.value as object, {}),
        }) as never;
      };
      const resources = Object.freeze({ ...base, withCoordination });
      const attemptedId = `project_${String((index + 30).toString(16))
        .padStart(2, "0")
        .repeat(16)}`;
      const registry = createLocalProjectRegistry({
        entropy: bytes(index + 30),
        resources,
      });
      expect(await registry.add(projectInput(mode))).toEqual({
        diagnostics: [
          {
            code: "project-registry-state-indeterminate",
            details: { attemptedProjectId: attemptedId },
            message:
              "Project registration state may have committed; inspect the attempted project identity before retrying",
          },
        ],
        ok: false,
      });
      expect(
        await createLocalProjectRegistry({
          entropy: bytes(index + 60),
          resources: context.resources,
        }).get({ id: attemptedId }),
      ).toMatchObject({ ok: true, value: { id: attemptedId, name: mode } });
    }
    expect(accessorCalls).toBe(0);
  });

  test("rejects a coordination success that never executed the owned callback", async () => {
    const context = await fixture();
    let providerReads = 0;
    const base = forwardingResources(
      context.resources,
      context.resources.commitReplacement.bind(context.resources),
    );
    const resources = Object.freeze({
      ...base,
      read: async (request: Parameters<LocalResourceProvider["read"]>[0]) => {
        providerReads += 1;
        return await base.read(request);
      },
      withCoordination: (async () =>
        Object.freeze({
          ok: true as const,
          value: Object.freeze({ ok: true as const, value: Object.freeze({}) }),
        })) as LocalResourceProvider["withCoordination"],
    });
    const registry = createLocalProjectRegistry({ entropy: bytes(70), resources });
    expect(await registry.add(projectInput("Never executed"))).toMatchObject({
      diagnostics: [{ code: "project-registry-unavailable" }],
      ok: false,
    });
    expect(providerReads).toBe(0);
  });

  test("contains hostile and malformed stage results before publication", async () => {
    let accessorCalls = 0;
    const canonicalHandle = Object.freeze(Object.create(null));
    const accessorResult = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(accessorResult, {
      ok: {
        enumerable: true,
        get: () => {
          accessorCalls += 1;
          return true;
        },
      },
      value: { enumerable: true, value: canonicalHandle },
    });
    const accessorHandle = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(accessorHandle, "token", {
      enumerable: true,
      get: () => {
        accessorCalls += 1;
        return "secret";
      },
    });
    Object.freeze(accessorHandle);
    const exactFailure = Object.freeze({
      diagnostics: Object.freeze([
        Object.freeze({
          code: "replacement-stage-failed",
          details: Object.freeze({ commitState: "not-committed" }),
          message: "Replacement could not be staged completely",
        }),
      ]),
      ok: false as const,
    });
    const hostileResults: readonly unknown[] = Object.freeze([
      new Proxy(Object.freeze({ ok: true as const, value: canonicalHandle }), {}),
      accessorResult,
      Object.freeze({ extra: true, ok: true as const, value: canonicalHandle }),
      Object.freeze({ ok: "true", value: canonicalHandle }),
      Object.freeze({ ok: true as const, value: new Proxy(canonicalHandle, {}) }),
      Object.freeze({ ok: true as const, value: Promise.resolve(canonicalHandle) }),
      Object.freeze({ ok: true as const, value: "opaque-token" }),
      Object.freeze({ diagnostics: new Proxy(exactFailure.diagnostics, {}), ok: false as const }),
    ]);
    for (let index = 0; index < hostileResults.length; index += 1) {
      const context = await fixture();
      let commitCalls = 0;
      const base = forwardingResources(context.resources, async (handle) => {
        commitCalls += 1;
        return await context.resources.commitReplacement(handle);
      });
      const resources = Object.freeze({
        ...base,
        stageReplacement: async () => hostileResults[index] as never,
      });
      const registry = createLocalProjectRegistry({ entropy: bytes(index + 100), resources });
      expect(await registry.add(projectInput(`Stage ${index}`))).toMatchObject({
        diagnostics: [{ code: "project-registry-unavailable" }],
        ok: false,
      });
      expect(commitCalls).toBe(0);
    }
    const context = await fixture();
    let commitCalls = 0;
    const base = forwardingResources(context.resources, async (handle) => {
      commitCalls += 1;
      return await context.resources.commitReplacement(handle);
    });
    const resources = Object.freeze({
      ...base,
      stageReplacement: async () => exactFailure,
    });
    expect(
      await createLocalProjectRegistry({ entropy: bytes(120), resources }).add(
        projectInput("Exact stage failure"),
      ),
    ).toMatchObject({
      diagnostics: [{ code: "project-registry-not-committed" }],
      ok: false,
    });
    expect(commitCalls).toBe(0);
    const customContext = await fixture();
    let underlyingHandle: StagedReplacementHandle | undefined;
    let committedHandle: StagedReplacementHandle | undefined;
    const customBase = forwardingResources(customContext.resources, async (handle) => {
      committedHandle = handle;
      if (underlyingHandle === undefined) throw new Error("Stage handle was not captured");
      return await customContext.resources.commitReplacement(underlyingHandle);
    });
    const customResources = Object.freeze({
      ...customBase,
      stageReplacement: async (...args: Parameters<LocalResourceProvider["stageReplacement"]>) => {
        const staged = await customContext.resources.stageReplacement(...args);
        if (!staged.ok) return staged;
        underlyingHandle = staged.value;
        return Object.freeze({
          ok: true as const,
          value: accessorHandle as unknown as StagedReplacementHandle,
        });
      },
    });
    expect(
      await createLocalProjectRegistry({ entropy: bytes(121), resources: customResources }).add(
        projectInput("Opaque custom stage handle"),
      ),
    ).toMatchObject({ ok: true });
    expect(committedHandle as unknown).toBe(accessorHandle);
    expect(accessorCalls).toBe(0);
  });

  test("contains hostile and malformed post-commit readback without traps", async () => {
    const modes = [
      "outer-proxy",
      "outer-accessor",
      "outer-extra",
      "outer-malformed",
      "contents-proxy",
      "contents-accessor",
      "contents-extra",
      "bytes-proxy",
      "bytes-oversized",
      "failure-proxy",
    ] as const;
    let accessorCalls = 0;
    for (let index = 0; index < modes.length; index += 1) {
      const mode = modes[index]!;
      const context = await fixture();
      let committed = false;
      const base = forwardingResources(
        context.resources,
        context.resources.commitReplacement.bind(context.resources),
      );
      const resources = Object.freeze({
        ...base,
        commitReplacement: async (
          handle: Parameters<LocalResourceProvider["commitReplacement"]>[0],
        ) => {
          const outcome = await base.commitReplacement(handle);
          committed = outcome.state === "committed";
          return outcome;
        },
        read: async (request: Parameters<LocalResourceProvider["read"]>[0]) => {
          const actual = await base.read(request);
          if (!committed || !actual.ok) return actual;
          if (mode === "outer-proxy") return new Proxy(actual, {}) as never;
          if (mode === "outer-accessor") {
            const hostile = Object.create(null) as Record<string, unknown>;
            Object.defineProperties(hostile, {
              ok: {
                enumerable: true,
                get: () => {
                  accessorCalls += 1;
                  return true;
                },
              },
              value: { enumerable: true, value: actual.value },
            });
            return hostile as never;
          }
          if (mode === "outer-extra") {
            return Object.freeze({ extra: true, ok: true as const, value: actual.value }) as never;
          }
          if (mode === "outer-malformed") {
            return Object.freeze({ ok: true as const }) as never;
          }
          if (mode === "contents-proxy") {
            return Object.freeze({
              ok: true as const,
              value: new Proxy(actual.value, {}),
            }) as never;
          }
          if (mode === "contents-accessor") {
            const contents = Object.create(null) as Record<string, unknown>;
            Object.defineProperty(contents, "bytes", {
              enumerable: true,
              get: () => {
                accessorCalls += 1;
                return actual.value.bytes;
              },
            });
            return Object.freeze({ ok: true as const, value: contents }) as never;
          }
          if (mode === "contents-extra") {
            return Object.freeze({
              ok: true as const,
              value: Object.freeze({ bytes: actual.value.bytes, extra: true }),
            }) as never;
          }
          if (mode === "bytes-proxy") {
            return Object.freeze({
              ok: true as const,
              value: Object.freeze({ bytes: new Proxy(actual.value.bytes, {}) }),
            }) as never;
          }
          if (mode === "bytes-oversized") {
            return Object.freeze({
              ok: true as const,
              value: Object.freeze({
                bytes: new Uint8Array(bootstrapConfigurationBounds.maxConfigurationBytes + 1),
              }),
            }) as never;
          }
          return Object.freeze({
            diagnostics: new Proxy(
              Object.freeze([
                Object.freeze({ code: "resource-unreadable", message: "Unreadable" }),
              ]),
              {},
            ),
            ok: false as const,
          }) as never;
        },
      });
      const registry = createLocalProjectRegistry({ entropy: bytes(index + 130), resources });
      const outcome = await registry.add(projectInput(mode));
      expect(outcome).toMatchObject({
        diagnostics: [
          {
            code: "project-registry-state-indeterminate",
          },
        ],
        ok: false,
      });
      if (outcome.ok) throw new Error("Hostile readback unexpectedly succeeded");
      const attemptedId = outcome.diagnostics[0]?.details?.attemptedProjectId;
      if (typeof attemptedId !== "string") throw new Error("Attempted project ID was not retained");
      expect(attemptedId).toMatch(/^project_[0-9a-f]{32}$/);
      expect(
        await createLocalProjectRegistry({
          entropy: bytes(index + 160),
          resources: context.resources,
        }).get({ id: attemptedId }),
      ).toMatchObject({ ok: true, value: { id: attemptedId, name: mode } });
    }
    expect(accessorCalls).toBe(0);
  });

  test("preserves intent, evidence, bindings, sessions, and observed project bytes", async () => {
    const context = await fixture();
    const observed = path.join(context.workspaceRoot, "observed");
    await mkdir(path.join(observed, "src"), { recursive: true });
    const protectedFiles = [
      ["groma/intent/00/example.md", "intent\n"],
      ["groma/evidence/shards/00.md", "evidence\n"],
      ["groma/bindings/shards/00.md", "bindings\n"],
      ["groma/observations/session.json", "session\n"],
      ["observed/package.json", '{"name":"observed"}\n'],
      ["observed/tsconfig.json", "{}\n"],
      ["observed/src/index.ts", "export const value = 1;\n"],
    ] as const;
    for (const [relative, content] of protectedFiles) {
      const absolute = path.join(context.workspaceRoot, relative);
      await mkdir(path.dirname(absolute), { recursive: true });
      await writeFile(absolute, content);
    }
    const readLocators: string[] = [];
    const stagedLocators: string[] = [];
    const base = forwardingResources(
      context.resources,
      context.resources.commitReplacement.bind(context.resources),
    );
    const resources = Object.freeze({
      ...base,
      read: async (request: Parameters<LocalResourceProvider["read"]>[0]) => {
        readLocators.push(String(request.locator));
        return await base.read(request);
      },
      stageReplacement: async (...args: Parameters<LocalResourceProvider["stageReplacement"]>) => {
        stagedLocators.push(String(args[0]));
        return await base.stageReplacement(...args);
      },
    });
    const registry = createLocalProjectRegistry({
      entropy: bytes(7),
      resources,
    });
    const added = await registry.add({
      coverage: [{ id: "source", resourceRoot: "." }],
      name: "Observed",
      scanners: [{ configuration: {}, id: "official.typescript" }],
      source: "observed",
    });
    if (!added.ok) throw new Error(added.diagnostics[0]?.code);
    const moved = path.join(context.workspaceRoot, "observed-away");
    await rename(observed, moved);
    const expected = await Promise.all(
      protectedFiles.map(([relative]) =>
        readFile(
          relative.startsWith("observed/")
            ? path.join(moved, relative.slice("observed/".length))
            : path.join(context.workspaceRoot, relative),
        ),
      ),
    );
    expect(await registry.get({ id: added.value.id })).toMatchObject({
      ok: true,
      value: { availability: "unavailable" },
    });
    const updated = await registry.update({
      coverage: added.value.coverage,
      expectedRevision: added.value.revision,
      id: added.value.id,
      name: added.value.name,
      scanners: [],
      source: added.value.source,
    });
    if (!updated.ok) throw new Error(updated.diagnostics[0]?.code);
    expect(
      await registry.remove({ id: added.value.id, expectedRevision: updated.value.revision }),
    ).toMatchObject({
      ok: true,
    });
    const actual = await Promise.all(
      protectedFiles.map(([relative]) =>
        readFile(
          relative.startsWith("observed/")
            ? path.join(moved, relative.slice("observed/".length))
            : path.join(context.workspaceRoot, relative),
        ),
      ),
    );
    expect(actual).toEqual(expected);
    expect([...new Set(readLocators)]).toEqual(["groma/groma.yaml"]);
    expect([...new Set(stagedLocators)]).toEqual(["groma/groma.yaml"]);
  });

  test("rejects malformed direct operation identities before provider access", async () => {
    const context = await fixture();
    let reads = 0;
    const resources = forwardingResources(
      context.resources,
      context.resources.commitReplacement.bind(context.resources),
    );
    const observed = Object.freeze({
      ...resources,
      read: async (request: Parameters<LocalResourceProvider["read"]>[0]) => {
        reads += 1;
        return await resources.read(request);
      },
    });
    const registry = createLocalProjectRegistry({ entropy: bytes(1), resources: observed });
    expect(
      await registry.add({
        ...projectInput("bad"),
        unexpected: true,
      } as never),
    ).toMatchObject({ diagnostics: [{ code: "invalid-project-registration" }], ok: false });
    expect(await registry.get({ id: "bad" })).toMatchObject({
      diagnostics: [{ code: "invalid-project-request" }],
      ok: false,
    });
    expect(
      await registry.update({
        ...projectInput("bad"),
        expectedRevision: `sha256:${"a".repeat(64)}`,
        id: "bad",
      }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-project-request" }], ok: false });
    expect(
      await registry.remove({ id: "bad", expectedRevision: `sha256:${"a".repeat(64)}` }),
    ).toMatchObject({
      diagnostics: [{ code: "invalid-project-request" }],
      ok: false,
    });
    expect(reads).toBe(0);
  });

  test("contains malformed, proxy, and deceptive missing provider results", async () => {
    const context = await fixture();
    const base = forwardingResources(
      context.resources,
      context.resources.commitReplacement.bind(context.resources),
    );
    const results: unknown[] = [
      new Proxy({ ok: true, value: { bytes: new Uint8Array() } }, {}),
      {
        diagnostics: [
          {
            code: "resource-missing",
            details: { operation: "resolve a resource" },
            message: "Deceptive missing",
          },
        ],
        ok: false,
      },
      Object.defineProperty({}, "ok", {
        enumerable: true,
        get: () => {
          throw new Error("getter");
        },
      }),
    ];
    for (const raw of results) {
      const resources = Object.freeze({
        ...base,
        read: async () => raw as never,
      });
      const registry = createLocalProjectRegistry({ entropy: bytes(1), resources });
      expect(await registry.list()).toMatchObject({
        diagnostics: [{ code: "project-registry-unavailable" }],
        ok: false,
      });
    }
  });
});
