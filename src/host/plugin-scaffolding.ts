import { lstat, mkdir, mkdtemp, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  failure,
  pluginRuntimeApiVersion,
  success,
  validatePluginRegistration,
  type Diagnostic,
  type Result,
} from "../core/index.ts";
import {
  checkPluginPackageCompatibility,
  pluginPackageManifestApiVersion,
  pluginSdkApiVersion,
} from "../plugin-sdk/index.ts";
import { isBlueprintPackageSource } from "./bootstrap-configuration.ts";
import { defaultHostCapabilityIds } from "./default-host-identities.ts";
import { isPathWithin } from "./path-containment.ts";
import { defaultHostPluginRegistrationBounds } from "./plugin-runtime-bounds.ts";

export interface ScaffoldPluginPackageRequest {
  readonly destination: string;
  readonly name: string;
  readonly pluginId: string;
  readonly provides: readonly string[];
}

export interface PluginPackageScaffoldSnapshot {
  readonly destination: string;
  readonly entry: string;
  readonly files: readonly string[];
  readonly name: string;
  readonly pluginId: string;
  readonly provides: readonly string[];
}

export type PluginScaffoldFaultPhase =
  | "after-entry-write"
  | "after-manifest-write"
  | "after-reservation"
  | "before-publish"
  | "during-publish";

export interface PluginScaffoldOptions {
  /** Verification-only seam for proving that incomplete staging is never published. */
  readonly faultInjector?: (phase: PluginScaffoldFaultPhase) => Promise<void> | void;
  readonly workspaceRoot: string;
}

const exactVersion = "1.0.0";
const defaultHostCapabilityIdSet = new Set<string>(Object.values(defaultHostCapabilityIds));
const generatedFiles = Object.freeze([
  "groma.package.json",
  "package.json",
  "plugins/plugin.ts",
  "tests/conformance.test.ts",
]);
const publicationItems = Object.freeze([
  "plugins",
  "tests",
  "package.json",
  "groma.package.json",
] as const);

interface ScaffoldFileIdentity {
  readonly dev: number;
  readonly ino: number;
  readonly kind: "directory" | "file";
}

function diagnostic(code: string, message: string): Diagnostic {
  return Object.freeze({ code, message });
}

function invalid<T>(): Result<T> {
  return failure(
    diagnostic(
      "plugin-scaffold-invalid",
      "Plugin scaffold input does not match the public package and runtime contracts",
    ),
  );
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(Reflect.get(error, "code"))
    : undefined;
}

async function exists(file: string): Promise<boolean | undefined> {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOENT") return false;
    // A non-directory ancestor occupies the requested destination just as surely as the
    // destination itself. Report that stable workspace conflict instead of a retryable I/O fault.
    return code === "ENOTDIR" ? true : undefined;
  }
}

function sameIdentity(
  stats: Awaited<ReturnType<typeof lstat>>,
  identity: ScaffoldFileIdentity,
): boolean {
  return (
    stats.dev === identity.dev &&
    stats.ino === identity.ino &&
    (identity.kind === "directory" ? stats.isDirectory() : stats.isFile()) &&
    !stats.isSymbolicLink()
  );
}

async function stagedIdentities(stage: string): Promise<ReadonlyMap<string, ScaffoldFileIdentity>> {
  const identities = new Map<string, ScaffoldFileIdentity>();
  for (const [relative, kind] of [
    ["plugins", "directory"],
    ["plugins/plugin.ts", "file"],
    ["tests", "directory"],
    ["tests/conformance.test.ts", "file"],
    ["package.json", "file"],
    ["groma.package.json", "file"],
  ] as const) {
    const stats = await lstat(path.join(stage, relative));
    const identity = Object.freeze({ dev: stats.dev, ino: stats.ino, kind });
    if (!sameIdentity(stats, identity)) throw new Error("staged scaffold identity is invalid");
    identities.set(relative, identity);
  }
  return identities;
}

