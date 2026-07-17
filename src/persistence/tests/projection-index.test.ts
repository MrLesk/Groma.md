import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createGraphCommittedEvent,
  failure,
  parseEntityId,
  parseGraphGeneration,
  parseProjectionCanonicalFingerprint,
  parseProjectionReadIntegrity,
  parseRelationId,
  success,
  type EntityAlias,
  type EntityId,
  type GraphEntity,
  type GraphRelation,
  type ProjectionCanonicalSnapshot,
  type ProjectionCanonicalSource,
  type ProjectionContinuityCheckpoint,
  type ProjectionReadIdentity,
  type ProjectionReadIntegrity,
  type ProjectionSnapshot,
} from "../../core/index.ts";
import { createStandardModelCapability } from "../../standard-model/index.ts";
import {
  createLocalProjectionIndex,
  createLocalProjectionReadIndex,
  createLocalResourceProvider,
  createTransactionProjectionCanonicalSource,
  localProjectionIndexLocator,
  workspaceResourceLocator,
  type LocalResourceProvider,
  type ResourceContinuationCursor,
  type WorkspaceResourceLocator,
} from "../index.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

const ids = {
  child: entity("2"),
  grandchild: entity("3"),
  obsolete: entity("4"),
  root: entity("1"),
  rootChild: relation("1"),
  rootGrandchild: relation("3"),
  childGrandchild: relation("2"),
};

function entity(hex: string) {
  const parsed = parseEntityId(`ent_${hex.padStart(32, "0")}`);
  if (!parsed.ok) throw new Error("invalid entity fixture");
  return parsed.value;
}

function relation(hex: string) {
  const parsed = parseRelationId(`rel_${hex.padStart(32, "0")}`);
  if (!parsed.ok) throw new Error("invalid relation fixture");
  return parsed.value;
}

function generation(value: number) {
  const parsed = parseGraphGeneration(value);
  if (!parsed.ok) throw new Error("invalid generation fixture");
  return parsed.value;
}

function component(
  id: ReturnType<typeof entity>,
  name: string,
  parent?: ReturnType<typeof entity>,
) {
  return Object.freeze({
    id,
    kind: "component",
    payload: Object.freeze({
      ...(parent === undefined ? {} : { parent }),
      name,
      type: parent === undefined ? "domain" : "component",
    }),
  }) satisfies GraphEntity;
}

function edge(
  id: ReturnType<typeof relation>,
  source: ReturnType<typeof entity>,
  target: ReturnType<typeof entity>,
  description: string,
) {
  return Object.freeze({
    id,
    payload: Object.freeze({ description }),
    source,
    target,
    type: "depends-on",
  }) satisfies GraphRelation;
}

function canonical(
  generationValue: number,
  options: {
    aliases?: readonly EntityAlias[];
    childName?: string;
    extraRelation?: boolean;
    rootName?: string;
  } = {},
): ProjectionCanonicalSnapshot {
  const entities = Object.freeze([
    component(ids.root, options.rootName ?? "Root domain"),
    component(ids.child, options.childName ?? "Child service", ids.root),
    component(ids.grandchild, "Grandchild worker", ids.child),
  ]);
  const relations = [
    edge(ids.rootChild, ids.root, ids.child, "Root calls child"),
    edge(ids.childGrandchild, ids.child, ids.grandchild, "Child emits work"),
  ];
  if (options.extraRelation === true) {
    relations.push(edge(ids.rootGrandchild, ids.root, ids.grandchild, "Root monitors grandchild"));
  }
  return Object.freeze({
    aliases: options.aliases ?? Object.freeze([]),
    entities,
    generation: generation(generationValue),
    relations: Object.freeze(relations.sort((left, right) => (left.id < right.id ? -1 : 1))),
  });
}

function flatCanonical(generationValue: number, count: number): ProjectionCanonicalSnapshot {
  return Object.freeze({
    aliases: Object.freeze([]),
    entities: Object.freeze(
      Array.from({ length: count }, (_, index) => {
        const id = entity((0x100 + index).toString(16));
        return component(id, `Flat component ${index}`);
      }),
    ),
    generation: generation(generationValue),
    relations: Object.freeze([]),
  });
}

function starCanonical(generationValue: number, count: number): ProjectionCanonicalSnapshot {
  const root = entity("200");
  const children = Array.from({ length: count }, (_, index) =>
    component(entity((0x202 + index * 2).toString(16)), `Star component ${index}`, root),
  );
  return Object.freeze({
    aliases: Object.freeze([]),
    entities: Object.freeze([component(root, "Star root"), ...children]),
    generation: generation(generationValue),
    relations: Object.freeze(
      children.map((child, index) =>
        edge(relation((0x100 + index * 2).toString(16)), root, child.id, "contains"),
      ),
    ),
  });
}

class MutableCanonicalSource implements ProjectionCanonicalSource {
  calls = 0;
  value: ProjectionCanonicalSnapshot;
  #blocked:
    | {
        readonly release: Promise<void>;
        readonly started: () => void;
      }
    | undefined;

  constructor(value: ProjectionCanonicalSnapshot) {
    this.value = value;
  }

  blockNextSnapshot(): { readonly release: () => void; readonly started: Promise<void> } {
    let release!: () => void;
    let started!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const observed = new Promise<void>((resolve) => {
      started = resolve;
    });
    this.#blocked = { release: released, started };
    return Object.freeze({ release, started: observed });
  }

  async snapshot() {
    this.calls += 1;
    const blocked = this.#blocked;
    this.#blocked = undefined;
    if (blocked !== undefined) {
      blocked.started();
      await blocked.release;
    }
    return success(this.value);
  }
}

class MutableProjectionCheckpoint {
  failRecords = 0;
  failReads = false;
  generation = generation(1);
  persistentFailure = false;
  projection: ProjectionReadIdentity | null = null;
  projectionIntegrity: ProjectionReadIntegrity | null = null;
  projectionResourceCount: number | null = null;

  async readProjectionCheckpoint() {
    if (this.failReads) {
      return failure({
        code: "projection-checkpoint-unavailable",
        message: "fixture checkpoint read failed",
      });
    }
    return success(
      Object.freeze({
        generation: this.generation,
        projection: this.projection,
        projectionIntegrity: this.projectionIntegrity,
        projectionResourceCount: this.projectionResourceCount,
      }) satisfies ProjectionContinuityCheckpoint,
    );
  }

  async recordProjectionCheckpoint(
    identity: ProjectionReadIdentity,
    integrity: ProjectionReadIntegrity,
    resourceCount: number,
  ) {
    if (this.persistentFailure || this.failRecords > 0) {
      if (this.failRecords > 0) this.failRecords -= 1;
      return failure({
        code: "projection-checkpoint-unavailable",
        message: "fixture checkpoint record failed",
      });
    }
    if (identity.generation !== this.generation) {
      return failure({
        code: "projection-checkpoint-generation-mismatch",
        message: "fixture checkpoint generation differs",
      });
    }
    this.projection = identity;
    this.projectionIntegrity = integrity;
    this.projectionResourceCount = resourceCount;
    return success(undefined);
  }
}

async function temporaryProvider(
  options: {
    failProjectionReadWrite?: (locator: string) => boolean;
    failProjectionWrites?: boolean;
  } = {},
) {
  const root = await mkdtemp(path.join(tmpdir(), "groma-projection-"));
  roots.push(root);
  const resources = await createLocalResourceProvider({
    faultInjector: (phase, context) => {
      if (
        phase === "write" &&
        context?.locator !== undefined &&
        (options.failProjectionWrites === true
          ? context.locator === ".groma-cache/projection-index.json"
          : options.failProjectionReadWrite?.(context.locator) === true)
      ) {
        throw new Error("injected projection publication failure");
      }
    },
    workspaceRoot: root,
  });
  return { resources, root };
}

function observeStages(
  resources: LocalResourceProvider,
  onStage: (locator: WorkspaceResourceLocator) => void,
): LocalResourceProvider {
  return new Proxy(resources, {
    get(target, property) {
      if (property === "stageReplacement") {
        return async (locator: WorkspaceResourceLocator, bytes: Uint8Array) => {
          onStage(locator);
          return target.stageReplacement(locator, bytes);
        };
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as LocalResourceProvider;
}

function failSelectedReads(
  resources: LocalResourceProvider,
  shouldFail: (locator: WorkspaceResourceLocator) => boolean,
  diagnosticCode: () => string = () => "resource-missing",
): LocalResourceProvider {
  return new Proxy(resources, {
    get(target, property) {
      if (property === "read") {
        return async (request: Parameters<LocalResourceProvider["read"]>[0]) =>
          shouldFail(request.locator)
            ? failure({ code: diagnosticCode(), message: "fixture selected read failed" })
            : target.read(request);
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as LocalResourceProvider;
}

function observeReads(
  resources: LocalResourceProvider,
  onRead: (locator: WorkspaceResourceLocator) => void,
): LocalResourceProvider {
  return new Proxy(resources, {
    get(target, property) {
      if (property === "read") {
        return async (request: Parameters<LocalResourceProvider["read"]>[0]) => {
          onRead(request.locator);
          return target.read(request);
        };
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as LocalResourceProvider;
}

function observeCoordination(
  resources: LocalResourceProvider,
  onCoordination: () => void,
): LocalResourceProvider {
  return new Proxy(resources, {
    get(target, property) {
      if (property === "withCoordination") {
        return (
          request: Parameters<LocalResourceProvider["withCoordination"]>[0],
          action: () => unknown | Promise<unknown>,
        ) => {
          onCoordination();
          return target.withCoordination(request, action);
        };
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as LocalResourceProvider;
}

async function replace(
  resources: LocalResourceProvider,
  locator: WorkspaceResourceLocator,
  bytes: Uint8Array,
) {
  const staged = await resources.stageReplacement(locator, bytes);
  if (!staged.ok) throw new Error("fixture replacement could not stage");
  const committed = await resources.commitReplacement(staged.value);
  if (committed.state !== "committed") throw new Error("fixture replacement could not commit");
}

describe("projection fingerprint contract", () => {
  test("keeps provider syntax opaque while enforcing one primitive bound", () => {
    expect(parseProjectionCanonicalFingerprint("provider-v2:opaque-content-id").ok).toBeTrue();
    expect(parseProjectionCanonicalFingerprint("").ok).toBeFalse();
    expect(parseProjectionCanonicalFingerprint("x".repeat(129)).ok).toBeFalse();
    expect(parseProjectionCanonicalFingerprint({ toString: () => "fingerprint" }).ok).toBeFalse();
    expect(parseProjectionReadIntegrity(`sha256:${"a".repeat(64)}`).ok).toBeTrue();
    expect(parseProjectionReadIntegrity(`sha256:${"A".repeat(64)}`).ok).toBeFalse();
    expect(parseProjectionReadIntegrity(`sha256:${"a".repeat(63)}`).ok).toBeFalse();
  });
});

describe("local projection index", () => {
  test("publishes manifest-last partial reads and avoids canonical snapshots after validation", async () => {
    const { resources, root } = await temporaryProvider();
    const source = new MutableCanonicalSource(
      canonical(1, {
        aliases: Object.freeze([{ source: ids.obsolete, target: ids.child }]),
        extraRelation: true,
      }),
    );
    const checkpoint = new MutableProjectionCheckpoint();
    const index = createLocalProjectionIndex({ canonical: source, checkpoint, resources });
    const rebuilt = await index.rebuild();
    if (!rebuilt.ok) throw new Error("expected projection rebuild");
    expect(source.calls).toBe(1);

    const identity = await index.identity();
    if (!identity.ok) throw new Error("expected partial-read identity");
    const catalog = await index.pageCatalog(identity.value, { limit: 2 });
    expect(catalog).toMatchObject({
      ok: true,
      value: {
        hasMore: true,
        items: [{ id: ids.root }, { id: ids.child }],
        nextAfter: ids.child,
      },
    });
    expect(await index.exactEntity(identity.value, ids.obsolete)).toMatchObject({
      ok: true,
      value: { identity: identity.value, value: { id: ids.child } },
    });
    expect(
      await index.pageRelations(identity.value, {
        direction: "outgoing",
        entity: ids.root,
        limit: 1,
      }),
    ).toMatchObject({
      ok: true,
      value: {
        hasMore: true,
        items: [{ direction: "outgoing", relation: { id: ids.rootChild } }],
        nextAfter: ids.rootChild,
      },
    });
    expect(source.calls).toBe(1);

    const manifest = JSON.parse(
      await readFile(path.join(root, ".groma-cache", "projection-read-current.json"), "utf8"),
    ) as { bundle: string };
    expect(
      await readFile(
        path.join(
          root,
          ".groma-cache",
          "projection-reads",
          manifest.bundle,
          "entities",
          `${ids.child}.json`,
        ),
        "utf8",
      ),
    ).toContain("Child service");
  });

  test("rejects unknown relation roots without repair and repairs missing adjacency for live entities", async () => {
    const target = await temporaryProvider();
    const staged: WorkspaceResourceLocator[] = [];
    const resources = observeStages(target.resources, (locator) => staged.push(locator));
    const source = new MutableCanonicalSource(canonical(1));
    const checkpoint = new MutableProjectionCheckpoint();
    const index = createLocalProjectionIndex({ canonical: source, checkpoint, resources });
    expect((await index.rebuild()).ok).toBeTrue();
    const identity = await index.identity();
    if (!identity.ok) throw new Error("expected relation-root projection identity");

    staged.length = 0;
    const callsBeforeUnknown = source.calls;
    expect(
      await index.pageRelations(identity.value, {
        direction: "outgoing",
        entity: entity("f"),
        limit: 1,
      }),
    ).toMatchObject({ diagnostics: [{ code: "unknown-entity" }], ok: false });
    expect(source.calls).toBe(callsBeforeUnknown);
    expect(staged).toEqual([]);

    const current = JSON.parse(
      await readFile(
        path.join(target.root, ".groma-cache", "projection-read-current.json"),
        "utf8",
      ),
    ) as { bundle: string };
    const adjacency = workspaceResourceLocator(
      ".groma-cache",
      "projection-reads",
      current.bundle,
      "adjacency",
      ids.child,
      "outgoing.json",
    );
    if (!adjacency.ok) throw new Error("invalid live adjacency locator");
    expect((await target.resources.removeResource(adjacency.value)).state).toBe("committed");
    staged.length = 0;
    const callsBeforeRepair = source.calls;
    expect(
      await index.pageRelations(identity.value, {
        direction: "outgoing",
        entity: ids.child,
        limit: 1,
      }),
    ).toMatchObject({
      ok: true,
      value: { hasMore: false, items: [{ relation: { id: ids.childGrandchild } }] },
    });
    expect(source.calls).toBe(callsBeforeRepair + 1);
    expect(staged.length).toBeGreaterThan(0);
  });

  test("replaces an oversized current read manifest but never republishes on manifest I/O failure", async () => {
    const target = await temporaryProvider();
    const staged: WorkspaceResourceLocator[] = [];
    const resources = observeStages(target.resources, (locator) => staged.push(locator));
    const source = new MutableCanonicalSource(canonical(1));
    const checkpoint = new MutableProjectionCheckpoint();
    const bounds = { maxBytes: 4_096 };
    const index = createLocalProjectionIndex({ bounds, canonical: source, checkpoint, resources });
    expect((await index.rebuild()).ok).toBeTrue();

    const current = workspaceResourceLocator(".groma-cache", "projection-read-current.json");
    const canonicalMarker = workspaceResourceLocator("groma", "intent", "canonical.md");
    if (!current.ok || !canonicalMarker.ok) throw new Error("invalid manifest fixture locator");
    const canonicalBytes = new TextEncoder().encode("canonical intent remains exact\n");
    await replace(target.resources, canonicalMarker.value, canonicalBytes);
    await replace(target.resources, current.value, new Uint8Array(bounds.maxBytes + 1));

    staged.length = 0;
    const callsBeforeRepair = source.calls;
    expect(await index.identity()).toMatchObject({ ok: true, value: { generation: 1 } });
    expect(source.calls).toBe(callsBeforeRepair + 2);
    expect(staged.length).toBeGreaterThan(0);
    expect(staged.every((locator) => locator.startsWith(".groma-cache/"))).toBeTrue();
    expect(
      await target.resources.read({
        locator: canonicalMarker.value,
        maxBytes: canonicalBytes.byteLength,
      }),
    ).toEqual({ ok: true, value: { bytes: canonicalBytes } });
    const repairedIdentity = await index.identity();
    if (!repairedIdentity.ok) throw new Error("expected repaired read manifest identity");
    expect(await index.pageCatalog(repairedIdentity.value, { limit: 1 })).toMatchObject({
      ok: true,
      value: { items: [{ id: ids.root }] },
    });

    staged.length = 0;
    const unavailableResources = observeStages(
      failSelectedReads(
        target.resources,
        (locator) => locator === current.value,
        () => "resource-provider-failed",
      ),
      (locator) => staged.push(locator),
    );
    expect(
      await createLocalProjectionIndex({
        bounds,
        canonical: source,
        checkpoint,
        resources: unavailableResources,
      }).load(),
    ).toMatchObject({
      diagnostics: [{ code: "projection-read-unavailable", details: { reason: "manifest-read" } }],
      ok: false,
    });
    expect(staged).toEqual([]);
  });

  test("adopts an unchanged durable bundle without writes and fails closed on checkpoint I/O", async () => {
    const target = await temporaryProvider();
    let stages = 0;
    let coordinated = 0;
    const resources = observeCoordination(
      observeStages(target.resources, () => {
        stages += 1;
      }),
      () => {
        coordinated += 1;
      },
    );
    const source = new MutableCanonicalSource(canonical(1));
    const checkpoint = new MutableProjectionCheckpoint();
    const first = createLocalProjectionIndex({ canonical: source, checkpoint, resources });
    expect((await first.rebuild()).ok).toBeTrue();
    expect(stages).toBeGreaterThan(0);

    stages = 0;
    coordinated = 0;
    const unchanged = createLocalProjectionIndex({ canonical: source, checkpoint, resources });
    expect(await unchanged.load()).toMatchObject({ ok: true, value: { generation: 1 } });
    expect(stages).toBe(0);
    expect(coordinated).toBe(0);

    const ignoreLocator = workspaceResourceLocator(".groma-cache", ".gitignore");
    if (!ignoreLocator.ok) throw new Error("invalid projection ignore locator");
    expect((await target.resources.removeResource(ignoreLocator.value)).state).toBe("committed");
    stages = 0;
    coordinated = 0;
    checkpoint.failReads = true;
    const unavailable = createLocalProjectionIndex({ canonical: source, checkpoint, resources });
    expect(await unavailable.load()).toMatchObject({
      diagnostics: [{ code: "projection-read-unavailable" }],
      ok: false,
    });
    expect(stages).toBe(0);
    expect(coordinated).toBeGreaterThan(0);
    checkpoint.failReads = false;
    expect(await unavailable.load()).toMatchObject({ ok: true, value: { generation: 1 } });
    expect(stages).toBeGreaterThan(0);

    const mismatchedIntegrity = parseProjectionReadIntegrity(`sha256:${"f".repeat(64)}`);
    if (!mismatchedIntegrity.ok) throw new Error("invalid integrity fixture");
    checkpoint.projectionIntegrity = mismatchedIntegrity.value;
    stages = 0;
    expect(
      await createLocalProjectionIndex({ canonical: source, checkpoint, resources }).load(),
    ).toMatchObject({ ok: true, value: { generation: 1 } });
    expect(stages).toBeGreaterThan(0);

    stages = 0;
    expect(await createLocalProjectionIndex({ canonical: source, resources }).load()).toMatchObject(
      {
        ok: true,
        value: { generation: 1 },
      },
    );
    expect(stages).toBeGreaterThan(0);
  });

  test("cold load followers adopt the exact completed winner publication without coordinating or writing again", async () => {
    const target = await temporaryProvider();
    const checkpoint = new MutableProjectionCheckpoint();
    const winnerSource = new MutableCanonicalSource(canonical(1));
    const followerSource = new MutableCanonicalSource(canonical(1));
    const blockedWinner = winnerSource.blockNextSnapshot();
    const projectionLocator = localProjectionIndexLocator();
    if (!projectionLocator.ok) throw new Error("invalid projection locator fixture");

    let followerCoordinations = 0;
    let followerStages = 0;
    let followerIsFollowing = false;
    let signalFollowerRead!: () => void;
    let allowFollowerRead!: () => void;
    const followerReadStarted = new Promise<void>((resolve) => {
      signalFollowerRead = resolve;
    });
    const followerReadAllowed = new Promise<void>((resolve) => {
      allowFollowerRead = resolve;
    });
    const followerResources = new Proxy(target.resources, {
      get(resourceTarget, property) {
        if (property === "read") {
          return async (request: Parameters<LocalResourceProvider["read"]>[0]) => {
            if (followerIsFollowing && request.locator === projectionLocator.value) {
              followerIsFollowing = false;
              signalFollowerRead();
              await followerReadAllowed;
            }
            return resourceTarget.read(request);
          };
        }
        if (property === "stageReplacement") {
          return async (locator: WorkspaceResourceLocator, bytes: Uint8Array) => {
            followerStages += 1;
            return resourceTarget.stageReplacement(locator, bytes);
          };
        }
        if (property === "withCoordination") {
          return async (
            request: Parameters<LocalResourceProvider["withCoordination"]>[0],
            action: () => unknown | Promise<unknown>,
          ) => {
            followerCoordinations += 1;
            const result = await resourceTarget.withCoordination(request, action);
            if (!result.ok && result.diagnostics[0]?.code === "resource-coordination-contended") {
              followerIsFollowing = true;
            }
            return result;
          };
        }
        const value = Reflect.get(resourceTarget, property, resourceTarget) as unknown;
        return typeof value === "function" ? value.bind(resourceTarget) : value;
      },
    }) as LocalResourceProvider;

    const winner = createLocalProjectionIndex({
      canonical: winnerSource,
      checkpoint,
      resources: target.resources,
    });
    const follower = createLocalProjectionIndex({
      canonical: followerSource,
      checkpoint,
      resources: followerResources,
    });
    const winnerLoad = winner.load();
    await blockedWinner.started;
    const followerLoad = follower.load();
    await followerReadStarted;
    blockedWinner.release();
    const winnerResult = await winnerLoad;
    if (!winnerResult.ok) throw new Error("expected coordinated winner publication");
    allowFollowerRead();
    const followerResult = await followerLoad;

    expect(followerResult).toEqual(winnerResult);
    expect(await follower.identity()).toMatchObject({ ok: true, value: { generation: 1 } });
    expect(winnerSource.calls).toBe(1);
    expect(followerSource.calls).toBe(1);
    expect(followerCoordinations).toBe(1);
    expect(followerStages).toBe(0);
  });

  test("cold load followers exhaust a bounded read-only fence under persistent contention", async () => {
    const target = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(1));
    const projectionLocator = localProjectionIndexLocator();
    if (!projectionLocator.ok) throw new Error("invalid projection locator fixture");
    let projectionReads = 0;
    let coordinations = 0;
    let stages = 0;
    const resources = new Proxy(target.resources, {
      get(resourceTarget, property) {
        if (property === "read") {
          return async (request: Parameters<LocalResourceProvider["read"]>[0]) => {
            if (request.locator === projectionLocator.value) {
              projectionReads += 1;
              return failure({ code: "resource-missing", message: "fixture cache remains cold" });
            }
            return resourceTarget.read(request);
          };
        }
        if (property === "stageReplacement") {
          return async (locator: WorkspaceResourceLocator, bytes: Uint8Array) => {
            stages += 1;
            return resourceTarget.stageReplacement(locator, bytes);
          };
        }
        if (property === "withCoordination") {
          return async () => {
            coordinations += 1;
            return failure({
              code: "resource-coordination-contended",
              message: "fixture coordination remains held",
            });
          };
        }
        const value = Reflect.get(resourceTarget, property, resourceTarget) as unknown;
        return typeof value === "function" ? value.bind(resourceTarget) : value;
      },
    }) as LocalResourceProvider;

    expect(await createLocalProjectionIndex({ canonical: source, resources }).load()).toMatchObject(
      {
        diagnostics: [
          {
            code: "projection-index-unavailable",
            details: { reason: "projection-coordination-failed" },
          },
        ],
        ok: false,
      },
    );
    expect(source.calls).toBe(0);
    expect(coordinations).toBe(1);
    expect(projectionReads).toBe(17);
    expect(stages).toBe(0);
  });

  test("cold loads do not follow mixed failures that did not originate at lease acquisition", async () => {
    const target = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(1));
    const projectionLocator = localProjectionIndexLocator();
    if (!projectionLocator.ok) throw new Error("invalid projection locator fixture");
    let projectionReads = 0;
    let coordinations = 0;
    const resources = new Proxy(target.resources, {
      get(resourceTarget, property) {
        if (property === "read") {
          return async (request: Parameters<LocalResourceProvider["read"]>[0]) => {
            if (request.locator === projectionLocator.value) {
              projectionReads += 1;
              return failure({ code: "resource-missing", message: "fixture cache remains cold" });
            }
            return resourceTarget.read(request);
          };
        }
        if (property === "withCoordination") {
          return async () => {
            coordinations += 1;
            return failure(
              {
                code: "coordination-action-failed",
                message: "fixture action failed after acquisition",
              },
              {
                code: "resource-coordination-contended",
                message: "fixture secondary diagnostic must not authorize following",
              },
            );
          };
        }
        const value = Reflect.get(resourceTarget, property, resourceTarget) as unknown;
        return typeof value === "function" ? value.bind(resourceTarget) : value;
      },
    }) as LocalResourceProvider;

    expect(await createLocalProjectionIndex({ canonical: source, resources }).load()).toMatchObject(
      {
        diagnostics: [
          {
            code: "projection-index-unavailable",
            details: { reason: "projection-coordination-failed" },
          },
        ],
        ok: false,
      },
    );
    expect(source.calls).toBe(0);
    expect(coordinations).toBe(1);
    expect(projectionReads).toBe(1);
  });

  test("cold loads do not follow a contention-first result carrying another failure", async () => {
    const target = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(1));
    const projectionLocator = localProjectionIndexLocator();
    if (!projectionLocator.ok) throw new Error("invalid projection locator fixture");
    let projectionReads = 0;
    let coordinations = 0;
    let stages = 0;
    const resources = new Proxy(target.resources, {
      get(resourceTarget, property) {
        if (property === "read") {
          return async (request: Parameters<LocalResourceProvider["read"]>[0]) => {
            if (request.locator === projectionLocator.value) {
              projectionReads += 1;
              return failure({ code: "resource-missing", message: "fixture cache remains cold" });
            }
            return resourceTarget.read(request);
          };
        }
        if (property === "stageReplacement") {
          return async (locator: WorkspaceResourceLocator, bytes: Uint8Array) => {
            stages += 1;
            return resourceTarget.stageReplacement(locator, bytes);
          };
        }
        if (property === "withCoordination") {
          return async () => {
            coordinations += 1;
            return failure(
              {
                code: "resource-coordination-contended",
                message: "fixture contention is not the complete acquisition result",
              },
              {
                code: "coordination-release-failed",
                message: "fixture additional failure forbids following",
              },
            );
          };
        }
        const value = Reflect.get(resourceTarget, property, resourceTarget) as unknown;
        return typeof value === "function" ? value.bind(resourceTarget) : value;
      },
    }) as LocalResourceProvider;

    expect(await createLocalProjectionIndex({ canonical: source, resources }).load()).toMatchObject(
      {
        diagnostics: [
          {
            code: "projection-index-unavailable",
            details: { reason: "projection-coordination-failed" },
          },
        ],
        ok: false,
      },
    );
    expect(source.calls).toBe(0);
    expect(coordinations).toBe(1);
    expect(projectionReads).toBe(1);
    expect(stages).toBe(0);
  });

  test("cold load followers reject a malformed cache after the coordinated repair fails", async () => {
    const target = await temporaryProvider();
    const projectionLocator = localProjectionIndexLocator();
    if (!projectionLocator.ok) throw new Error("invalid projection locator fixture");
    const malformedBytes = new TextEncoder().encode("{corrupt\n");
    await replace(target.resources, projectionLocator.value, malformedBytes);

    let releaseWinner!: () => void;
    let signalWinner!: () => void;
    const winnerReleased = new Promise<void>((resolve) => {
      releaseWinner = resolve;
    });
    const winnerStarted = new Promise<void>((resolve) => {
      signalWinner = resolve;
    });
    const failedSource: ProjectionCanonicalSource = {
      async snapshot() {
        signalWinner();
        await winnerReleased;
        return failure({
          code: "canonical-fixture-failed",
          message: "fixture canonical repair failed",
        });
      },
    };
    const followerSource = new MutableCanonicalSource(canonical(1));
    let followerCoordinations = 0;
    let followerProjectionReads = 0;
    let followerStages = 0;
    let signalFollowerContention!: () => void;
    const followerContended = new Promise<void>((resolve) => {
      signalFollowerContention = resolve;
    });
    const followerResources = new Proxy(target.resources, {
      get(resourceTarget, property) {
        if (property === "read") {
          return async (request: Parameters<LocalResourceProvider["read"]>[0]) => {
            if (request.locator === projectionLocator.value) followerProjectionReads += 1;
            return resourceTarget.read(request);
          };
        }
        if (property === "stageReplacement") {
          return async (locator: WorkspaceResourceLocator, bytes: Uint8Array) => {
            followerStages += 1;
            return resourceTarget.stageReplacement(locator, bytes);
          };
        }
        if (property === "withCoordination") {
          return async (
            request: Parameters<LocalResourceProvider["withCoordination"]>[0],
            action: () => unknown | Promise<unknown>,
          ) => {
            followerCoordinations += 1;
            const result = await resourceTarget.withCoordination(request, action);
            if (!result.ok && result.diagnostics[0]?.code === "resource-coordination-contended") {
              signalFollowerContention();
            }
            return result;
          };
        }
        const value = Reflect.get(resourceTarget, property, resourceTarget) as unknown;
        return typeof value === "function" ? value.bind(resourceTarget) : value;
      },
    }) as LocalResourceProvider;

    const winnerLoad = createLocalProjectionIndex({
      canonical: failedSource,
      resources: target.resources,
    }).load();
    await winnerStarted;
    const followerLoad = createLocalProjectionIndex({
      canonical: followerSource,
      resources: followerResources,
    }).load();
    await followerContended;
    releaseWinner();

    expect(await winnerLoad).toMatchObject({
      diagnostics: [
        { code: "projection-index-unavailable", details: { reason: "canonical-snapshot-failed" } },
      ],
      ok: false,
    });
    expect(await followerLoad).toMatchObject({
      diagnostics: [
        {
          code: "projection-index-unavailable",
          details: { reason: "projection-coordination-failed" },
        },
      ],
      ok: false,
    });
    expect(followerSource.calls).toBe(0);
    expect(followerCoordinations).toBe(1);
    expect(followerProjectionReads).toBe(17);
    expect(followerStages).toBe(0);
    expect(await readFile(path.join(target.root, ".groma-cache", "projection-index.json"))).toEqual(
      Buffer.from(malformedBytes),
    );
  });

  test("keeps durable adoption provisional until ignore hygiene succeeds", async () => {
    const ignoreLocator = workspaceResourceLocator(".groma-cache", ".gitignore");
    if (!ignoreLocator.ok) throw new Error("invalid projection ignore locator");
    let failIgnoreWrite = false;
    const target = await temporaryProvider({
      failProjectionReadWrite: (locator) => failIgnoreWrite && locator === ignoreLocator.value,
    });
    const source = new MutableCanonicalSource(canonical(1));
    const checkpoint = new MutableProjectionCheckpoint();
    const first = createLocalProjectionIndex({
      canonical: source,
      checkpoint,
      resources: target.resources,
    });
    expect((await first.rebuild()).ok).toBeTrue();
    const expected = await first.identity();
    if (!expected.ok) throw new Error("expected initial projection identity");
    expect((await target.resources.removeResource(ignoreLocator.value)).state).toBe("committed");

    const staged: WorkspaceResourceLocator[] = [];
    const resources = observeStages(target.resources, (locator) => staged.push(locator));
    failIgnoreWrite = true;
    const reopened = createLocalProjectionIndex({ canonical: source, checkpoint, resources });
    expect(await reopened.load()).toMatchObject({ ok: false });
    expect(staged.length).toBeGreaterThan(0);
    expect(staged.every((locator) => locator === ignoreLocator.value)).toBeTrue();

    staged.length = 0;
    expect(await reopened.identity()).toMatchObject({ ok: false });
    expect(await reopened.exactEntities(expected.value, [ids.child])).toMatchObject({ ok: false });
    expect(staged.length).toBeGreaterThan(0);
    expect(staged.every((locator) => locator === ignoreLocator.value)).toBeTrue();

    failIgnoreWrite = false;
    staged.length = 0;
    expect(await reopened.load()).toMatchObject({ ok: true, value: { generation: 1 } });
    expect(await reopened.identity()).toEqual(expected);
    expect(await reopened.exactEntities(expected.value, [ids.child])).toMatchObject({
      ok: true,
      value: { items: [{ id: ids.child }] },
    });
  });

  test("force-repairs one adopted shard once and rejects persistent or identity-changing repair", async () => {
    const target = await temporaryProvider();
    let persistentlyFailChild = false;
    let selectedReadCode = "resource-missing";
    let stages = 0;
    const resources = observeStages(
      failSelectedReads(
        target.resources,
        (locator) => persistentlyFailChild && locator.endsWith(`/entities/${ids.child}.json`),
        () => selectedReadCode,
      ),
      () => {
        stages += 1;
      },
    );
    const source = new MutableCanonicalSource(canonical(1));
    const checkpoint = new MutableProjectionCheckpoint();
    expect(
      (await createLocalProjectionIndex({ canonical: source, checkpoint, resources }).rebuild()).ok,
    ).toBeTrue();
    const adopted = createLocalProjectionIndex({ canonical: source, checkpoint, resources });
    expect((await adopted.load()).ok).toBeTrue();
    const identity = await adopted.identity();
    if (!identity.ok) throw new Error("expected adopted identity");
    const callsBeforeRejectedIdentity = source.calls;
    expect(
      await adopted.exactEntities(
        {
          fingerprint: "malformed",
          generation: identity.value.generation,
        } as ProjectionReadIdentity,
        [ids.child],
      ),
    ).toMatchObject({ ok: false });
    expect(
      await adopted.exactEntities(
        {
          fingerprint: `sha256:${"f".repeat(64)}`,
          generation: identity.value.generation,
        } as ProjectionReadIdentity,
        [ids.child],
      ),
    ).toMatchObject({ ok: false });
    expect(source.calls).toBe(callsBeforeRejectedIdentity);

    stages = 0;
    checkpoint.failReads = true;
    const callsBeforeCheckpointFailure = source.calls;
    expect(await adopted.exactEntities(identity.value, [ids.child])).toMatchObject({ ok: false });
    expect(stages).toBe(0);
    expect(source.calls).toBe(callsBeforeCheckpointFailure);
    checkpoint.failReads = false;
    expect(await adopted.exactEntities(identity.value, [ids.child])).toMatchObject({
      ok: true,
      value: { items: [{ id: ids.child }] },
    });
    expect(source.calls).toBe(callsBeforeCheckpointFailure);
    const current = JSON.parse(
      await readFile(
        path.join(target.root, ".groma-cache", "projection-read-current.json"),
        "utf8",
      ),
    ) as { bundle: string };
    const childLocator = workspaceResourceLocator(
      ".groma-cache",
      "projection-reads",
      current.bundle,
      "entities",
      `${ids.child}.json`,
    );
    if (!childLocator.ok) throw new Error("invalid child shard locator");
    expect((await target.resources.removeResource(childLocator.value)).state).toBe("committed");

    const missingCalls = source.calls;
    const weakSetAdd = Object.getOwnPropertyDescriptor(WeakSet.prototype, "add");
    const weakSetHas = Object.getOwnPropertyDescriptor(WeakSet.prototype, "has");
    if (weakSetAdd === undefined || weakSetHas === undefined) {
      throw new Error("expected WeakSet intrinsic descriptors");
    }
    try {
      Object.defineProperty(WeakSet.prototype, "has", {
        ...weakSetHas,
        value() {
          return true;
        },
      });
      expect(
        await adopted.exactEntities(
          {
            fingerprint: `sha256:${"f".repeat(64)}`,
            generation: identity.value.generation,
          } as ProjectionReadIdentity,
          [ids.child],
        ),
      ).toMatchObject({ ok: false });
      expect(source.calls).toBe(missingCalls);
    } finally {
      Object.defineProperty(WeakSet.prototype, "has", weakSetHas);
    }
    try {
      Object.defineProperty(WeakSet.prototype, "add", {
        ...weakSetAdd,
        value() {
          return this;
        },
      });
      expect(await adopted.exactEntities(identity.value, [ids.child])).toMatchObject({
        ok: true,
        value: { items: [{ id: ids.child, payload: { name: "Child service" } }] },
      });
    } finally {
      Object.defineProperty(WeakSet.prototype, "add", weakSetAdd);
    }
    expect(source.calls).toBe(missingCalls + 1);

    persistentlyFailChild = true;
    const persistentCalls = source.calls;
    expect(await adopted.exactEntities(identity.value, [ids.child])).toMatchObject({
      diagnostics: [{ code: "projection-read-unavailable" }],
      ok: false,
    });
    expect(source.calls).toBe(persistentCalls + 1);

    selectedReadCode = "resource-provider-failed";
    stages = 0;
    const infrastructureCalls = source.calls;
    expect(await adopted.exactEntities(identity.value, [ids.child])).toMatchObject({
      diagnostics: [{ code: "projection-read-unavailable" }],
      ok: false,
    });
    expect(source.calls).toBe(infrastructureCalls);
    expect(stages).toBe(0);

    const changedSnapshot = canonical(1, { childName: "Changed canonical child" });
    const changedTarget = await temporaryProvider();
    const changedCheckpoint = new MutableProjectionCheckpoint();
    const changedIndex = createLocalProjectionIndex({
      canonical: new MutableCanonicalSource(changedSnapshot),
      checkpoint: changedCheckpoint,
      resources: changedTarget.resources,
    });
    expect((await changedIndex.rebuild()).ok).toBeTrue();
    const changedIdentity = await changedIndex.identity();
    if (!changedIdentity.ok) throw new Error("expected changed projection identity");

    persistentlyFailChild = false;
    selectedReadCode = "resource-missing";
    expect((await target.resources.removeResource(childLocator.value)).state).toBe("committed");
    const mutableExpected = {
      fingerprint: identity.value.fingerprint,
      generation: identity.value.generation,
    };
    const blocked = source.blockNextSnapshot();
    const changedCalls = source.calls;
    const pending = adopted.exactEntities(mutableExpected, [ids.child]);
    await blocked.started;
    source.value = changedSnapshot;
    mutableExpected.fingerprint = changedIdentity.value.fingerprint;
    blocked.release();
    expect(await pending).toMatchObject({
      diagnostics: [{ code: "projection-read-unavailable" }],
      ok: false,
    });
    expect(source.calls).toBe(changedCalls + 1);
  });

  test("descriptor-captures partial-read requests before validation or I/O", async () => {
    const { resources } = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(1));
    const checkpoint = new MutableProjectionCheckpoint();
    const index = createLocalProjectionIndex({ canonical: source, checkpoint, resources });
    expect((await index.rebuild()).ok).toBeTrue();
    const identity = await index.identity();
    if (!identity.ok) throw new Error("expected projection identity");
    let catalogLimitReads = 0;
    const catalogRequest = Object.defineProperty({}, "limit", {
      enumerable: true,
      get() {
        catalogLimitReads += 1;
        return catalogLimitReads <= 3 ? 1 : Number.MAX_SAFE_INTEGER;
      },
    });
    expect(await index.pageCatalog(identity.value, catalogRequest as never)).toMatchObject({
      diagnostics: [
        { code: "projection-read-unavailable", details: { reason: "catalog-request-malformed" } },
      ],
      ok: false,
    });
    expect(catalogLimitReads).toBe(0);

    let relationDirectionReads = 0;
    const relationRequest = Object.defineProperties(
      { entity: ids.root, limit: 1 },
      {
        direction: {
          enumerable: true,
          get() {
            relationDirectionReads += 1;
            return relationDirectionReads === 1 ? "outgoing" : "incoming";
          },
        },
      },
    );
    expect(await index.pageRelations(identity.value, relationRequest as never)).toMatchObject({
      diagnostics: [
        { code: "projection-read-unavailable", details: { reason: "relation-request-malformed" } },
      ],
      ok: false,
    });
    expect(relationDirectionReads).toBe(0);
    expect(source.calls).toBe(1);
  });

  test("keeps caller limits independent from chunks and bounds absent-anchor reads", async () => {
    const target = await temporaryProvider();
    const reads: WorkspaceResourceLocator[] = [];
    const resources = observeReads(target.resources, (locator) => {
      reads.push(locator);
    });
    const source = new MutableCanonicalSource(starCanonical(1, 102));
    const checkpoint = new MutableProjectionCheckpoint();
    const index = createLocalProjectionIndex({
      bounds: {
        maxAliases: 200,
        maxEntities: 200,
        maxPageSize: 102,
        maxRelations: 200,
      },
      canonical: source,
      checkpoint,
      resources,
    });
    expect((await index.rebuild()).ok).toBeTrue();
    const identity = await index.identity();
    if (!identity.ok) throw new Error("expected projection identity");

    const small = await index.pageCatalog(identity.value, { limit: 60 });
    expect(small).toMatchObject({ ok: true, value: { hasMore: true } });
    expect(small.ok ? small.value.items : []).toHaveLength(60);

    const catalog = await index.pageCatalog(identity.value, { limit: 101 });
    if (!catalog.ok || catalog.value.nextAfter === undefined) {
      throw new Error("expected cross-chunk catalog page");
    }
    expect(catalog.value.items).toHaveLength(101);
    expect(catalog.value.hasMore).toBeTrue();
    const catalogAfter = parseEntityId(catalog.value.nextAfter);
    if (!catalogAfter.ok) throw new Error("invalid catalog continuation fixture");
    const catalogTail = await index.pageCatalog(identity.value, {
      after: catalogAfter.value,
      limit: 101,
    });
    expect(catalogTail.ok ? catalogTail.value.items : []).toHaveLength(2);
    expect(catalogTail).toMatchObject({ ok: true, value: { hasMore: false } });

    const requested = Object.freeze(catalog.value.items.map((item) => item.id));
    const batch = await index.exactEntities(identity.value, requested);
    expect(batch.ok ? batch.value.items : []).toHaveLength(101);
    expect(batch).toMatchObject({ ok: true, value: { identity: identity.value } });

    const root = entity("200");
    const relations = await index.pageRelations(identity.value, {
      direction: "outgoing",
      entity: root,
      limit: 101,
    });
    if (!relations.ok || relations.value.nextAfter === undefined) {
      throw new Error("expected cross-chunk relation page");
    }
    expect(relations.value.items).toHaveLength(101);
    const relationAfter = parseRelationId(relations.value.nextAfter);
    if (!relationAfter.ok) throw new Error("invalid relation continuation fixture");
    const relationTail = await index.pageRelations(identity.value, {
      after: relationAfter.value,
      direction: "outgoing",
      entity: root,
      limit: 101,
    });
    expect(relationTail.ok ? relationTail.value.items : []).toHaveLength(1);
    expect(relationTail).toMatchObject({ ok: true, value: { hasMore: false } });

    reads.length = 0;
    expect(
      await index.pageCatalog(identity.value, { after: entity("203"), limit: 1 }),
    ).toMatchObject({
      diagnostics: [{ code: "projection-read-anchor-mismatch" }],
      ok: false,
    });
    const catalogChunkReads = reads.filter((locator) => locator.includes("/catalog/"));
    expect(catalogChunkReads).toHaveLength(1);
    expect(catalogChunkReads[0]?.endsWith("/catalog/00000000.json")).toBeTrue();

    reads.length = 0;
    expect(
      await index.pageRelations(identity.value, {
        after: relation("101"),
        direction: "outgoing",
        entity: root,
        limit: 1,
      }),
    ).toMatchObject({
      diagnostics: [{ code: "projection-read-anchor-mismatch" }],
      ok: false,
    });
    const relationChunkReads = reads.filter((locator) =>
      locator.includes(`/adjacency/${root}/outgoing/`),
    );
    expect(relationChunkReads).toHaveLength(1);
    expect(relationChunkReads[0]?.endsWith("/outgoing/00000000.json")).toBeTrue();
  }, 10_000);

  test("rejects hostile live-entity batches before reading shards", async () => {
    const target = await temporaryProvider();
    let reads = 0;
    const resources = observeReads(target.resources, () => {
      reads += 1;
    });
    const source = new MutableCanonicalSource(flatCanonical(1, 4));
    const checkpoint = new MutableProjectionCheckpoint();
    const index = createLocalProjectionIndex({
      bounds: { maxAliases: 8, maxEntities: 8, maxPageSize: 4, maxRelations: 8 },
      canonical: source,
      checkpoint,
      resources,
    });
    expect((await index.rebuild()).ok).toBeTrue();
    const identity = await index.identity();
    if (!identity.ok) throw new Error("expected projection identity");
    const catalog = await index.pageCatalog(identity.value, { limit: 4 });
    if (!catalog.ok) throw new Error("expected catalog fixture");
    const ids = catalog.value.items.map((item) => item.id);
    expect(await index.exactEntities(identity.value, ids)).toMatchObject({
      ok: true,
      value: { items: catalog.value.items.map((item) => ({ id: item.id })) },
    });
    reads = 0;

    let getterReads = 0;
    const accessor = [...ids];
    Object.defineProperty(accessor, "0", {
      enumerable: true,
      get() {
        getterReads += 1;
        return ids[0];
      },
    });
    const hole = [...ids] as EntityId[];
    delete hole[1];
    const malformed = [accessor, hole, [ids[0]!, ids[0]!], [...ids].reverse(), [...ids, ids[3]!]];
    for (let malformedIndex = 0; malformedIndex < malformed.length; malformedIndex += 1) {
      expect(await index.exactEntities(identity.value, malformed[malformedIndex]!)).toMatchObject({
        diagnostics: [{ code: "projection-read-unavailable" }],
        ok: false,
      });
    }
    expect(getterReads).toBe(0);
    expect(reads).toBe(0);
  });

  test("cleans old bundles across multiple enumeration pages without deleting cursor anchors", async () => {
    const { resources, root } = await temporaryProvider();
    const source = new MutableCanonicalSource(flatCanonical(1, 25));
    const checkpoint = new MutableProjectionCheckpoint();
    const index = createLocalProjectionIndex({
      bounds: { maxAliases: 30, maxEntities: 30, maxRelations: 30 },
      canonical: source,
      checkpoint,
      resources,
    });
    expect((await index.rebuild()).ok).toBeTrue();
    const first = JSON.parse(
      await readFile(path.join(root, ".groma-cache", "projection-read-current.json"), "utf8"),
    ) as { bundle: string };
    const oldBundle = path.join(root, ".groma-cache", "projection-reads", first.bundle);
    expect(
      (await readdir(oldBundle, { recursive: true })).filter((entry) =>
        String(entry).endsWith(".json"),
      ).length,
    ).toBeGreaterThan(100);

    source.value = flatCanonical(2, 25);
    checkpoint.generation = generation(2);
    expect((await index.rebuild()).ok).toBeTrue();
    expect(
      (await readdir(oldBundle, { recursive: true })).filter((entry) =>
        String(entry).endsWith(".json"),
      ),
    ).toEqual([]);
  });

  test("keeps a large current bundle from starving bounded stale-file cleanup", async () => {
    const target = await temporaryProvider();
    const rootLocator = workspaceResourceLocator(".groma-cache", "projection-reads");
    const staleRoot = workspaceResourceLocator(".groma-cache", "projection-reads", "zz-stale");
    const staleFile = workspaceResourceLocator(
      ".groma-cache",
      "projection-reads",
      "zz-stale",
      "stale.json",
    );
    if (!rootLocator.ok || !staleRoot.ok || !staleFile.ok) {
      throw new Error("invalid cleanup starvation fixture locator");
    }
    let recursiveRootPages = 0;
    let currentSubtreeEnumerations = 0;
    const removed: WorkspaceResourceLocator[] = [];
    const resources = new Proxy(target.resources, {
      get(provider, property) {
        if (property === "enumerate") {
          return async (request: Parameters<LocalResourceProvider["enumerate"]>[0]) => {
            const manifest = JSON.parse(
              await readFile(
                path.join(target.root, ".groma-cache", "projection-read-current.json"),
                "utf8",
              ),
            ) as { bundle: string };
            const currentRoot = workspaceResourceLocator(
              ".groma-cache",
              "projection-reads",
              manifest.bundle,
            );
            if (!currentRoot.ok) throw new Error("invalid current cleanup fixture locator");
            if (request.locator === rootLocator.value && request.maxDepth === 0) {
              return success({
                entries: Object.freeze([
                  Object.freeze({ kind: "directory" as const, locator: currentRoot.value }),
                  Object.freeze({ kind: "directory" as const, locator: staleRoot.value }),
                ]),
                truncatedByDepth: true,
              });
            }
            if (request.locator === rootLocator.value) {
              // The former recursive cleanup consumes all 10,000 entries here before
              // the lexically later stale subtree becomes visible.
              const page = recursiveRootPages;
              recursiveRootPages += 1;
              const entries = Array.from({ length: 100 }, (_, index) => {
                const currentFile = workspaceResourceLocator(
                  ".groma-cache",
                  "projection-reads",
                  manifest.bundle,
                  "entities",
                  `${(page * 100 + index).toString().padStart(5, "0")}.json`,
                );
                if (!currentFile.ok) throw new Error("invalid current cleanup entry fixture");
                return Object.freeze({ kind: "file" as const, locator: currentFile.value });
              });
              return success({
                entries: Object.freeze(entries),
                ...(recursiveRootPages < 100
                  ? {
                      nextCursor:
                        `fixture-current-${recursiveRootPages}` as ResourceContinuationCursor,
                    }
                  : {}),
                truncatedByDepth: false,
              });
            }
            if (request.locator === currentRoot.value) {
              currentSubtreeEnumerations += 1;
              return success({ entries: Object.freeze([]), truncatedByDepth: false });
            }
            if (request.locator === staleRoot.value) {
              return success({
                entries: Object.freeze([
                  Object.freeze({ kind: "file" as const, locator: staleFile.value }),
                ]),
                truncatedByDepth: false,
              });
            }
            return provider.enumerate(request);
          };
        }
        if (property === "removeResource") {
          return async (locator: WorkspaceResourceLocator) => {
            removed.push(locator);
            return Object.freeze({ state: "committed" as const });
          };
        }
        const value = Reflect.get(provider, property, provider) as unknown;
        return typeof value === "function" ? value.bind(provider) : value;
      },
    }) as LocalResourceProvider;

    expect(
      (
        await createLocalProjectionIndex({
          canonical: new MutableCanonicalSource(canonical(1)),
          checkpoint: new MutableProjectionCheckpoint(),
          resources,
        }).rebuild()
      ).ok,
    ).toBeTrue();
    expect({ currentSubtreeEnumerations, recursiveRootPages }).toEqual({
      currentSubtreeEnumerations: 0,
      recursiveRootPages: 0,
    });
    expect(removed).toEqual([staleFile.value]);
  });

  test("cleans old bundles when library bounds exceed the official provider directory default", async () => {
    const { resources, root } = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(1));
    const checkpoint = new MutableProjectionCheckpoint();
    const index = createLocalProjectionIndex({
      bounds: { maxAliases: 2_000, maxEntities: 2_000, maxRelations: 2_000 },
      canonical: source,
      checkpoint,
      resources,
    });
    expect((await index.rebuild()).ok).toBeTrue();
    const first = JSON.parse(
      await readFile(path.join(root, ".groma-cache", "projection-read-current.json"), "utf8"),
    ) as { bundle: string };
    const oldBundle = path.join(root, ".groma-cache", "projection-reads", first.bundle);
    expect(
      (await readdir(oldBundle, { recursive: true })).some((entry) =>
        String(entry).endsWith(".json"),
      ),
    ).toBeTrue();

    source.value = canonical(2);
    checkpoint.generation = generation(2);
    expect((await index.rebuild()).ok).toBeTrue();
    expect(
      (await readdir(oldBundle, { recursive: true })).filter((entry) =>
        String(entry).endsWith(".json"),
      ),
    ).toEqual([]);
  });

  test("removes collected stale files when cleanup reaches its locator-character cap", async () => {
    const target = await temporaryProvider();
    const longSegments = Array.from({ length: 15 }, () => "x".repeat(250));
    const legacy = Array.from({ length: 1_200 }, (_, index) => {
      const parsed = workspaceResourceLocator(
        ".groma-cache",
        "projection-reads",
        "legacy",
        ...longSegments,
        `${index.toString().padStart(4, "0")}.json`,
      );
      if (!parsed.ok) throw new Error("invalid bounded cleanup locator fixture");
      return parsed.value;
    });
    let page = 0;
    const removed: WorkspaceResourceLocator[] = [];
    const resources = new Proxy(target.resources, {
      get(provider, property) {
        if (property === "enumerate") {
          return async () => {
            const start = page * 100;
            page += 1;
            const entries = legacy
              .slice(start, start + 100)
              .map((locator) => Object.freeze({ kind: "file" as const, locator }));
            return success(
              Object.freeze({
                entries: Object.freeze(entries),
                ...(start + entries.length < legacy.length
                  ? {
                      nextCursor: `fixture-cleanup-${page}` as ResourceContinuationCursor,
                    }
                  : {}),
                truncatedByDepth: false,
              }),
            );
          };
        }
        if (property === "removeResource") {
          return async (locator: WorkspaceResourceLocator) => {
            removed.push(locator);
            return Object.freeze({ state: "committed" as const });
          };
        }
        const value = Reflect.get(provider, property, provider) as unknown;
        return typeof value === "function" ? value.bind(provider) : value;
      },
    }) as LocalResourceProvider;
    const source = new MutableCanonicalSource(canonical(1));
    const checkpoint = new MutableProjectionCheckpoint();

    expect(
      (await createLocalProjectionIndex({ canonical: source, checkpoint, resources }).rebuild()).ok,
    ).toBeTrue();
    expect(page).toBeGreaterThan(1);
    expect(removed.length).toBeGreaterThan(0);
    expect(removed.length).toBeLessThan(legacy.length);
    expect(removed).toEqual(legacy.slice(0, removed.length));
  });

  test("repairs valid-JSON tampering in every active partial-read resource class", async () => {
    const { resources, root } = await temporaryProvider();
    const source = new MutableCanonicalSource(
      canonical(1, {
        aliases: Object.freeze([{ source: ids.obsolete, target: ids.child }]),
        extraRelation: true,
      }),
    );
    const checkpoint = new MutableProjectionCheckpoint();
    const index = createLocalProjectionIndex({ canonical: source, checkpoint, resources });
    expect((await index.rebuild()).ok).toBeTrue();
    const identity = await index.identity();
    if (!identity.ok) throw new Error("expected projection identity");
    const current = JSON.parse(
      await readFile(path.join(root, ".groma-cache", "projection-read-current.json"), "utf8"),
    ) as { bundle: string };
    const tamper = async (segments: readonly string[], value: unknown) => {
      const target = workspaceResourceLocator(
        ".groma-cache",
        "projection-reads",
        current.bundle,
        ...segments,
      );
      if (!target.ok) throw new Error("invalid tamper locator");
      await replace(
        resources,
        target.value,
        new TextEncoder().encode(`${JSON.stringify(value)}\n`),
      );
    };

    await tamper(["entities", `${ids.child}.json`], {
      id: ids.child,
      kind: "component",
      payload: { name: "Tampered child" },
    });
    expect(await index.exactEntity(identity.value, ids.child)).toMatchObject({
      ok: true,
      value: { identity: identity.value, value: { payload: { name: "Child service" } } },
    });

    await tamper(
      ["catalog", "00000000.json"],
      [
        { id: ids.root, kind: "component", searchableText: "tampered" },
        { id: ids.child, kind: "component", searchableText: "tampered" },
        { id: ids.grandchild, kind: "component", searchableText: "tampered" },
      ],
    );
    expect(await index.pageCatalog(identity.value, { limit: 3 })).toMatchObject({
      ok: true,
      value: { items: [{ id: ids.root }, { id: ids.child }, { id: ids.grandchild }] },
    });

    await tamper(["relations", `${ids.rootChild}.json`], {
      id: ids.rootChild,
      payload: { description: "Tampered relation" },
      source: ids.root,
      target: ids.child,
      type: "contains",
    });
    expect(
      await index.pageRelations(identity.value, {
        direction: "outgoing",
        entity: ids.root,
        limit: 2,
      }),
    ).toMatchObject({
      ok: true,
      value: {
        items: [{ relation: { id: ids.rootChild } }, { relation: { id: ids.rootGrandchild } }],
      },
    });

    await tamper(
      ["adjacency", ids.root, "outgoing", "00000000.json"],
      [ids.rootGrandchild, ids.rootChild],
    );
    expect(
      await index.pageRelations(identity.value, {
        direction: "outgoing",
        entity: ids.root,
        limit: 2,
      }),
    ).toMatchObject({
      ok: true,
      value: {
        items: [{ relation: { id: ids.rootChild } }, { relation: { id: ids.rootGrandchild } }],
      },
    });

    await tamper(["aliases", "00000000.json"], [{ source: ids.obsolete, target: ids.grandchild }]);
    expect(await index.exactEntity(identity.value, ids.obsolete)).toMatchObject({
      ok: true,
      value: { identity: identity.value, value: { id: ids.child } },
    });
    expect(source.calls).toBe(6);
  });

  test("keeps Merkle byte commitments exact under persistent iterator poisoning", async () => {
    const { resources, root } = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(1));
    const checkpoint = new MutableProjectionCheckpoint();
    const index = createLocalProjectionIndex({ canonical: source, checkpoint, resources });
    const originalIterator = Array.prototype[Symbol.iterator];
    let exact: Awaited<ReturnType<typeof index.exactEntity>>;
    try {
      Array.prototype[Symbol.iterator] = function () {
        if (typeof this[0] === "string" && this[0].startsWith("groma-projection-read-")) {
          let emitted = false;
          const first = this[0];
          return {
            next() {
              if (emitted) return { done: true, value: undefined };
              emitted = true;
              return { done: false, value: first };
            },
            [Symbol.iterator]() {
              return this;
            },
          } as ArrayIterator<unknown>;
        }
        return Reflect.apply(originalIterator, this, []) as ArrayIterator<unknown>;
      };
      expect((await index.rebuild()).ok).toBeTrue();
      const identity = await index.identity();
      if (!identity.ok) throw new Error("expected poisoned projection identity");
      const manifest = JSON.parse(
        await readFile(path.join(root, ".groma-cache", "projection-read-current.json"), "utf8"),
      ) as { bundle: string };
      const entityLocator = workspaceResourceLocator(
        ".groma-cache",
        "projection-reads",
        manifest.bundle,
        "entities",
        `${ids.child}.json`,
      );
      if (!entityLocator.ok) throw new Error("invalid poisoned entity locator");
      await replace(
        resources,
        entityLocator.value,
        new TextEncoder().encode(
          `${JSON.stringify({
            id: ids.child,
            kind: "component",
            payload: { name: "EVIL", parent: ids.root, type: "component" },
          })}\n`,
        ),
      );
      exact = await index.exactEntity(identity.value, ids.child);
    } finally {
      Array.prototype[Symbol.iterator] = originalIterator;
    }
    expect(exact!).toMatchObject({
      ok: true,
      value: { value: { payload: { name: "Child service" } } },
    });
    expect(source.calls).toBe(2);
  });

  test("interprets authenticated resource bytes with captured decoder intrinsics", async () => {
    const { resources } = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(1));
    const index = createLocalProjectionIndex({ canonical: source, resources });
    expect((await index.rebuild()).ok).toBeTrue();
    const identity = await index.identity();
    if (!identity.ok) throw new Error("expected decoder projection identity");
    const originalParse = JSON.parse;
    let exact: Awaited<ReturnType<typeof index.exactEntity>>;
    try {
      JSON.parse = ((
        text: string,
        reviver?: (this: unknown, key: string, value: unknown) => unknown,
      ) => {
        const parsed = Reflect.apply(originalParse, JSON, [text, reviver]) as unknown;
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed) &&
          (parsed as { id?: unknown }).id === ids.child
        ) {
          return {
            id: ids.child,
            kind: "component",
            payload: { name: "EVIL", parent: ids.root, type: "component" },
          };
        }
        return parsed;
      }) as typeof JSON.parse;
      exact = await index.exactEntity(identity.value, ids.child);
    } finally {
      JSON.parse = originalParse;
    }
    expect(exact!).toMatchObject({
      ok: true,
      value: { value: { payload: { name: "Child service" } } },
    });
    expect(source.calls).toBe(1);
  });

  test("rejects forged smaller and larger resource counts for odd and even trees", async () => {
    for (const [name, aliases, parity] of [
      ["odd", Object.freeze([]), 1],
      ["even", Object.freeze([{ source: ids.obsolete, target: ids.child }]), 0],
    ] as const) {
      for (const withCheckpoint of [true, false]) {
        const { resources, root } = await temporaryProvider();
        const source = new MutableCanonicalSource(canonical(1, { aliases, extraRelation: true }));
        const checkpoint = new MutableProjectionCheckpoint();
        const index = createLocalProjectionIndex({
          canonical: source,
          ...(withCheckpoint ? { checkpoint } : {}),
          resources,
        });
        expect((await index.rebuild()).ok).toBeTrue();
        const identity = await index.identity();
        if (!identity.ok) throw new Error(`expected ${name} projection identity`);
        const currentPath = path.join(root, ".groma-cache", "projection-read-current.json");
        const original = JSON.parse(await readFile(currentPath, "utf8")) as Record<
          string,
          unknown
        > & { resourceCount: number };
        expect(original.resourceCount % 2).toBe(parity);
        const currentLocator = workspaceResourceLocator(
          ".groma-cache",
          "projection-read-current.json",
        );
        if (!currentLocator.ok) throw new Error("invalid current manifest locator");
        for (const resourceCount of [original.resourceCount - 1, original.resourceCount + 1]) {
          await replace(
            resources,
            currentLocator.value,
            new TextEncoder().encode(`${JSON.stringify({ ...original, resourceCount })}\n`),
          );
          expect(await index.pageCatalog(identity.value, { limit: 1 })).toMatchObject({ ok: true });
        }
        expect(source.calls).toBe(5);
      }
    }
  });

  test("rejects invalid partial-read bounds and snapshots before resource I/O", async () => {
    const sourceProvider = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(1));
    const built = await createLocalProjectionIndex({
      canonical: source,
      resources: sourceProvider.resources,
    }).rebuild();
    if (!built.ok) throw new Error("expected source projection");
    const target = await temporaryProvider();
    const options = {
      bounds: {
        maxAliases: 1,
        maxBytes: 16 * 1024,
        maxEntities: 2,
        maxPageSize: 2,
        maxRelations: 10,
        maxSearchableTextCharacters: 1024,
      },
      ensureProjection: async () => success(built.value),
      repairProjection: async () => success(built.value),
      resources: target.resources,
    };
    expect(() =>
      createLocalProjectionReadIndex({
        ...options,
        bounds: { ...options.bounds, maxPageSize: 0 },
      }),
    ).toThrow("maxPageSize");
    expect(() =>
      createLocalProjectionReadIndex({
        ...options,
        bounds: { ...options.bounds, maxChunkItems: 2 } as never,
      }),
    ).toThrow("malformed");
    const partial = createLocalProjectionReadIndex(options);
    expect(await partial.publish(built.value)).toMatchObject({
      diagnostics: [{ code: "projection-read-unavailable" }],
      ok: false,
    });
    const contained = createLocalProjectionReadIndex({
      ...options,
      bounds: { ...options.bounds, maxEntities: 10 },
    });
    const forgedContent = Object.freeze({
      ...built.value,
      entities: Object.freeze(
        built.value.entities.map((projected, index) =>
          index === 0
            ? Object.freeze({
                entity: Object.freeze({
                  ...projected.entity,
                  payload: Object.freeze({ name: "Forged root", type: "domain" }),
                }),
                searchableText: `${projected.entity.id}\ncomponent\nforged root\ndomain`,
              })
            : projected,
        ),
      ),
    }) satisfies ProjectionSnapshot;
    expect(await contained.publish(forgedContent)).toMatchObject({
      diagnostics: [{ code: "projection-read-unavailable" }],
      ok: false,
    });
    const forgedSearch = Object.freeze({
      ...built.value,
      entities: Object.freeze(
        built.value.entities.map((projected, index) =>
          index === 0
            ? Object.freeze({ ...projected, searchableText: "forged catalog text" })
            : projected,
        ),
      ),
    }) satisfies ProjectionSnapshot;
    expect(await contained.publish(forgedSearch)).toMatchObject({
      diagnostics: [{ code: "projection-read-unavailable" }],
      ok: false,
    });
    const poisonedSearch = Object.freeze({
      ...built.value,
      entities: Object.freeze(
        built.value.entities.map((projected, index) =>
          index === 0
            ? Object.freeze({
                ...projected,
                searchableText: `${projected.entity.id}\n${projected.entity.kind}`,
              })
            : projected,
        ),
      ),
    }) satisfies ProjectionSnapshot;
    const originalKeys = Object.keys;
    let poisonedResult: Awaited<ReturnType<typeof contained.publish>>;
    try {
      Object.keys = (() => []) as typeof Object.keys;
      poisonedResult = await contained.publish(poisonedSearch);
    } finally {
      Object.keys = originalKeys;
    }
    expect(poisonedResult!).toMatchObject({
      diagnostics: [{ code: "projection-read-unavailable" }],
      ok: false,
    });
    const current = workspaceResourceLocator(".groma-cache", "projection-read-current.json");
    if (!current.ok) throw new Error("invalid current locator");
    expect(await target.resources.read({ locator: current.value, maxBytes: 1024 })).toMatchObject({
      diagnostics: [{ code: "resource-missing" }],
      ok: false,
    });
  });

  test("revalidates a same-generation first open instead of trusting a prior branch marker", async () => {
    const { resources } = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(1));
    const checkpoint = new MutableProjectionCheckpoint();
    const first = createLocalProjectionIndex({ canonical: source, checkpoint, resources });
    expect((await first.rebuild()).ok).toBeTrue();
    const firstIdentity = await first.identity();
    if (!firstIdentity.ok) throw new Error("expected first projection identity");

    source.value = canonical(1, { childName: "Other branch child" });
    const reopened = createLocalProjectionIndex({ canonical: source, checkpoint, resources });
    const reopenedIdentity = await reopened.identity();
    if (!reopenedIdentity.ok) throw new Error("expected branch projection identity");
    expect(reopenedIdentity.value.generation).toBe(firstIdentity.value.generation);
    expect(reopenedIdentity.value.fingerprint).not.toBe(firstIdentity.value.fingerprint);
    expect(source.calls).toBe(3);
    expect(await reopened.exactEntity(reopenedIdentity.value, ids.child)).toMatchObject({
      ok: true,
      value: {
        identity: reopenedIdentity.value,
        value: { payload: { name: "Other branch child" } },
      },
    });
  });

  test("keeps pre-manifest shards inert and recovers only after a current checkpoint", async () => {
    let failShard = false;
    const { resources, root } = await temporaryProvider({
      failProjectionReadWrite: (locator) =>
        failShard &&
        locator.includes("projection-reads/g2-") &&
        locator.endsWith(`/entities/${ids.child}.json`),
    });
    const source = new MutableCanonicalSource(canonical(1));
    const checkpoint = new MutableProjectionCheckpoint();
    const index = createLocalProjectionIndex({ canonical: source, checkpoint, resources });
    expect((await index.rebuild()).ok).toBeTrue();
    const before = JSON.parse(
      await readFile(path.join(root, ".groma-cache", "projection-read-current.json"), "utf8"),
    ) as { bundle: string };

    source.value = canonical(2, { childName: "Generation two child" });
    checkpoint.generation = generation(2);
    const event = createGraphCommittedEvent(2, { entities: [ids.child], relations: [] });
    if (!event.ok) throw new Error("invalid projection event fixture");
    failShard = true;
    expect((await index.update(event.value)).ok).toBeFalse();
    const afterFailure = JSON.parse(
      await readFile(path.join(root, ".groma-cache", "projection-read-current.json"), "utf8"),
    ) as { bundle: string };
    expect(afterFailure.bundle).toBe(before.bundle);
    expect((await index.identity()).ok).toBeFalse();

    failShard = false;
    const recovered = await index.identity();
    expect(recovered).toMatchObject({ ok: true, value: { generation: 2 } });
    expect(checkpoint.projection).toEqual(recovered.ok ? recovered.value : null);
  });

  test("repairs manifest-before-checkpoint lag and never authorizes a failed checkpoint", async () => {
    const { resources, root } = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(1));
    const checkpoint = new MutableProjectionCheckpoint();
    const index = createLocalProjectionIndex({ canonical: source, checkpoint, resources });
    expect((await index.rebuild()).ok).toBeTrue();
    const oldProjection = checkpoint.projection;

    source.value = canonical(2, { childName: "Generation two child" });
    checkpoint.generation = generation(2);
    checkpoint.failRecords = 1;
    const event = createGraphCommittedEvent(2, { entities: [ids.child], relations: [] });
    if (!event.ok) throw new Error("invalid projection event fixture");
    expect((await index.update(event.value)).ok).toBeFalse();
    const visibleManifest = JSON.parse(
      await readFile(path.join(root, ".groma-cache", "projection-read-current.json"), "utf8"),
    ) as { generation: number };
    expect(visibleManifest.generation).toBe(2);
    expect(checkpoint.projection).toBe(oldProjection);

    const recovered = await index.identity();
    expect(recovered).toMatchObject({ ok: true, value: { generation: 2 } });
    expect(checkpoint.projection).toEqual(recovered.ok ? recovered.value : null);

    source.value = canonical(3, { childName: "Generation three child" });
    checkpoint.generation = generation(3);
    checkpoint.persistentFailure = true;
    const nextEvent = createGraphCommittedEvent(3, { entities: [ids.child], relations: [] });
    if (!nextEvent.ok) throw new Error("invalid projection event fixture");
    expect((await index.update(nextEvent.value)).ok).toBeFalse();
    expect((await index.identity()).ok).toBeFalse();
  });

  test("rebuilds deterministically and applies a contiguous recursive graph event equivalently", async () => {
    const { resources, root } = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(1));
    const index = createLocalProjectionIndex({ canonical: source, resources });

    const first = await index.rebuild();
    const firstBytes = await readFile(path.join(root, ".groma-cache", "projection-index.json"));
    const repeated = await index.rebuild();
    const repeatedBytes = await readFile(path.join(root, ".groma-cache", "projection-index.json"));

    expect(first.ok).toBeTrue();
    expect(repeated).toEqual(first);
    expect(repeatedBytes).toEqual(firstBytes);

    source.value = canonical(2, {
      aliases: Object.freeze([{ source: ids.obsolete, target: ids.child }]),
      childName: "Renamed child service",
      extraRelation: true,
    });
    const event = createGraphCommittedEvent(2, {
      entities: [ids.child],
      relations: [ids.rootGrandchild],
    });
    if (!event.ok) throw new Error("invalid committed event fixture");
    const incrementallyUpdated = await index.update(event.value);

    const fresh = await temporaryProvider();
    const rebuilt = await createLocalProjectionIndex({
      canonical: source,
      resources: fresh.resources,
    }).rebuild();
    const incrementalBytes = await readFile(
      path.join(root, ".groma-cache", "projection-index.json"),
    );
    const rebuiltBytes = await readFile(
      path.join(fresh.root, ".groma-cache", "projection-index.json"),
    );

    expect(incrementallyUpdated).toEqual(rebuilt);
    expect(incrementalBytes).toEqual(rebuiltBytes);
    expect(incrementallyUpdated.ok && Number(incrementallyUpdated.value.generation)).toBe(2);
    expect(
      incrementallyUpdated.ok &&
        incrementallyUpdated.value.entities.find((item) => item.entity.id === ids.child)
          ?.searchableText,
    ).toContain("renamed child service");
    expect(incrementallyUpdated.ok && incrementallyUpdated.value.aliases).toEqual([
      { source: ids.obsolete, target: ids.child },
    ]);
    expect(
      incrementallyUpdated.ok &&
        incrementallyUpdated.value.adjacency.find((item) => item.entity === ids.root)?.outgoing,
    ).toEqual([ids.rootChild, ids.rootGrandchild]);
    expect(
      incrementallyUpdated.ok &&
        incrementallyUpdated.value.adjacency.find((item) => item.entity === ids.grandchild)
          ?.incoming,
    ).toEqual([ids.childGrandchild, ids.rootGrandchild]);
  });

  test("rebuilds absent, corrupt, stale, deleted, and missed-generation indexes without canonical writes", async () => {
    const { resources } = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(1));
    const index = createLocalProjectionIndex({ canonical: source, resources });
    const canonicalLocator = workspaceResourceLocator("groma", "intent", "canonical.md");
    if (!canonicalLocator.ok) throw new Error("invalid canonical fixture locator");
    const canonicalBytes = new TextEncoder().encode("canonical intent bytes\n");
    await replace(resources, canonicalLocator.value, canonicalBytes);

    const callsBeforeAbsentLoad = source.calls;
    expect((await index.load()).ok).toBeTrue();
    expect(source.calls).toBe(callsBeforeAbsentLoad + 1);
    const projectionLocator = localProjectionIndexLocator();
    if (!projectionLocator.ok) throw new Error("invalid projection locator");
    await replace(resources, projectionLocator.value, new TextEncoder().encode("{corrupt\n"));
    source.value = canonical(2, { childName: "After corruption" });
    const callsBeforeCorruptLoad = source.calls;
    const repaired = await index.load();
    expect(repaired.ok && Number(repaired.value.generation)).toBe(2);
    expect(source.calls).toBe(callsBeforeCorruptLoad + 1);

    source.value = canonical(4, { childName: "After event gap", extraRelation: true });
    const missed = createGraphCommittedEvent(4, {
      entities: [ids.child],
      relations: [ids.rootGrandchild],
    });
    if (!missed.ok) throw new Error("invalid missed event fixture");
    expect((await index.update(missed.value)).ok).toBeTrue();
    const afterGap = await index.load();
    expect(afterGap.ok && Number(afterGap.value.generation)).toBe(4);

    expect((await resources.removeResource(projectionLocator.value)).state).toBe("committed");
    const callsBeforeDeletedLoad = source.calls;
    expect((await index.load()).ok).toBeTrue();
    expect(source.calls).toBe(callsBeforeDeletedLoad + 1);
    expect(
      await resources.read({
        locator: canonicalLocator.value,
        maxBytes: canonicalBytes.byteLength,
      }),
    ).toEqual({ ok: true, value: { bytes: canonicalBytes } });
  });

  test("rejects same-generation cache content from another canonical history before load or update", async () => {
    const staleLoad = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(5, { rootName: "Branch A root" }));
    const index = createLocalProjectionIndex({ canonical: source, resources: staleLoad.resources });
    const branchA = await index.rebuild();
    expect(branchA.ok).toBeTrue();
    const branchAFingerprint = branchA.ok ? branchA.value.fingerprint : undefined;
    expect(branchAFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);

    source.value = canonical(5, { rootName: "Branch B root" });
    const loaded = await index.load();
    expect(loaded.ok).toBeTrue();
    expect(loaded.ok && loaded.value.fingerprint).not.toBe(branchAFingerprint);
    expect(
      loaded.ok &&
        loaded.value.entities.find((item) => item.entity.id === ids.root)?.searchableText,
    ).toContain("branch b root");
    source.value = canonical(6, { rootName: "Branch B root" });
    const generationOnly = await index.rebuild();
    expect(
      generationOnly.ok &&
        loaded.ok &&
        generationOnly.value.fingerprint === loaded.value.fingerprint,
    ).toBeTrue();

    const staleUpdate = await temporaryProvider();
    source.value = canonical(5, { rootName: "Branch A root" });
    const updateIndex = createLocalProjectionIndex({
      canonical: source,
      resources: staleUpdate.resources,
    });
    expect((await updateIndex.rebuild()).ok).toBeTrue();
    source.value = canonical(6, {
      childName: "Branch B changed child",
      rootName: "Branch B root",
    });
    const event = createGraphCommittedEvent(6, { entities: [ids.child], relations: [] });
    if (!event.ok) throw new Error("invalid same-generation history event fixture");
    const updated = await updateIndex.update(event.value);

    const fresh = await temporaryProvider();
    const rebuilt = await createLocalProjectionIndex({
      canonical: source,
      resources: fresh.resources,
    }).rebuild();
    expect(updated).toEqual(rebuilt);
    expect(
      updated.ok &&
        updated.value.entities.find((item) => item.entity.id === ids.root)?.searchableText,
    ).toContain("branch b root");
    expect(
      await readFile(path.join(staleUpdate.root, ".groma-cache", "projection-index.json")),
    ).toEqual(await readFile(path.join(fresh.root, ".groma-cache", "projection-index.json")));
  });

  test("replaces an oversized disposable index without changing canonical bytes", async () => {
    const { resources, root } = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(1));
    const index = createLocalProjectionIndex({
      bounds: { maxBytes: 4_096 },
      canonical: source,
      resources,
    });
    expect((await index.rebuild()).ok).toBeTrue();
    const projectionLocator = localProjectionIndexLocator();
    const canonicalLocator = workspaceResourceLocator("groma", "intent", "canonical.md");
    if (!projectionLocator.ok || !canonicalLocator.ok) throw new Error("invalid locator fixture");
    const canonicalBytes = new TextEncoder().encode("canonical intent remains exact\n");
    await replace(resources, canonicalLocator.value, canonicalBytes);
    await replace(resources, projectionLocator.value, new Uint8Array(4_097));

    const callsBeforeRepair = source.calls;
    const repaired = await index.load();

    expect(repaired.ok).toBeTrue();
    expect(source.calls).toBe(callsBeforeRepair + 1);
    expect(
      await resources.read({ locator: projectionLocator.value, maxBytes: 4_096 }),
    ).toMatchObject({ ok: true });
    expect(
      await resources.read({
        locator: canonicalLocator.value,
        maxBytes: canonicalBytes.byteLength,
      }),
    ).toEqual({ ok: true, value: { bytes: canonicalBytes } });
  });

  test("refreshes alias-resolved endpoints for byte-unchanged incoming relationships", async () => {
    const first = await temporaryProvider();
    const before: ProjectionCanonicalSnapshot = Object.freeze({
      aliases: Object.freeze([]),
      entities: Object.freeze([
        component(ids.root, "Root"),
        component(ids.child, "Survivor"),
        component(ids.obsolete, "Obsolete"),
      ]),
      generation: generation(1),
      relations: Object.freeze([
        edge(ids.rootChild, ids.root, ids.obsolete, "Incoming relation remains byte-unchanged"),
      ]),
    });
    const source = new MutableCanonicalSource(before);
    const index = createLocalProjectionIndex({ canonical: source, resources: first.resources });
    expect((await index.rebuild()).ok).toBeTrue();

    source.value = Object.freeze({
      aliases: Object.freeze([{ source: ids.obsolete, target: ids.child }]),
      entities: Object.freeze([component(ids.root, "Root"), component(ids.child, "Survivor")]),
      generation: generation(2),
      // The canonical owning document still names the obsolete target. Alias resolution
      // changes its projection without making the relationship an affected write.
      relations: before.relations,
    });
    const merged = createGraphCommittedEvent(2, {
      entities: [ids.child, ids.obsolete],
      relations: [],
    });
    if (!merged.ok) throw new Error("invalid merge event fixture");
    const incrementallyUpdated = await index.update(merged.value);

    const fresh = await temporaryProvider();
    const rebuilt = await createLocalProjectionIndex({
      canonical: source,
      resources: fresh.resources,
    }).rebuild();

    expect(incrementallyUpdated).toEqual(rebuilt);
    expect(incrementallyUpdated.ok && incrementallyUpdated.value.relations[0]?.target).toBe(
      ids.child,
    );
    expect(
      incrementallyUpdated.ok &&
        incrementallyUpdated.value.adjacency.find((item) => item.entity === ids.child)?.incoming,
    ).toEqual([ids.rootChild]);
  });

  test("refreshes alias-resolved containment for a byte-unchanged child", async () => {
    const model = createStandardModelCapability();
    let currentGeneration = 1;
    let state = {
      aliases: [] as readonly EntityAlias[],
      components: [
        component(ids.root, "Root"),
        component(ids.child, "Child", ids.obsolete),
        component(ids.obsolete, "Obsolete parent"),
      ],
      relationships: [] as readonly GraphRelation[],
    };
    const source = createTransactionProjectionCanonicalSource({
      model,
      transactionProvider: {
        snapshot: async () => ({
          generation: currentGeneration,
          revisions: [],
          state,
        }),
      },
    });
    const incremental = await temporaryProvider();
    const index = createLocalProjectionIndex({
      canonical: source,
      resources: incremental.resources,
    });
    expect((await index.rebuild()).ok).toBeTrue();

    currentGeneration = 2;
    state = {
      aliases: [{ source: ids.obsolete, target: ids.root }],
      // The owning component remains byte-unchanged and still names the merged identity.
      components: [component(ids.root, "Root"), component(ids.child, "Child", ids.obsolete)],
      relationships: [],
    };
    const merged = createGraphCommittedEvent(2, {
      entities: [ids.root, ids.obsolete],
      relations: [],
    });
    if (!merged.ok) throw new Error("invalid containment merge event fixture");
    const updated = await index.update(merged.value);

    const fresh = await temporaryProvider();
    const rebuilt = await createLocalProjectionIndex({
      canonical: source,
      resources: fresh.resources,
    }).rebuild();
    const updatedBytes = await readFile(
      path.join(incremental.root, ".groma-cache", "projection-index.json"),
    );
    const rebuiltBytes = await readFile(
      path.join(fresh.root, ".groma-cache", "projection-index.json"),
    );
    const child = updated.ok
      ? updated.value.entities.find((item) => item.entity.id === ids.child)
      : undefined;

    expect(updated).toEqual(rebuilt);
    expect(updatedBytes).toEqual(rebuiltBytes);
    expect(child?.entity.payload).toMatchObject({ parent: ids.root });
    expect(child?.searchableText).toContain(ids.root);
    expect(child?.searchableText).not.toContain(ids.obsolete);
  });

  test("rejects malformed committed events before canonical reads or projection writes", async () => {
    const { resources, root } = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(1));
    const index = createLocalProjectionIndex({
      bounds: { maxEntities: 3, maxRelations: 2 },
      canonical: source,
      resources,
    });
    expect((await index.rebuild()).ok).toBeTrue();
    const before = await readFile(path.join(root, ".groma-cache", "projection-index.json"));
    const callsBefore = source.calls;
    source.value = canonical(2, { childName: "Must not be observed" });
    const malformed: readonly unknown[] = [
      null,
      { affected: { entities: [], relations: [] }, generation: 2, type: "other" },
      { generation: 2, type: "graph.committed" },
      {
        affected: { entities: [], relations: [] },
        extra: true,
        generation: 2,
        type: "graph.committed",
      },
      {
        affected: { entities: [ids.child, ids.root], relations: [] },
        generation: 2,
        type: "graph.committed",
      },
      {
        affected: { entities: [ids.root, ids.root], relations: [] },
        generation: 2,
        type: "graph.committed",
      },
    ];

    for (const candidate of malformed) {
      expect(await index.update(candidate as never)).toEqual({
        diagnostics: [
          {
            code: "projection-index-unavailable",
            details: { reason: "committed-event-malformed" },
            message:
              "The disposable projection index is unavailable; retry or delete it to rebuild",
          },
        ],
        ok: false,
      });
    }

    const overBound: readonly unknown[] = [
      {
        affected: {
          entities: [ids.root, ids.child, ids.grandchild, ids.obsolete],
          relations: [],
        },
        generation: 2,
        type: "graph.committed",
      },
      {
        affected: {
          entities: [],
          relations: [ids.rootChild, ids.childGrandchild, ids.rootChild],
        },
        generation: 2,
        type: "graph.committed",
      },
    ];
    for (const candidate of overBound) {
      expect(await index.update(candidate as never)).toMatchObject({
        diagnostics: [
          {
            code: "projection-index-unavailable",
            details: { reason: "committed-event-bound-exceeded" },
          },
        ],
        ok: false,
      });
    }

    expect(source.calls).toBe(callsBefore);
    expect(await readFile(path.join(root, ".groma-cache", "projection-index.json"))).toEqual(
      before,
    );
  });

  test("serializes deterministically despite inherited toJSON pollution", async () => {
    const { resources, root } = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(1));
    const index = createLocalProjectionIndex({ canonical: source, resources });
    expect((await index.rebuild()).ok).toBeTrue();
    const baseline = await readFile(path.join(root, ".groma-cache", "projection-index.json"));
    const original = Object.getOwnPropertyDescriptor(Object.prototype, "toJSON");
    let rebuilt: Awaited<ReturnType<typeof index.rebuild>> | undefined;
    let pollutedBytes: Uint8Array | undefined;
    try {
      Object.defineProperty(Object.prototype, "toJSON", {
        configurable: true,
        value: () => ({ polluted: true }),
      });
      rebuilt = await index.rebuild();
      pollutedBytes = await readFile(path.join(root, ".groma-cache", "projection-index.json"));
    } finally {
      if (original === undefined) delete (Object.prototype as { toJSON?: unknown }).toJSON;
      else Object.defineProperty(Object.prototype, "toJSON", original);
    }

    expect(rebuilt?.ok).toBeTrue();
    expect(pollutedBytes).toEqual(baseline);
    expect((await index.load()).ok).toBeTrue();
  });

  test("fails closed at search and UTF-8 byte bounds before publishing cache artifacts", async () => {
    const search = await temporaryProvider();
    const searchIndex = createLocalProjectionIndex({
      bounds: { maxSearchableTextCharacters: 48 },
      canonical: new MutableCanonicalSource(canonical(1)),
      resources: search.resources,
    });
    expect(await searchIndex.rebuild()).toMatchObject({
      diagnostics: [
        {
          code: "projection-index-unavailable",
          details: { reason: "projection-searchable-text-bound-exceeded" },
        },
      ],
      ok: false,
    });
    await expect(readFile(path.join(search.root, ".groma-cache", ".gitignore"))).rejects.toThrow();

    const expansion = await temporaryProvider();
    const expansionCheckpoint = new MutableProjectionCheckpoint();
    const expandable: ProjectionCanonicalSnapshot = Object.freeze({
      aliases: Object.freeze([]),
      entities: Object.freeze([component(ids.root, "ﷺ".repeat(10))]),
      generation: generation(1),
      relations: Object.freeze([]),
    });
    const expansionIndex = createLocalProjectionIndex({
      bounds: { maxSearchableTextCharacters: 100 },
      canonical: new MutableCanonicalSource(expandable),
      checkpoint: expansionCheckpoint,
      resources: expansion.resources,
    });
    expect(await expansionIndex.rebuild()).toMatchObject({
      diagnostics: [
        {
          code: "projection-index-unavailable",
          details: { reason: "projection-searchable-text-bound-exceeded" },
        },
      ],
      ok: false,
    });
    expect(expansionCheckpoint).toMatchObject({
      projection: null,
      projectionIntegrity: null,
      projectionResourceCount: null,
    });
    await expect(
      readFile(path.join(expansion.root, ".groma-cache", "projection-read-current.json")),
    ).rejects.toThrow();

    const bytes = await temporaryProvider();
    const unicode: ProjectionCanonicalSnapshot = Object.freeze({
      aliases: Object.freeze([]),
      entities: Object.freeze([component(ids.root, `Root ${"é".repeat(100)}`)]),
      generation: generation(1),
      relations: Object.freeze([]),
    });
    const byteIndex = createLocalProjectionIndex({
      bounds: { maxBytes: 600 },
      canonical: new MutableCanonicalSource(unicode),
      resources: bytes.resources,
    });
    expect(await byteIndex.rebuild()).toMatchObject({
      diagnostics: [
        {
          code: "projection-index-unavailable",
          details: { reason: "projection-byte-bound-exceeded" },
        },
      ],
      ok: false,
    });
    await expect(readFile(path.join(bytes.root, ".groma-cache", ".gitignore"))).rejects.toThrow();
  });

  test("keeps its provider-owned cache invisible to Git without project ignore rules", async () => {
    const { resources, root } = await temporaryProvider();
    const initialized = Bun.spawn(["git", "init", "--quiet"], {
      cwd: root,
      stderr: "pipe",
      stdout: "pipe",
    });
    expect(await initialized.exited).toBe(0);
    const index = createLocalProjectionIndex({
      canonical: new MutableCanonicalSource(canonical(1)),
      resources,
    });

    expect((await index.rebuild()).ok).toBeTrue();
    expect(await readFile(path.join(root, ".groma-cache", ".gitignore"), "utf8")).toBe("*\n");
    const ignoreLocator = workspaceResourceLocator(".groma-cache", ".gitignore");
    if (!ignoreLocator.ok) throw new Error("invalid projection ignore fixture locator");
    expect((await resources.removeResource(ignoreLocator.value)).state).toBe("committed");
    expect((await index.load()).ok).toBeTrue();
    expect(await readFile(path.join(root, ".groma-cache", ".gitignore"), "utf8")).toBe("*\n");
    await replace(resources, ignoreLocator.value, new TextEncoder().encode("x\n"));
    expect((await index.load()).ok).toBeTrue();
    expect(await readFile(path.join(root, ".groma-cache", ".gitignore"), "utf8")).toBe("*\n");
    const status = Bun.spawn(["git", "status", "--porcelain", "--untracked-files=all"], {
      cwd: root,
      stderr: "pipe",
      stdout: "pipe",
    });
    const output = await new Response(status.stdout).text();
    expect(await status.exited).toBe(0);
    expect(output).toBe("");
  });

  test("returns one stable actionable diagnostic when canonical state or publication is unavailable", async () => {
    const healthy = await temporaryProvider();
    const unavailableSource: ProjectionCanonicalSource = {
      snapshot: async () => failure({ code: "private-source-error", message: "/private/path" }),
    };
    expect(
      await createLocalProjectionIndex({
        canonical: unavailableSource,
        resources: healthy.resources,
      }).load(),
    ).toEqual({
      diagnostics: [
        {
          code: "projection-index-unavailable",
          details: { reason: "canonical-snapshot-failed" },
          message: "The disposable projection index is unavailable; retry or delete it to rebuild",
        },
      ],
      ok: false,
    });

    const failing = await temporaryProvider({ failProjectionWrites: true });
    const source = new MutableCanonicalSource(canonical(1));
    expect(
      await createLocalProjectionIndex({ canonical: source, resources: failing.resources }).load(),
    ).toMatchObject({
      diagnostics: [{ code: "projection-index-unavailable" }],
      ok: false,
    });
  });

  test("adapts one transaction snapshot generation and resolves aliased relation endpoints", async () => {
    const model = createStandardModelCapability();
    const source = createTransactionProjectionCanonicalSource({
      model,
      transactionProvider: {
        snapshot: async (resources) => ({
          generation: 7,
          revisions: [],
          state: {
            aliases: [{ source: ids.obsolete, target: ids.child }],
            components: [component(ids.root, "Root"), component(ids.child, "Child", ids.root)],
            relationships: [
              edge(ids.rootChild, ids.root, ids.obsolete, "Targets the obsolete identity"),
            ],
          },
        }),
      },
    });

    const result = await source.snapshot();

    expect(result.ok && Number(result.value.generation)).toBe(7);
    expect(result.ok && result.value.relations[0]?.target).toBe(ids.child);
    expect(result.ok && result.value.aliases).toEqual([
      { source: ids.obsolete, target: ids.child },
    ]);
  });
});