async function reservedDestinationMatches(
  destination: string,
  destinationIdentity: Awaited<ReturnType<typeof lstat>>,
  moved: ReadonlySet<string>,
  identities: ReadonlyMap<string, ScaffoldFileIdentity>,
): Promise<boolean> {
  try {
    const current = await lstat(destination);
    if (
      !current.isDirectory() ||
      current.isSymbolicLink() ||
      current.dev !== destinationIdentity.dev ||
      current.ino !== destinationIdentity.ino ||
      (await realpath(destination)) !== destination
    ) {
      return false;
    }
    const topLevel = (await readdir(destination)).sort();
    if (topLevel.join("\0") !== [...moved].sort().join("\0")) return false;
    for (const item of moved) {
      const topIdentity = identities.get(item);
      if (
        topIdentity === undefined ||
        !sameIdentity(await lstat(path.join(destination, item)), topIdentity)
      ) {
        return false;
      }
      if (item === "plugins" || item === "tests") {
        const child = item === "plugins" ? "plugin.ts" : "conformance.test.ts";
        if ((await readdir(path.join(destination, item))).join("\0") !== child) return false;
        const childIdentity = identities.get(`${item}/${child}`);
        if (
          childIdentity === undefined ||
          !sameIdentity(await lstat(path.join(destination, item, child)), childIdentity)
        ) {
          return false;
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

function renderPackageManifest(name: string): string {
  return `${JSON.stringify(
    {
      apiVersion: pluginPackageManifestApiVersion,
      name,
      plugins: ["./plugins/plugin.ts"],
      runtimeApiVersion: pluginRuntimeApiVersion,
      sdkApiVersion: pluginSdkApiVersion,
      version: exactVersion,
    },
    null,
    2,
  )}\n`;
}

function renderPackageMetadata(name: string): string {
  return `${JSON.stringify(
    {
      name,
      peerDependencies: { groma: "*" },
      private: true,
      scripts: { test: "bun test" },
      type: "module",
      version: exactVersion,
    },
    null,
    2,
  )}\n`;
}

function renderEntry(pluginId: string, provides: readonly string[]): string {
  const declarations = provides
    .map(
      (id) => `  Object.freeze({
    cardinality: "single" as const,
    id: ${JSON.stringify(id)},
    version: ${JSON.stringify(exactVersion)},
  })`,
    )
    .join(",\n");
  return `import type { PluginRegistration } from "groma/plugin-sdk";

const provides = Object.freeze([
${declarations},
]);

export const plugin: PluginRegistration = Object.freeze({
  manifest: Object.freeze({
    apiVersion: ${JSON.stringify(pluginRuntimeApiVersion)},
    id: ${JSON.stringify(pluginId)},
    phase: 1,
    provides,
    requires: Object.freeze([]),
    version: ${JSON.stringify(exactVersion)},
  }),
  start: () =>
    Object.freeze({
      capabilities: Object.freeze(
        provides.map((capability) =>
          Object.freeze({
            id: capability.id,
            value: Object.freeze({}),
            version: capability.version,
          }),
        ),
      ),
    }),
});
`;
}

function renderConformanceTest(pluginId: string, provides: readonly string[]): string {
  const checks = provides
    .map(
      (id) => `      Object.freeze({
        cardinality: "single" as const,
        id: ${JSON.stringify(id)},
        pluginId: ${JSON.stringify(pluginId)},
        verify: (value: unknown) => typeof value === "object" && value !== null,
        version: ${JSON.stringify(exactVersion)},
      })`,
    )
    .join(",\n");
  return `import { describe, expect, test } from "bun:test";
import {
  createPluginRuntimeConformanceFixture,
  runPluginConformanceSuite,
} from "groma/plugin-sdk/conformance";

import { plugin } from "../plugins/plugin.ts";

describe(${JSON.stringify(`${pluginId} conformance`)}, () => {
  test("passes the public plugin conformance suite", async () => {
    const report = await runPluginConformanceSuite({
      fixture: createPluginRuntimeConformanceFixture(() => [plugin]),
      providers: [
${checks},
      ],
    });

    expect(report.ok).toBeTrue();
    expect(report.diagnostics).toEqual([]);
  });
});
`;
}

function validateRequest(request: ScaffoldPluginPackageRequest): Result<{
  readonly destination: string;
  readonly name: string;
  readonly pluginId: string;
  readonly provides: readonly string[];
}> {
  try {
    const destination = request.destination;
    const name = request.name;
    const pluginId = request.pluginId;
    const sourceProvides = request.provides;
    if (
      typeof destination !== "string" ||
      !isBlueprintPackageSource(destination) ||
      (destination.split("/")[1]?.toLowerCase() ?? "") === "groma" ||
      typeof name !== "string" ||
      name === "groma" ||
      typeof pluginId !== "string" ||
      !Array.isArray(sourceProvides) ||
      sourceProvides.length === 0 ||
      sourceProvides.length > defaultHostPluginRegistrationBounds.maxCapabilitiesPerPlugin ||
      Object.getPrototypeOf(sourceProvides) !== Array.prototype
    ) {
      return invalid();
    }
    const provides = Object.freeze([...sourceProvides].sort());
    if (
      provides.some((id) => typeof id !== "string") ||
      new Set(provides).size !== provides.length
    ) {
      return invalid();
    }
    const packageManifest = checkPluginPackageCompatibility({
      apiVersion: pluginPackageManifestApiVersion,
      name,
      plugins: ["./plugins/plugin.ts"],
      runtimeApiVersion: pluginRuntimeApiVersion,
      sdkApiVersion: pluginSdkApiVersion,
      version: exactVersion,
    });
    const registration = validatePluginRegistration(
      {
        manifest: {
          apiVersion: pluginRuntimeApiVersion,
          id: pluginId,
          phase: 1,
          provides: provides.map((id) => ({ cardinality: "single", id, version: exactVersion })),
          requires: [],
          version: exactVersion,
        },
        start: () => ({ capabilities: [] }),
      },
      defaultHostPluginRegistrationBounds,
    );
    if (!packageManifest.ok || !registration.ok) return invalid();
    if (
      registration.value.manifest.provides.some((item) => defaultHostCapabilityIdSet.has(item.id))
    ) {
      return failure(
        diagnostic(
          "plugin-scaffold-capability-conflict",
          "Plugin scaffold capabilities must not conflict with the default Host profile",
        ),
      );
    }
    if (registration.value.manifest.id.startsWith("official.")) {
      return failure(
        diagnostic(
          "plugin-package-plugin-id-reserved",
          "Local plugin packages must not use the Host-reserved official.* plugin namespace",
        ),
      );
    }
    return success(
      Object.freeze({
        destination,
        name,
        pluginId: registration.value.manifest.id,
        provides: Object.freeze(registration.value.manifest.provides.map((item) => item.id)),
      }),
    );
  } catch {
    return invalid();
  }
}

export async function scaffoldLocalPluginPackage(
  request: ScaffoldPluginPackageRequest,
  options: PluginScaffoldOptions,
): Promise<Result<PluginPackageScaffoldSnapshot>> {
  const validated = validateRequest(request);
  if (!validated.ok) return validated;
  if (!path.isAbsolute(options.workspaceRoot))
    throw new TypeError("Workspace root must be absolute");
  let workspaceRoot: string;
  try {
    workspaceRoot = await realpath(options.workspaceRoot);
  } catch {
    return failure(
      diagnostic("plugin-scaffold-publication-failed", "Plugin scaffold could not be published"),
    );
  }
  const destination = path.resolve(workspaceRoot, validated.value.destination);
  if (destination === path.parse(destination).root) return invalid();
  const before = await exists(destination);
  if (before === true) {
    return failure(
      diagnostic(
        "plugin-scaffold-destination-conflict",
        "Plugin scaffold destination already exists",
      ),
    );
  }
  if (before === undefined) {
    return failure(
      diagnostic("plugin-scaffold-publication-failed", "Plugin scaffold could not be published"),
    );
  }

  const parent = path.dirname(destination);
  let stage: string | undefined;
  let reservedDestination: string | undefined;
  let destinationIdentity: Awaited<ReturnType<typeof lstat>> | undefined;
  let publicationIdentities: ReadonlyMap<string, ScaffoldFileIdentity> | undefined;
  const movedItems = new Set<string>();
  let published = false;
  try {
    let existingParent = parent;
    while ((await exists(existingParent)) === false && existingParent !== workspaceRoot) {
      existingParent = path.dirname(existingParent);
    }
    const canonicalExistingParent = await realpath(existingParent);
    if (!isPathWithin(workspaceRoot, canonicalExistingParent)) {
      return failure(
        diagnostic(
          "plugin-scaffold-destination-outside-workspace",
          "Plugin scaffold destination must remain inside the observed workspace",
        ),
      );
    }
    await mkdir(parent, { recursive: true });
    const canonicalParent = await realpath(parent);
    const canonicalDestination = path.join(canonicalParent, path.basename(destination));
    if (!isPathWithin(workspaceRoot, canonicalDestination)) {
      return failure(
        diagnostic(
          "plugin-scaffold-destination-outside-workspace",
          "Plugin scaffold destination must remain inside the observed workspace",
        ),
      );
    }
    stage = await mkdtemp(path.join(canonicalParent, ".groma-scaffold-"));
    await mkdir(path.join(stage, "plugins"));
    await mkdir(path.join(stage, "tests"));
    await writeFile(
      path.join(stage, "plugins", "plugin.ts"),
      renderEntry(validated.value.pluginId, validated.value.provides),
      { flag: "wx" },
    );
    await options.faultInjector?.("after-entry-write");
    await writeFile(
      path.join(stage, "groma.package.json"),
      renderPackageManifest(validated.value.name),
      {
        flag: "wx",
      },
    );
    await options.faultInjector?.("after-manifest-write");
    await writeFile(path.join(stage, "package.json"), renderPackageMetadata(validated.value.name), {
      flag: "wx",
    });
    await writeFile(
      path.join(stage, "tests", "conformance.test.ts"),
      renderConformanceTest(validated.value.pluginId, validated.value.provides),
      { flag: "wx" },
    );
    publicationIdentities = await stagedIdentities(stage);
    await options.faultInjector?.("before-publish");
    try {
      await mkdir(canonicalDestination);
    } catch (error) {
      if (errorCode(error) === "EEXIST") {
        return failure(
          diagnostic(
            "plugin-scaffold-destination-conflict",
            "Plugin scaffold destination already exists",
          ),
        );
      }
      throw error;
    }
    destinationIdentity = await lstat(canonicalDestination);
    if (!destinationIdentity.isDirectory() || destinationIdentity.isSymbolicLink()) {
      throw new Error("reserved scaffold destination is invalid");
    }
    reservedDestination = canonicalDestination;
    await options.faultInjector?.("after-reservation");
    if (
      !(await reservedDestinationMatches(
        canonicalDestination,
        destinationIdentity,
        movedItems,
        publicationIdentities,
      ))
    ) {
      throw new Error("reserved scaffold destination changed");
    }
    for (const item of publicationItems) {
      if (
        !(await reservedDestinationMatches(
          canonicalDestination,
          destinationIdentity,
          movedItems,
          publicationIdentities,
        ))
      ) {
        throw new Error("reserved scaffold destination changed");
      }
      await rename(path.join(stage, item), path.join(canonicalDestination, item));
      movedItems.add(item);
      if (
        !(await reservedDestinationMatches(
          canonicalDestination,
          destinationIdentity,
          movedItems,
          publicationIdentities,
        ))
      ) {
        throw new Error("published scaffold identity changed");
      }
      if (item === "tests") await options.faultInjector?.("during-publish");
    }
    await rm(stage, { recursive: true });
    stage = undefined;
    published = true;
    return success(
      Object.freeze({
        destination: validated.value.destination,
        entry: "./plugins/plugin.ts",
        files: generatedFiles,
        name: validated.value.name,
        pluginId: validated.value.pluginId,
        provides: validated.value.provides,
      }),
    );
  } catch {
    return failure(
      diagnostic("plugin-scaffold-publication-failed", "Plugin scaffold could not be published"),
    );
  } finally {
    if (
      !published &&
      destinationIdentity !== undefined &&
      reservedDestination !== undefined &&
      publicationIdentities !== undefined
    ) {
      try {
        if (
          await reservedDestinationMatches(
            reservedDestination,
            destinationIdentity,
            movedItems,
            publicationIdentities,
          )
        ) {
          await rm(reservedDestination, { force: true, recursive: true });
        }
      } catch {
        // Never remove a destination whose exact reserved identity is no longer provable.
      }
    }
    if (stage !== undefined) {
      try {
        await rm(stage, { force: true, recursive: true });
      } catch {
        // Staging is never the requested destination. Preserve the stable original failure.
      }
    }
  }
}
