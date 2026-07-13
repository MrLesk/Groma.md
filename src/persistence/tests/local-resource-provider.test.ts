import { afterEach, describe, expect, test } from "bun:test";
import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  chown,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { Result } from "../../core/result.ts";
import {
  allowsCustomLocalCoordinationRoot,
  type LocalResourceFaultPhase,
  createLocalResourceProvider,
  localResourceProviderCeilings,
  shouldSyncLocalCoordinationDirectory,
  shouldSyncLocalReplacementDirectory,
} from "../local-resource-provider.ts";
import {
  parseWorkspaceResourceLocator,
  type ResourceEnumerationPage,
  type StagedReplacementHandle,
  type WorkspaceResourceLocator,
  workspaceResourceLocator,
} from "../contracts.ts";

const temporaryRoots: string[] = [];
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const coordinationChild = path.join(import.meta.dir, "fixtures", "coordination-child.ts");

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
  const root = await mkdtemp(path.join(tmpdir(), "groma-resource-provider-"));
  temporaryRoots.push(root);
  const workspaceRoot = path.join(root, "workspace");
  await mkdir(workspaceRoot);
  if (!allowsCustomLocalCoordinationRoot(process.platform)) return { workspaceRoot };
  const coordinationRoot = path.join(root, "coordination");
  await mkdir(coordinationRoot, { mode: 0o700 });
  return { coordinationRoot, workspaceRoot };
}

function requiredCoordinationRoot(roots: TestRoots): string {
  if (roots.coordinationRoot === undefined) {
    throw new Error("test requires a custom coordination root");
  }
  return roots.coordinationRoot;
}

function coordinationChildArguments(
  roots: TestRoots,
  resourceLocator: WorkspaceResourceLocator,
): string[] {
  return [
    roots.workspaceRoot,
    resourceLocator,
    ...(roots.coordinationRoot === undefined ? [] : [roots.coordinationRoot]),
  ];
}

async function coordinationHash(
  workspaceRoot: string,
  resourceLocator: WorkspaceResourceLocator,
): Promise<string> {
  const canonicalRoot = await realpath(workspaceRoot);
  const absoluteResource = path.resolve(
    canonicalRoot,
    ...(resourceLocator === "." ? [] : resourceLocator.split("/")),
  );
  const key = `${canonicalRoot}\0${absoluteResource}`
    .normalize("NFC")
    .toLowerCase()
    .normalize("NFC");
  return createHash("sha256").update(key).digest("hex");
}

function locator(...segments: readonly string[]): WorkspaceResourceLocator {
  const result = workspaceResourceLocator(...segments);
  if (!result.ok) throw new Error("test locator is invalid");
  return result.value;
}

function diagnosticCode<T>(result: Result<T>): string | undefined {
  return result.ok ? undefined : result.diagnostics[0]?.code;
}

function injectedOnce(phase: LocalResourceFaultPhase, code?: string) {
  let injected = false;
  return (current: LocalResourceFaultPhase): void => {
    if (!injected && current === phase) {
      injected = true;
      throw Object.assign(new Error(`injected ${phase}`), code === undefined ? {} : { code });
    }
  };
}

async function within<T>(promise: Promise<T>, milliseconds: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function isChildMessage(message: unknown, type: string): boolean {
  return (
    typeof message === "object" && message !== null && "type" in message && message.type === type
  );
}

async function collectPages(
  provider: Awaited<ReturnType<typeof createLocalResourceProvider>>,
  request: {
    readonly limit: number;
    readonly locator: WorkspaceResourceLocator;
    readonly maxDepth: number;
    readonly maxEntriesPerDirectory: number;
  },
): Promise<ResourceEnumerationPage[]> {
  const pages: ResourceEnumerationPage[] = [];
  let cursor: ResourceEnumerationPage["nextCursor"];
  do {
    const result = await provider.enumerate({
      ...request,
      ...(cursor === undefined ? {} : { cursor }),
    });
    if (!result.ok) throw new Error(`enumeration failed: ${result.diagnostics[0]?.code}`);
    pages.push(result.value);
    cursor = result.value.nextCursor;
  } while (cursor !== undefined);
  return pages;
}

describe("bounded local resource reads", () => {
  test("rejects every configured option beyond its absolute ceiling", async () => {
    const roots = await fixture();
    const cases = [
      ["maxReadBytes", localResourceProviderCeilings.maxReadBytes],
      ["maxReplacementBytes", localResourceProviderCeilings.maxReplacementBytes],
      ["maxPageSize", localResourceProviderCeilings.maxPageSize],
      ["maxEntriesPerDirectory", localResourceProviderCeilings.maxEntriesPerDirectory],
      ["maxDepth", localResourceProviderCeilings.maxDepth],
      ["maxCursorBytes", localResourceProviderCeilings.maxCursorBytes],
      ["staleLockMilliseconds", localResourceProviderCeilings.staleLockMilliseconds],
    ] as const;

    for (const [name, maximum] of cases) {
      for (const value of [0, -1, 1.5, Number.NaN, maximum + 1, Number.MAX_SAFE_INTEGER]) {
        await expect(createLocalResourceProvider({ ...roots, [name]: value })).rejects.toThrow(
          `${name} must be a positive safe integer`,
        );
      }
    }
  });

  test("reads Unicode resources without exposing host paths", async () => {
    const roots = await fixture();
    await mkdir(path.join(roots.workspaceRoot, "設計"));
    await writeFile(path.join(roots.workspaceRoot, "設計", "café.md"), "Grüße 🌱");
    const provider = await createLocalResourceProvider(roots);

    const result = await provider.read({ locator: locator("設計", "café.md"), maxBytes: 64 });

    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(textDecoder.decode(result.value.bytes)).toBe("Grüße 🌱");
    expect(JSON.stringify(result)).not.toContain(roots.workspaceRoot);
  });

  test("distinguishes malformed, missing, unsupported, too-large, unreadable, and provider failures", async () => {
    const roots = await fixture();
    await writeFile(path.join(roots.workspaceRoot, "large.md"), "12345");
    await mkdir(path.join(roots.workspaceRoot, "directory"));
    const provider = await createLocalResourceProvider({ ...roots, maxReadBytes: 32 });

    expect(
      diagnosticCode(
        await provider.read({
          locator: "../escape" as WorkspaceResourceLocator,
          maxBytes: 4,
        }),
      ),
    ).toBe("invalid-resource-locator");
    expect(
      diagnosticCode(await provider.read({ locator: locator("missing.md"), maxBytes: 4 })),
    ).toBe("resource-missing");
    expect(
      diagnosticCode(await provider.read({ locator: locator("directory"), maxBytes: 4 })),
    ).toBe("resource-unsupported-kind");
    expect(diagnosticCode(await provider.read({ locator: locator("large.md"), maxBytes: 4 }))).toBe(
      "resource-too-large",
    );

    const unreadable = await createLocalResourceProvider({
      ...roots,
      faultInjector: injectedOnce("read", "EACCES"),
    });
    expect(
      diagnosticCode(await unreadable.read({ locator: locator("large.md"), maxBytes: 16 })),
    ).toBe("resource-unreadable");
    const failed = await createLocalResourceProvider({
      ...roots,
      faultInjector: injectedOnce("read"),
    });
    expect(diagnosticCode(await failed.read({ locator: locator("large.md"), maxBytes: 16 }))).toBe(
      "resource-provider-failure",
    );
  });

  test("rejects read limits above the provider bound", async () => {
    const roots = await fixture();
    const provider = await createLocalResourceProvider({ ...roots, maxReadBytes: 4 });

    expect(
      diagnosticCode(await provider.read({ locator: locator("anything.md"), maxBytes: 5 })),
    ).toBe("invalid-read-byte-limit");
  });

  test("does not follow a symlink that escapes the workspace", async () => {
    const roots = await fixture();
    const outside = path.join(path.dirname(roots.workspaceRoot), "outside.md");
    await writeFile(outside, "outside");
    try {
      await symlink(outside, path.join(roots.workspaceRoot, "escape.md"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    const provider = await createLocalResourceProvider(roots);

    const result = await provider.read({ locator: locator("escape.md"), maxBytes: 32 });

    expect(diagnosticCode(result)).toBe("resource-unsupported-kind");
  });

  test("rejects an escaping link in any parent segment", async () => {
    const roots = await fixture();
    const outside = path.join(path.dirname(roots.workspaceRoot), "outside-directory");
    await mkdir(outside);
    await writeFile(path.join(outside, "secret.md"), "outside");
    try {
      await symlink(outside, path.join(roots.workspaceRoot, "linked"), "dir");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    const provider = await createLocalResourceProvider(roots);

    const result = await provider.read({
      locator: locator("linked", "secret.md"),
      maxBytes: 32,
    });

    expect(diagnosticCode(result)).toBe("resource-unsupported-kind");
  });

  test("classifies a real permission denial where the host enforces mode bits", async () => {
    const roots = await fixture();
    const target = path.join(roots.workspaceRoot, "private.md");
    await writeFile(target, "private");
    await chmod(target, 0);
    try {
      const provider = await createLocalResourceProvider(roots);
      const result = await provider.read({ locator: locator("private.md"), maxBytes: 32 });
      if (!result.ok) expect(result.diagnostics[0]?.code).toBe("resource-unreadable");
    } finally {
      await chmod(target, 0o600);
    }
  });

  test("rejects accessor-shaped requests without invoking them", async () => {
    const roots = await fixture();
    const provider = await createLocalResourceProvider(roots);
    let invoked = false;
    const request = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(request, "locator", {
      enumerable: true,
      get: () => {
        invoked = true;
        return locator("anything");
      },
    });
    Object.defineProperty(request, "maxBytes", { enumerable: true, value: 1 });

    const result = await provider.read(request as never);

    expect(diagnosticCode(result)).toBe("invalid-read-request");
    expect(invoked).toBeFalse();
  });
});

describe("bounded deterministic enumeration", () => {
  test("orders Unicode resources deterministically and continues with request-bound cursors", async () => {
    const roots = await fixture();
    await mkdir(path.join(roots.workspaceRoot, "b"));
    await mkdir(path.join(roots.workspaceRoot, "a"));
    await writeFile(path.join(roots.workspaceRoot, "z.md"), "z");
    await writeFile(path.join(roots.workspaceRoot, "é.md"), "unicode");
    await writeFile(path.join(roots.workspaceRoot, "a", "2.md"), "2");
    await writeFile(path.join(roots.workspaceRoot, "a", "1.md"), "1");
    await writeFile(path.join(roots.workspaceRoot, "b", "x.md"), "x");
    const provider = await createLocalResourceProvider(roots);
    const request = { limit: 2, locator: locator(), maxDepth: 4, maxEntriesPerDirectory: 10 };

    const first = await provider.enumerate(request);
    expect(first.ok).toBeTrue();
    if (!first.ok || first.value.nextCursor === undefined) return;
    const mismatch = await provider.enumerate({
      ...request,
      cursor: first.value.nextCursor,
      limit: 3,
    });
    expect(diagnosticCode(mismatch)).toBe("cursor-request-mismatch");

    const pages = await collectPages(provider, request);
    expect(pages.flatMap((page) => page.entries.map((entry) => String(entry.locator)))).toEqual([
      "a",
      "a/1.md",
      "a/2.md",
      "b",
      "b/x.md",
      "z.md",
      "é.md",
    ]);
    expect(pages.every((page) => page.entries.length <= request.limit)).toBeTrue();
  });

  test("continues a real near-host-limit deep locator with the default cursor budget", async () => {
    const roots = await fixture();
    const segments: string[] = [];
    let current = roots.workspaceRoot;
    for (let index = 0; index < 40; index += 1) {
      const segment = `s${String(index).padStart(2, "0")}-${"a".repeat(116)}`;
      const candidateLocator = [...segments, segment].join("/");
      if (textEncoder.encode(candidateLocator).byteLength > 3_800) break;
      const candidate = path.join(current, segment);
      try {
        await mkdir(candidate);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENAMETOOLONG") break;
        throw error;
      }
      segments.push(segment);
      current = candidate;
    }
    expect(textEncoder.encode(segments.join("/")).byteLength).toBeGreaterThan(
      process.platform === "win32" ? 100 : 500,
    );
    await writeFile(path.join(current, "a.md"), "a");
    await writeFile(path.join(current, "b.md"), "b");
    const provider = await createLocalResourceProvider(roots);
    const request = {
      limit: 1,
      locator: locator(...segments),
      maxDepth: 0,
      maxEntriesPerDirectory: 10,
    };

    const first = await provider.enumerate(request);

    expect(first.ok).toBeTrue();
    if (!first.ok || first.value.nextCursor === undefined) return;
    const second = await provider.enumerate({ ...request, cursor: first.value.nextCursor });
    expect(second.ok).toBeTrue();
    if (second.ok) {
      expect(second.value.entries.map((entry) => path.basename(entry.locator))).toEqual(["b.md"]);
    }
  });

  test("reports depth truncation, directory overflow, invalid page bounds, and malformed cursors", async () => {
    const roots = await fixture();
    await mkdir(path.join(roots.workspaceRoot, "nested", "deeper"), { recursive: true });
    await writeFile(path.join(roots.workspaceRoot, "nested", "deeper", "leaf.md"), "leaf");
    await writeFile(path.join(roots.workspaceRoot, "one.md"), "1");
    await writeFile(path.join(roots.workspaceRoot, "two.md"), "2");
    const provider = await createLocalResourceProvider({
      ...roots,
      maxDepth: 4,
      maxEntriesPerDirectory: 10,
      maxPageSize: 4,
    });

    const shallow = await provider.enumerate({
      limit: 4,
      locator: locator(),
      maxDepth: 0,
      maxEntriesPerDirectory: 10,
    });
    expect(shallow.ok && shallow.value.truncatedByDepth).toBeTrue();
    if (shallow.ok) {
      expect(shallow.value.entries.map((entry) => String(entry.locator))).not.toContain(
        "nested/deeper",
      );
    }
    expect(
      diagnosticCode(
        await provider.enumerate({
          limit: 4,
          locator: locator(),
          maxDepth: 4,
          maxEntriesPerDirectory: 2,
        }),
      ),
    ).toBe("resource-directory-overflow");
    expect(
      diagnosticCode(
        await provider.enumerate({
          limit: 5,
          locator: locator(),
          maxDepth: 4,
          maxEntriesPerDirectory: 10,
        }),
      ),
    ).toBe("invalid-enumeration-limit");
    expect(
      diagnosticCode(
        await provider.enumerate({
          cursor: "forged" as never,
          limit: 4,
          locator: locator(),
          maxDepth: 4,
          maxEntriesPerDirectory: 10,
        }),
      ),
    ).toBe("malformed-resource-cursor");
    expect(
      diagnosticCode(
        await provider.enumerate({
          limit: 4,
          locator: locator(),
          maxDepth: -1,
          maxEntriesPerDirectory: 10,
        }),
      ),
    ).toBe("invalid-enumeration-depth");
  });

  test("lists links but never traverses through them", async () => {
    const roots = await fixture();
    const outside = path.join(path.dirname(roots.workspaceRoot), "outside-directory");
    await mkdir(outside);
    await writeFile(path.join(outside, "secret.md"), "secret");
    try {
      await symlink(outside, path.join(roots.workspaceRoot, "linked"), "dir");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    const provider = await createLocalResourceProvider(roots);

    const result = await provider.enumerate({
      limit: 10,
      locator: locator(),
      maxDepth: 3,
      maxEntriesPerDirectory: 10,
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.value.entries.map((entry) => [String(entry.locator), entry.kind])).toEqual([
      ["linked", "link"],
    ]);
  });

  test("revalidates a recursive directory before opening it after a namespace swap", async () => {
    if (process.platform === "win32") return;
    const roots = await fixture();
    const nested = path.join(roots.workspaceRoot, "nested");
    const parked = path.join(path.dirname(roots.workspaceRoot), "parked-nested");
    const outside = path.join(path.dirname(roots.workspaceRoot), "outside-enumeration");
    await mkdir(nested);
    await mkdir(outside);
    await writeFile(path.join(outside, "secret.md"), "outside");
    let directoryProbeCount = 0;
    const provider = await createLocalResourceProvider({
      ...roots,
      faultInjector: async (phase) => {
        if (phase !== "enumeration-directory") return;
        directoryProbeCount += 1;
        if (directoryProbeCount !== 2) return;
        await rename(nested, parked);
        await symlink(outside, nested, "dir");
      },
    });

    const result = await provider.enumerate({
      limit: 10,
      locator: locator(),
      maxDepth: 1,
      maxEntriesPerDirectory: 10,
    });

    expect(diagnosticCode(result)).toBe("resource-unsupported-kind");
    expect(directoryProbeCount).toBe(2);
    expect(JSON.stringify(result)).not.toContain("secret.md");
  });

  test("does not open unreadable directories beyond the requested depth", async () => {
    if (process.platform === "win32") return;
    const roots = await fixture();
    const boundary = path.join(roots.workspaceRoot, "boundary");
    await mkdir(boundary);
    await writeFile(path.join(boundary, "hidden.md"), "hidden");
    await chmod(boundary, 0);
    let directoryProbes = 0;
    const provider = await createLocalResourceProvider({
      ...roots,
      faultInjector: (phase) => {
        if (phase === "enumeration-directory") directoryProbes += 1;
      },
    });
    let result: Awaited<ReturnType<typeof provider.enumerate>>;
    try {
      result = await provider.enumerate({
        limit: 10,
        locator: locator(),
        maxDepth: 0,
        maxEntriesPerDirectory: 10,
      });
    } finally {
      await chmod(boundary, 0o700);
    }

    expect(result.ok).toBeTrue();
    expect(directoryProbes).toBe(1);
    if (result.ok) {
      expect(result.value.truncatedByDepth).toBeTrue();
      expect(result.value.entries.map((entry) => String(entry.locator))).toEqual(["boundary"]);
    }
  });

  test("surfaces enumeration provider failures", async () => {
    const roots = await fixture();
    const provider = await createLocalResourceProvider({
      ...roots,
      faultInjector: injectedOnce("enumerate"),
    });
    const result = await provider.enumerate({
      limit: 1,
      locator: locator(),
      maxDepth: 0,
      maxEntriesPerDirectory: 1,
    });
    expect(diagnosticCode(result)).toBe("resource-provider-failure");
  });
});

describe("staged atomic replacement", () => {
  test("bounds replacement snapshots and validates bytes without invoking proxy traps", async () => {
    const roots = await fixture();
    const provider = await createLocalResourceProvider({ ...roots, maxReplacementBytes: 4 });
    expect(
      diagnosticCode(await provider.stageReplacement(locator("large.md"), new Uint8Array(5))),
    ).toBe("replacement-too-large");

    let traps = 0;
    const trapped = new Proxy(new Uint8Array([1]), {
      get: () => {
        traps += 1;
        throw new Error("proxy trap must not run");
      },
      getPrototypeOf: () => {
        traps += 1;
        throw new Error("proxy trap must not run");
      },
    });
    expect(diagnosticCode(await provider.stageReplacement(locator("proxy.md"), trapped))).toBe(
      "invalid-replacement-bytes",
    );
    expect(traps).toBe(0);
    expect(
      diagnosticCode(
        await provider.stageReplacement(locator("int16.md"), new Int16Array([1]) as never),
      ),
    ).toBe("invalid-replacement-bytes");
    expect(
      diagnosticCode(
        await provider.stageReplacement(
          locator("view.md"),
          new DataView(new ArrayBuffer(1)) as never,
        ),
      ),
    ).toBe("invalid-replacement-bytes");

    class ByteSubclass extends Uint8Array {}
    const subclass = await provider.stageReplacement(
      locator("subclass.md"),
      new ByteSubclass([1, 2]),
    );
    expect(subclass.ok).toBeTrue();
    if (subclass.ok) expect((await provider.discardReplacement(subclass.value)).ok).toBeTrue();
  });

  test("creates and revalidates several missing Unicode parent directories", async () => {
    const roots = await fixture();
    let parentCreationSyncCount = 0;
    const provider = await createLocalResourceProvider({
      ...roots,
      faultInjector: (phase) => {
        if (phase === "replacement-parent-creation-sync") parentCreationSyncCount += 1;
      },
    });
    const target = locator("groma", "設計", "コンポーネント", "state.md");

    const staged = await provider.stageReplacement(target, textEncoder.encode("initialized"));
    expect(staged.ok).toBeTrue();
    if (!staged.ok) return;
    expect(parentCreationSyncCount).toBe(process.platform === "win32" ? 0 : 3);
    expect((await provider.commitReplacement(staged.value)).state).toBe("committed");

    const read = await provider.read({ locator: target, maxBytes: 32 });
    expect(read.ok).toBeTrue();
    if (read.ok) expect(textDecoder.decode(read.value.bytes)).toBe("initialized");
  });

  test("restores owner access on new parent chains under a restrictive umask", async () => {
    if (process.platform === "win32") return;
    const roots = await fixture();
    const provider = await createLocalResourceProvider(roots);
    const parentPaths = [
      path.join(roots.workspaceRoot, "groma"),
      path.join(roots.workspaceRoot, "groma", "nested"),
      path.join(roots.workspaceRoot, "groma", "nested", "deeper"),
    ];
    const previousUmask = process.umask(0o777);
    let stagedSuccessfully = false;
    let committed = false;
    let parentModes: number[] = [];
    try {
      const staged = await provider.stageReplacement(
        locator("groma", "nested", "deeper", "state.md"),
        textEncoder.encode("new"),
      );
      stagedSuccessfully = staged.ok;
      if (staged.ok) {
        parentModes = await Promise.all(
          parentPaths.map(async (parent) => (await lstat(parent)).mode & 0o777),
        );
        committed = (await provider.commitReplacement(staged.value)).state === "committed";
      }
    } finally {
      process.umask(previousUmask);
    }

    expect(stagedSuccessfully).toBeTrue();
    expect(parentModes).toEqual([0o700, 0o700, 0o700]);
    expect(committed).toBeTrue();
  });

  test("preserves umask-allowed group and other bits on new parent directories", async () => {
    if (process.platform === "win32") return;
    const roots = await fixture();
    const provider = await createLocalResourceProvider(roots);
    const previousUmask = process.umask(0o000);
    let parentModes: number[] = [];
    try {
      const staged = await provider.stageReplacement(
        locator("shared", "nested", "state.md"),
        textEncoder.encode("new"),
      );
      if (staged.ok) {
        parentModes = await Promise.all(
          [
            path.join(roots.workspaceRoot, "shared"),
            path.join(roots.workspaceRoot, "shared", "nested"),
          ].map(async (parent) => (await lstat(parent)).mode & 0o777),
        );
        await provider.discardReplacement(staged.value);
      }
    } finally {
      process.umask(previousUmask);
    }

    expect(parentModes).toEqual([0o777, 0o777]);
  });

  test("retries ancestor durability before staging after an initial sync failure", async () => {
    if (process.platform === "win32") return;
    const roots = await fixture();
    const targetPath = path.join(roots.workspaceRoot, "groma", "nested", "state.md");
    let syncAttempts = 0;
    const provider = await createLocalResourceProvider({
      ...roots,
      faultInjector: (phase) => {
        if (phase !== "replacement-parent-creation-sync") return;
        syncAttempts += 1;
        if (syncAttempts === 1) throw new Error("injected ancestor sync failure");
      },
    });

    const first = await provider.stageReplacement(
      locator("groma", "nested", "state.md"),
      textEncoder.encode("new"),
    );

    expect(diagnosticCode(first)).toBe("replacement-stage-failed");
    await expect(lstat(targetPath)).rejects.toMatchObject({ code: "ENOENT" });

    const retried = await provider.stageReplacement(
      locator("groma", "nested", "state.md"),
      textEncoder.encode("new"),
    );

    expect(retried.ok).toBeTrue();
    expect(syncAttempts).toBe(3);
    await expect(lstat(targetPath)).rejects.toMatchObject({ code: "ENOENT" });
    if (retried.ok)
      expect((await provider.commitReplacement(retried.value)).state).toBe("committed");
  });

  test("handles concurrent creation of the same missing parent chain", async () => {
    const roots = await fixture();
    const first = await createLocalResourceProvider(roots);
    const second = await createLocalResourceProvider(roots);

    const [firstStage, secondStage] = await Promise.all([
      first.stageReplacement(
        locator("groma", "components", "first.md"),
        textEncoder.encode("first"),
      ),
      second.stageReplacement(
        locator("groma", "components", "second.md"),
        textEncoder.encode("second"),
      ),
    ]);

    expect(firstStage.ok).toBeTrue();
    expect(secondStage.ok).toBeTrue();
    if (!firstStage.ok || !secondStage.ok) return;
    expect((await first.commitReplacement(firstStage.value)).state).toBe("committed");
    expect((await second.commitReplacement(secondStage.value)).state).toBe("committed");
  });

  test("fails closed for existing, linked, and concurrently swapped parent paths", async () => {
    const roots = await fixture();
    await writeFile(path.join(roots.workspaceRoot, "blocked"), "not a directory");
    const outside = path.join(path.dirname(roots.workspaceRoot), "outside-parents");
    await mkdir(outside);
    try {
      await symlink(outside, path.join(roots.workspaceRoot, "linked"), "dir");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    const provider = await createLocalResourceProvider(roots);

    expect(
      diagnosticCode(
        await provider.stageReplacement(
          locator("blocked", "state.md"),
          textEncoder.encode("blocked"),
        ),
      ),
    ).toBe("resource-unsupported-kind");
    expect(
      diagnosticCode(
        await provider.stageReplacement(
          locator("linked", "state.md"),
          textEncoder.encode("linked"),
        ),
      ),
    ).toBe("resource-unsupported-kind");

    let swapped = false;
    const swappingProvider = await createLocalResourceProvider({
      ...roots,
      faultInjector: async (phase) => {
        if (phase !== "parent-directory" || swapped) return;
        swapped = true;
        const parent = path.join(roots.workspaceRoot, "groma");
        await rm(parent, { recursive: true });
        await symlink(outside, parent, "dir");
      },
    });
    expect(
      diagnosticCode(
        await swappingProvider.stageReplacement(
          locator("groma", "nested", "state.md"),
          textEncoder.encode("swapped"),
        ),
      ),
    ).toBe("resource-unsupported-kind");
  });

  test("keeps live and orphan stage siblings invisible and unaddressable across providers", async () => {
    const roots = await fixture();
    const targetPath = path.join(roots.workspaceRoot, "state.md");
    await writeFile(targetPath, "prior");
    const owner = await createLocalResourceProvider(roots);
    const observer = await createLocalResourceProvider(roots);
    const staged = await owner.stageReplacement(
      locator("state.md"),
      textEncoder.encode("replacement"),
    );
    if (!staged.ok) throw new Error("staging failed unexpectedly");
    const stageName = (await readdir(roots.workspaceRoot)).find((name) =>
      name.toLowerCase().startsWith(".groma-stage-"),
    );
    if (stageName === undefined) throw new Error("expected an internal stage sibling");
    const forgedStageLocator = stageName as WorkspaceResourceLocator;

    const page = await observer.enumerate({
      limit: 10,
      locator: locator(),
      maxDepth: 0,
      maxEntriesPerDirectory: 10,
    });
    expect(page.ok).toBeTrue();
    if (page.ok) {
      expect(page.value.entries.map((entry) => String(entry.locator))).toEqual(["state.md"]);
    }
    expect(diagnosticCode(await observer.read({ locator: forgedStageLocator, maxBytes: 64 }))).toBe(
      "invalid-resource-locator",
    );
    expect(
      diagnosticCode(
        await observer.stageReplacement(forgedStageLocator, textEncoder.encode("tampered")),
      ),
    ).toBe("invalid-resource-locator");

    expect((await owner.commitReplacement(staged.value)).state).toBe("committed");
    expect(await readFile(targetPath, "utf8")).toBe("replacement");
  });

  test("commits complete copied bytes and keeps handles provider-owned", async () => {
    const roots = await fixture();
    const target = path.join(roots.workspaceRoot, "state.md");
    await writeFile(target, "old-complete");
    const firstProvider = await createLocalResourceProvider(roots);
    const secondProvider = await createLocalResourceProvider(roots);
    const callerBytes = textEncoder.encode("new-complete");
    const staged = await firstProvider.stageReplacement(locator("state.md"), callerBytes);
    expect(staged.ok).toBeTrue();
    if (!staged.ok) return;
    callerBytes.fill(120);
    expect(await readFile(target, "utf8")).toBe("old-complete");
    expect((await secondProvider.commitReplacement(staged.value)).state).toBe("not-committed");
    expect(
      (await firstProvider.commitReplacement({} as StagedReplacementHandle)).diagnostics?.[0]?.code,
    ).toBe("invalid-replacement-handle");

    const committed = await firstProvider.commitReplacement(staged.value);

    expect(committed.state).toBe("committed");
    expect(await readFile(target, "utf8")).toBe("new-complete");
    expect(await firstProvider.discardReplacement(staged.value)).toEqual({
      ok: true,
      value: undefined,
    });
  });

  test("serializes overlapping commits on one staged handle", async () => {
    const roots = await fixture();
    const target = path.join(roots.workspaceRoot, "concurrent-commits.md");
    await writeFile(target, "old-complete");
    let entered!: () => void;
    const renameEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let release!: () => void;
    const renameReleased = new Promise<void>((resolve) => {
      release = resolve;
    });
    let renameAttempts = 0;
    const provider = await createLocalResourceProvider({
      ...roots,
      faultInjector: async (phase) => {
        if (phase !== "rename") return;
        renameAttempts += 1;
        if (renameAttempts !== 1) return;
        entered();
        await renameReleased;
      },
    });
    const staged = await provider.stageReplacement(
      locator("concurrent-commits.md"),
      textEncoder.encode("new-complete"),
    );
    if (!staged.ok) throw new Error("staging failed unexpectedly");

    const first = provider.commitReplacement(staged.value);
    await within(renameEntered, 5_000, "first overlapping commit");
    const second = provider.commitReplacement(staged.value);
    release();
    const outcomes = await Promise.all([first, second]);

    expect(outcomes.map((outcome) => outcome.state)).toEqual(["committed", "committed"]);
    expect(renameAttempts).toBe(1);
    expect(await readFile(target, "utf8")).toBe("new-complete");
  });

  test("preserves commit-first ordering against overlapping discard", async () => {
    const roots = await fixture();
    const target = path.join(roots.workspaceRoot, "commit-first.md");
    await writeFile(target, "old-complete");
    let entered!: () => void;
    const renameEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let release!: () => void;
    const renameReleased = new Promise<void>((resolve) => {
      release = resolve;
    });
    const provider = await createLocalResourceProvider({
      ...roots,
      faultInjector: async (phase) => {
        if (phase !== "rename") return;
        entered();
        await renameReleased;
      },
    });
    const staged = await provider.stageReplacement(
      locator("commit-first.md"),
      textEncoder.encode("new-complete"),
    );
    if (!staged.ok) throw new Error("staging failed unexpectedly");

    const committed = provider.commitReplacement(staged.value);
    await within(renameEntered, 5_000, "commit-first mutation");
    const discarded = provider.discardReplacement(staged.value);
    release();

    expect((await committed).state).toBe("committed");
    expect(await discarded).toEqual({ ok: true, value: undefined });
    expect(await readFile(target, "utf8")).toBe("new-complete");
  });

  test("preserves discard-first ordering against overlapping commit", async () => {
    const roots = await fixture();
    const target = path.join(roots.workspaceRoot, "discard-first.md");
    await writeFile(target, "old-complete");
    let entered!: () => void;
    const cleanupEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let release!: () => void;
    const cleanupReleased = new Promise<void>((resolve) => {
      release = resolve;
    });
    const provider = await createLocalResourceProvider({
      ...roots,
      faultInjector: async (phase) => {
        if (phase !== "cleanup") return;
        entered();
        await cleanupReleased;
      },
    });
    const staged = await provider.stageReplacement(
      locator("discard-first.md"),
      textEncoder.encode("new-complete"),
    );
    if (!staged.ok) throw new Error("staging failed unexpectedly");

    const discarded = provider.discardReplacement(staged.value);
    await within(cleanupEntered, 5_000, "discard-first mutation");
    const committed = provider.commitReplacement(staged.value);
    release();

    expect(await discarded).toEqual({ ok: true, value: undefined });
    expect((await committed).state).toBe("not-committed");
    expect(await readFile(target, "utf8")).toBe("old-complete");
  });

  test("keeps stages private and applies POSIX target creation modes only at commit", async () => {
    if (process.platform === "win32") return;
    const roots = await fixture();
    const existingPath = path.join(roots.workspaceRoot, "executable.sh");
    const missingPath = path.join(roots.workspaceRoot, "created.md");
    await writeFile(existingPath, "old");
    await chmod(existingPath, 0o754);
    const provider = await createLocalResourceProvider(roots);
    const existing = await provider.stageReplacement(
      locator("executable.sh"),
      textEncoder.encode("new"),
    );
    const missing = await provider.stageReplacement(
      locator("created.md"),
      textEncoder.encode("created"),
    );
    if (!existing.ok || !missing.ok) throw new Error("staging failed unexpectedly");
    const stageNames = (await readdir(roots.workspaceRoot)).filter((name) =>
      name.startsWith(".groma-stage-"),
    );
    expect(stageNames).toHaveLength(2);
    for (const stageName of stageNames) {
      expect((await lstat(path.join(roots.workspaceRoot, stageName))).mode & 0o777).toBe(0o600);
    }

    expect((await provider.commitReplacement(existing.value)).state).toBe("committed");
    expect((await provider.commitReplacement(missing.value)).state).toBe("committed");

    expect((await lstat(existingPath)).mode & 0o777).toBe(0o754);
    expect((await lstat(missingPath)).mode & 0o777).toBe(0o666 & ~process.umask());
  });

  test("forces a private stage mode through its handle under a restrictive umask", async () => {
    if (process.platform === "win32") return;
    const roots = await fixture();
    const provider = await createLocalResourceProvider(roots);
    const previousUmask = process.umask(0o777);
    let staged: Result<StagedReplacementHandle> | undefined;
    try {
      staged = await provider.stageReplacement(locator("restricted.md"), textEncoder.encode("new"));
    } finally {
      process.umask(previousUmask);
    }
    expect(staged?.ok).toBeTrue();
    if (staged === undefined || !staged.ok) return;
    const stageName = (await readdir(roots.workspaceRoot)).find((name) =>
      name.startsWith(".groma-stage-"),
    );
    if (stageName === undefined) throw new Error("expected a private stage");
    expect((await lstat(path.join(roots.workspaceRoot, stageName))).mode & 0o777).toBe(0o600);
    expect((await provider.commitReplacement(staged.value)).state).toBe("committed");
  });

  for (const phase of ["write", "flush"] as const) {
    test(`${phase} failure leaves the complete prior target`, async () => {
      const roots = await fixture();
      const target = path.join(roots.workspaceRoot, "state.md");
      await writeFile(target, "old-complete");
      const provider = await createLocalResourceProvider({
        ...roots,
        faultInjector: injectedOnce(phase),
      });

      const replacement =
        phase === "write" ? new Uint8Array(128 * 1024).fill(110) : textEncoder.encode("new");
      const staged = await provider.stageReplacement(locator("state.md"), replacement);

      expect(diagnosticCode(staged)).toBe("replacement-stage-failed");
      expect(await readFile(target, "utf8")).toBe("old-complete");
    });
  }

  test("rename failure is explicitly not committed and can be discarded", async () => {
    const roots = await fixture();
    const target = path.join(roots.workspaceRoot, "state.md");
    await writeFile(target, "old-complete");
    const provider = await createLocalResourceProvider({
      ...roots,
      faultInjector: injectedOnce("rename"),
    });
    const staged = await provider.stageReplacement(locator("state.md"), textEncoder.encode("new"));
    if (!staged.ok) throw new Error("staging failed unexpectedly");

    const outcome = await provider.commitReplacement(staged.value);

    expect(outcome.state).toBe("not-committed");
    expect(await readFile(target, "utf8")).toBe("old-complete");
    if (process.platform !== "win32") {
      const stageName = (await readdir(roots.workspaceRoot)).find((name) =>
        name.startsWith(".groma-stage-"),
      );
      if (stageName === undefined) throw new Error("expected the private stage to remain");
      expect((await lstat(path.join(roots.workspaceRoot, stageName))).mode & 0o777).toBe(0o600);
    }
    expect((await provider.discardReplacement(staged.value)).ok).toBeTrue();
    expect((await provider.discardReplacement(staged.value)).ok).toBeTrue();
  });

  test("after-rename failure reports committed-indeterminate with complete new bytes", async () => {
    const roots = await fixture();
    const target = path.join(roots.workspaceRoot, "state.md");
    await writeFile(target, "old-complete");
    const provider = await createLocalResourceProvider({
      ...roots,
      faultInjector: injectedOnce("after-rename"),
    });
    const staged = await provider.stageReplacement(
      locator("state.md"),
      textEncoder.encode("new-complete"),
    );
    if (!staged.ok) throw new Error("staging failed unexpectedly");

    const outcome = await provider.commitReplacement(staged.value);

    expect(outcome.state).toBe("committed-indeterminate");
    expect(await readFile(target, "utf8")).toBe("new-complete");
    expect((await provider.commitReplacement(staged.value)).state).toBe("committed");
  });

  test("keeps renamed bytes private until retry finalizes the intended mode", async () => {
    if (process.platform === "win32") return;
    const roots = await fixture();
    const target = path.join(roots.workspaceRoot, "executable.sh");
    await writeFile(target, "old-complete");
    await chmod(target, 0o754);
    const provider = await createLocalResourceProvider({
      ...roots,
      faultInjector: injectedOnce("replacement-after-rename-before-mode"),
    });
    const staged = await provider.stageReplacement(
      locator("executable.sh"),
      textEncoder.encode("new-complete"),
    );
    if (!staged.ok) throw new Error("staging failed unexpectedly");

    const first = await provider.commitReplacement(staged.value);

    expect(first.state).toBe("committed-indeterminate");
    expect(await readFile(target, "utf8")).toBe("new-complete");
    expect((await lstat(target)).mode & 0o777).toBe(0o600);
    expect((await provider.commitReplacement(staged.value)).state).toBe("committed");
    expect((await lstat(target)).mode & 0o777).toBe(0o754);
  });

  test("retries POSIX parent-directory durability after an indeterminate commit", async () => {
    if (process.platform === "win32") return;
    const roots = await fixture();
    const target = path.join(roots.workspaceRoot, "state.md");
    await writeFile(target, "old-complete");
    const provider = await createLocalResourceProvider({
      ...roots,
      faultInjector: injectedOnce("replacement-parent-directory-sync"),
    });
    const staged = await provider.stageReplacement(
      locator("state.md"),
      textEncoder.encode("new-complete"),
    );
    if (!staged.ok) throw new Error("staging failed unexpectedly");

    const first = await provider.commitReplacement(staged.value);

    expect(first.state).toBe("committed-indeterminate");
    expect(await readFile(target, "utf8")).toBe("new-complete");
    expect((await provider.commitReplacement(staged.value)).state).toBe("committed");
  });

  for (const phase of [
    "replacement-target-file-sync",
    "replacement-parent-directory-sync",
    "after-rename",
  ] as const) {
    test(`retries ${phase} without reopening a finalized read-only target`, async () => {
      if (process.platform === "win32") return;
      const roots = await fixture();
      const target = path.join(roots.workspaceRoot, `${phase}.md`);
      await writeFile(target, "old-complete");
      await chmod(target, 0o400);
      let modeFinalizationAttempts = 0;
      let injected = false;
      const provider = await createLocalResourceProvider({
        ...roots,
        faultInjector: (current) => {
          if (current === "replacement-after-rename-before-mode") {
            modeFinalizationAttempts += 1;
          }
          if (current === phase && !injected) {
            injected = true;
            throw new Error(`injected ${phase}`);
          }
        },
      });
      const staged = await provider.stageReplacement(
        locator(`${phase}.md`),
        textEncoder.encode("new-complete"),
      );
      if (!staged.ok) throw new Error("staging failed unexpectedly");

      const first = await provider.commitReplacement(staged.value);

      expect(first.state).toBe("committed-indeterminate");
      expect(await readFile(target, "utf8")).toBe("new-complete");
      expect((await lstat(target)).mode & 0o777).toBe(0o400);
      expect(modeFinalizationAttempts).toBe(1);
      expect((await provider.commitReplacement(staged.value)).state).toBe("committed");
      expect(modeFinalizationAttempts).toBe(1);
    });
  }

  test("closes and abandons retained finalization on discard after rename", async () => {
    const roots = await fixture();
    const target = path.join(roots.workspaceRoot, "state.md");
    const movedTarget = path.join(roots.workspaceRoot, "moved-state.md");
    await writeFile(target, "old-complete");
    let targetSyncAttempts = 0;
    const provider = await createLocalResourceProvider({
      ...roots,
      faultInjector: (phase) => {
        if (phase !== "replacement-target-file-sync") return;
        targetSyncAttempts += 1;
        if (targetSyncAttempts === 1) throw new Error("injected target-file sync failure");
      },
    });
    const staged = await provider.stageReplacement(
      locator("state.md"),
      textEncoder.encode("new-complete"),
    );
    if (!staged.ok) throw new Error("staging failed unexpectedly");

    expect((await provider.commitReplacement(staged.value)).state).toBe("committed-indeterminate");
    expect(await readFile(target, "utf8")).toBe("new-complete");
    expect(await provider.discardReplacement(staged.value)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await provider.discardReplacement(staged.value)).toEqual({
      ok: true,
      value: undefined,
    });
    await rename(target, movedTarget);
    const abandoned = {
      diagnostics: [
        {
          code: "replacement-finalization-abandoned",
          details: { commitState: "committed-indeterminate" },
          message:
            "Replacement was renamed and its durability finalization was explicitly abandoned",
        },
      ],
      state: "committed-indeterminate",
    } as const;
    expect(await provider.commitReplacement(staged.value)).toEqual(abandoned);
    expect(await provider.commitReplacement(staged.value)).toEqual(abandoned);
    expect(targetSyncAttempts).toBe(1);
    expect(await readFile(movedTarget, "utf8")).toBe("new-complete");
  });

  test("cleanup failure is reported while discard remains idempotent", async () => {
    const roots = await fixture();
    const target = path.join(roots.workspaceRoot, "state.md");
    await writeFile(target, "old-complete");
    const provider = await createLocalResourceProvider({
      ...roots,
      faultInjector: injectedOnce("cleanup"),
    });
    const staged = await provider.stageReplacement(locator("state.md"), textEncoder.encode("new"));
    if (!staged.ok) throw new Error("staging failed unexpectedly");

    const first = await provider.discardReplacement(staged.value);
    const second = await provider.discardReplacement(staged.value);

    expect(diagnosticCode(first)).toBe("resource-provider-failure");
    expect(second.ok).toBeTrue();
    expect(await readFile(target, "utf8")).toBe("old-complete");
  });

  test("treats a target beneath a missing parent as already absent", async () => {
    const roots = await fixture();
    const provider = await createLocalResourceProvider(roots);
    const target = locator("groma", "intent", "ab", "target.md");
    const staged = await provider.stageReplacement(target, textEncoder.encode("remove me"));
    expect(staged.ok).toBeTrue();
    if (!staged.ok) return;
    expect((await provider.commitReplacement(staged.value)).state).toBe("committed");

    await rm(path.dirname(path.join(roots.workspaceRoot, String(target))), {
      recursive: true,
    });

    expect(await provider.removeResource(target)).toEqual({ state: "committed" });
    expect(await provider.removeResource(target)).toEqual({ state: "committed" });
  });
});

describe("same-machine coordination", () => {
  test("keeps Windows directory-sync and custom-root policy explicit", () => {
    expect(shouldSyncLocalCoordinationDirectory("win32")).toBeFalse();
    expect(shouldSyncLocalReplacementDirectory("win32")).toBeFalse();
    expect(allowsCustomLocalCoordinationRoot("win32")).toBeFalse();
    for (const platform of ["darwin", "linux"] as const) {
      expect(shouldSyncLocalCoordinationDirectory(platform)).toBeTrue();
      expect(shouldSyncLocalReplacementDirectory(platform)).toBeTrue();
      expect(allowsCustomLocalCoordinationRoot(platform)).toBeTrue();
    }
  });

  test("rejects Windows custom roots before I/O and POSIX coordination redirection", async () => {
    const roots = await fixture();
    const linkedCoordination = path.join(path.dirname(roots.workspaceRoot), "linked-coordination");

    if (process.platform === "win32") {
      await expect(
        createLocalResourceProvider({
          coordinationRoot: linkedCoordination,
          workspaceRoot: path.join(roots.workspaceRoot, "missing-workspace"),
        }),
      ).rejects.toThrow("Windows local coordination does not accept a custom root");
    } else {
      await symlink(roots.workspaceRoot, linkedCoordination, "dir");
      await expect(
        createLocalResourceProvider({
          coordinationRoot: linkedCoordination,
          workspaceRoot: roots.workspaceRoot,
        }),
      ).rejects.toThrow("must not be a symbolic link or junction");
    }
  });

  test("rejects a missing in-workspace coordination root before creating it", async () => {
    if (process.platform === "win32") return;
    const roots = await fixture();
    const inside = path.join(roots.workspaceRoot, "missing-coordination");

    await expect(
      createLocalResourceProvider({ coordinationRoot: inside, workspaceRoot: roots.workspaceRoot }),
    ).rejects.toThrow("must be a directory outside the canonical workspace");
    await expect(lstat(inside)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("rejects permissive custom coordination roots on POSIX", async () => {
    if (process.platform === "win32") return;
    const roots = await fixture();
    const coordinationRoot = requiredCoordinationRoot(roots);
    await chmod(coordinationRoot, 0o777);
    try {
      await expect(createLocalResourceProvider(roots)).rejects.toThrow(
        "must not grant group or other permissions",
      );
    } finally {
      await chmod(coordinationRoot, 0o700);
    }
  });

  test("repairs a newly created custom coordination root under a restrictive umask", async () => {
    if (process.platform === "win32") return;
    const roots = await fixture();
    const coordinationRoot = requiredCoordinationRoot(roots);
    await rm(coordinationRoot, { recursive: true });
    const previousUmask = process.umask(0o777);
    let rootMode: number | undefined;
    let coordinated: Result<string> | undefined;
    try {
      const provider = await createLocalResourceProvider(roots);
      rootMode = (await lstat(coordinationRoot)).mode & 0o777;
      coordinated = await provider.withCoordination(
        { context: "local-machine", locator: locator("new-custom-root") },
        () => "coordinated",
      );
    } finally {
      process.umask(previousUmask);
    }

    expect(rootMode).toBe(0o700);
    expect(coordinated).toEqual({ ok: true, value: "coordinated" });
  });

  test("requires owner write and search permissions on POSIX coordination roots", async () => {
    if (process.platform === "win32") return;
    const roots = await fixture();
    const coordinationRoot = requiredCoordinationRoot(roots);
    try {
      for (const mode of [0o500, 0o600]) {
        await chmod(coordinationRoot, mode);
        await expect(createLocalResourceProvider(roots)).rejects.toThrow(
          "must grant owner write and search permissions",
        );
      }
    } finally {
      await chmod(coordinationRoot, 0o700);
    }
  });

  test("rejects a custom coordination root owned by another POSIX user when testable", async () => {
    if (process.platform === "win32" || process.getuid?.() !== 0) return;
    const roots = await fixture();
    const coordinationRoot = requiredCoordinationRoot(roots);
    await chown(coordinationRoot, 1, 1);
    try {
      await expect(createLocalResourceProvider(roots)).rejects.toThrow(
        "must be owned by the current user",
      );
    } finally {
      await chown(coordinationRoot, 0, 0);
    }
  });

  test("fails closed under concurrent same-process providers and releases callback scope", async () => {
    const roots = await fixture();
    const first = await createLocalResourceProvider(roots);
    const second = await createLocalResourceProvider(roots);
    const request = { context: "local-machine" as const, locator: locator("transaction") };
    let ready!: () => void;
    const acquired = new Promise<void>((resolve) => {
      ready = resolve;
    });
    let release!: () => void;
    const held = first.withCoordination(request, async () => {
      ready();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return "first";
    });
    await within(acquired, 5_000, "same-process coordination acquisition");

    const contended = await second.withCoordination(request, () => "second");
    expect(diagnosticCode(contended)).toBe("resource-coordination-contended");
    release();
    expect(await held).toEqual({ ok: true, value: "first" });
    expect(await second.withCoordination(request, () => "after")).toEqual({
      ok: true,
      value: "after",
    });
  });

  test("forces private coordination modes under a restrictive umask", async () => {
    if (process.platform === "win32") return;
    const roots = await fixture();
    const provider = await createLocalResourceProvider(roots);
    const request = { context: "local-machine" as const, locator: locator("restrictive-umask") };
    const previousUmask = process.umask(0o777);
    let coordinated: Result<string> | undefined;
    try {
      coordinated = await provider.withCoordination(request, () => "coordinated");
    } finally {
      process.umask(previousUmask);
    }

    expect(coordinated).toEqual({ ok: true, value: "coordinated" });
    expect(await provider.withCoordination(request, () => "released")).toEqual({
      ok: true,
      value: "released",
    });
  });

  test("distinguishes action failure and releases coordination after one callback", async () => {
    const roots = await fixture();
    const provider = await createLocalResourceProvider(roots);
    const request = { context: "local-machine" as const, locator: locator("action-failure") };
    let callCount = 0;

    const result = await provider.withCoordination(request, () => {
      callCount += 1;
      throw new Error("action failed");
    });

    expect(callCount).toBe(1);
    expect(result.ok).toBeFalse();
    if (result.ok) return;
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["coordination-action-failed"]);
    expect(await provider.withCoordination(request, () => "after")).toEqual({
      ok: true,
      value: "after",
    });
  });

  test("reports completed action separately from release failure", async () => {
    const roots = await fixture();
    const provider = await createLocalResourceProvider({
      ...roots,
      faultInjector: injectedOnce("coordination-release"),
    });
    const request = { context: "local-machine" as const, locator: locator("release-failure") };
    let callCount = 0;

    const result = await provider.withCoordination(request, () => {
      callCount += 1;
      return "completed";
    });

    expect(callCount).toBe(1);
    expect(result.ok).toBeFalse();
    if (result.ok) return;
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      "coordination-release-failed",
      "resource-provider-failure",
    ]);
    expect(result.diagnostics[0]?.details?.actionCompleted).toBeTrue();
    expect(await provider.withCoordination(request, () => "after")).toEqual({
      ok: true,
      value: "after",
    });
  });

  test("keeps a persistent lease retryable when release fails before publication", async () => {
    const roots = await fixture();
    const provider = await createLocalResourceProvider({
      ...roots,
      faultInjector: injectedOnce("coordination-release"),
    });
    const competing = await createLocalResourceProvider(roots);
    const request = { context: "local-machine" as const, locator: locator("release-retry") };
    const acquired = await provider.acquireCoordination(request);
    expect(acquired).toMatchObject({ ok: true });
    if (!acquired.ok) throw new Error("expected persistent lease");

    expect(await provider.releaseCoordination(acquired.value)).toMatchObject({ ok: false });
    expect(await competing.acquireCoordination(request)).toMatchObject({
      diagnostics: [{ code: "resource-coordination-contended" }],
      ok: false,
    });
    expect(await provider.releaseCoordination(acquired.value)).toEqual({
      ok: true,
      value: undefined,
    });
    const reacquired = await competing.acquireCoordination(request);
    expect(reacquired).toMatchObject({ ok: true });
    if (reacquired.ok) {
      expect(await competing.releaseCoordination(reacquired.value)).toEqual({
        ok: true,
        value: undefined,
      });
    }
  });

  test("retains action and release diagnostics when both fail", async () => {
    const roots = await fixture();
    const provider = await createLocalResourceProvider({
      ...roots,
      faultInjector: injectedOnce("coordination-release"),
    });
    let callCount = 0;

    const result = await provider.withCoordination(
      { context: "local-machine", locator: locator("combined-failure") },
      () => {
        callCount += 1;
        throw new Error("action failed");
      },
    );

    expect(callCount).toBe(1);
    expect(result.ok).toBeFalse();
    if (result.ok) return;
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      "coordination-action-failed",
      "coordination-release-failed",
      "resource-provider-failure",
    ]);
    expect(result.diagnostics[1]?.details?.actionCompleted).toBeFalse();
  });

  test("ignores inherited toJSON for cursors and coordination owners", async () => {
    const roots = await fixture();
    await writeFile(path.join(roots.workspaceRoot, "a.md"), "a");
    await writeFile(path.join(roots.workspaceRoot, "b.md"), "b");
    const provider = await createLocalResourceProvider(roots);
    const previous = Object.getOwnPropertyDescriptor(Object.prototype, "toJSON");
    let calls = 0;
    let cursorContinued = false;
    let coordinationSucceeded = false;
    Object.defineProperty(Object.prototype, "toJSON", {
      configurable: true,
      value: () => {
        calls += 1;
        throw new Error("inherited toJSON must not run");
      },
      writable: true,
    });
    try {
      const request = {
        limit: 1,
        locator: locator(),
        maxDepth: 0,
        maxEntriesPerDirectory: 10,
      };
      const first = await provider.enumerate(request);
      if (!first.ok || first.value.nextCursor === undefined) {
        throw new Error("expected a continuation cursor");
      }
      const second = await provider.enumerate({ ...request, cursor: first.value.nextCursor });
      cursorContinued = second.ok;
      const coordinated = await provider.withCoordination(
        { context: "local-machine", locator: locator("owner-json") },
        () => "coordinated",
      );
      coordinationSucceeded = coordinated.ok && coordinated.value === "coordinated";
    } finally {
      if (previous === undefined) Reflect.deleteProperty(Object.prototype, "toJSON");
      else Object.defineProperty(Object.prototype, "toJSON", previous);
    }

    expect(calls).toBe(0);
    expect(cursorContinued).toBeTrue();
    expect(coordinationSucceeded).toBeTrue();
  });

  test("uses captured persistence intrinsics and codec instances", async () => {
    const roots = await fixture();
    await mkdir(path.join(roots.workspaceRoot, "base", "resume"), { recursive: true });
    await writeFile(path.join(roots.workspaceRoot, "base", "resume", "a.md"), "a");
    await writeFile(path.join(roots.workspaceRoot, "base", "resume", "b.md"), "b");
    const first = await createLocalResourceProvider(roots);
    const second = await createLocalResourceProvider(roots);
    const methods = [
      "charCodeAt",
      "endsWith",
      "includes",
      "normalize",
      "slice",
      "split",
      "startsWith",
      "toLowerCase",
    ] as const;
    const previousStrings = methods.map(
      (name) => [name, Object.getOwnPropertyDescriptor(String.prototype, name)] as const,
    );
    const arrayMethods = ["join", "push", "slice", "sort"] as const;
    const previousArrays = arrayMethods.map(
      (name) => [name, Object.getOwnPropertyDescriptor(Array.prototype, name)] as const,
    );
    const uint8ArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
    const previousUint8ArraySlice = Object.getOwnPropertyDescriptor(uint8ArrayPrototype, "slice");
    const previousTest = Object.getOwnPropertyDescriptor(RegExp.prototype, "test");
    const textDecoderPrototype = TextDecoder.prototype;
    const textEncoderPrototype = TextEncoder.prototype;
    const previousDecode = Object.getOwnPropertyDescriptor(textDecoderPrototype, "decode");
    const previousEncode = Object.getOwnPropertyDescriptor(textEncoderPrototype, "encode");
    const previousTextDecoder = Object.getOwnPropertyDescriptor(globalThis, "TextDecoder");
    const previousTextEncoder = Object.getOwnPropertyDescriptor(globalThis, "TextEncoder");
    let calls = 0;
    let validParsed = false;
    let forbiddenRejected = false;
    let reservedRejected = false;
    let readSucceeded = false;
    let cursorOrderPreserved = false;
    let aliasContended = false;
    let holderSucceeded = false;
    let release: (() => void) | undefined;
    let held: Promise<Result<void>> | undefined;
    try {
      for (const name of methods) {
        Object.defineProperty(String.prototype, name, {
          configurable: true,
          value: () => {
            calls += 1;
            throw new Error(`patched ${name} must not run`);
          },
          writable: true,
        });
      }
      for (const name of arrayMethods) {
        Object.defineProperty(Array.prototype, name, {
          configurable: true,
          value: () => {
            calls += 1;
            throw new Error(`patched Array ${name} must not run`);
          },
          writable: true,
        });
      }
      if (previousUint8ArraySlice === undefined) {
        throw new Error("expected Uint8Array slice descriptor");
      }
      Object.defineProperty(uint8ArrayPrototype, "slice", {
        ...previousUint8ArraySlice,
        value: () => {
          calls += 1;
          throw new Error("patched Uint8Array slice must not run");
        },
      });
      Object.defineProperty(RegExp.prototype, "test", {
        configurable: true,
        value: () => {
          calls += 1;
          throw new Error("patched test must not run");
        },
        writable: true,
      });
      for (const [prototype, name, descriptor] of [
        [textDecoderPrototype, "decode", previousDecode],
        [textEncoderPrototype, "encode", previousEncode],
      ] as const) {
        if (descriptor === undefined) throw new Error(`expected ${name} descriptor`);
        Object.defineProperty(prototype, name, {
          ...descriptor,
          value: () => {
            calls += 1;
            throw new Error(`patched ${name} must not run`);
          },
        });
      }
      for (const name of ["TextDecoder", "TextEncoder"] as const) {
        Object.defineProperty(globalThis, name, {
          configurable: true,
          value: class {
            constructor() {
              calls += 1;
              throw new Error(`patched ${name} constructor must not run`);
            }
          },
          writable: true,
        });
      }
      validParsed = parseWorkspaceResourceLocator("base/resume/a.md").ok;
      const forbidden = parseWorkspaceResourceLocator("back\\slash");
      forbiddenRejected =
        !forbidden.ok && forbidden.diagnostics[0]?.code === "invalid-resource-locator";
      const reserved = parseWorkspaceResourceLocator(".GrOmA-StAgE-private");
      reservedRejected =
        !reserved.ok && reserved.diagnostics[0]?.code === "invalid-resource-locator";
      const read = await first.read({ locator: locator("base", "resume", "a.md"), maxBytes: 8 });
      readSucceeded = read.ok && read.value.bytes.byteLength === 1 && read.value.bytes[0] === 97;
      const request = {
        limit: 2,
        locator: locator("base"),
        maxDepth: 1,
        maxEntriesPerDirectory: 10,
      };
      const firstPage = await first.enumerate(request);
      if (!firstPage.ok || firstPage.value.nextCursor === undefined) {
        throw new Error("expected an intrinsic-safe continuation cursor");
      }
      const secondPage = await first.enumerate({
        ...request,
        cursor: firstPage.value.nextCursor,
      });
      cursorOrderPreserved =
        firstPage.value.entries.length === 2 &&
        firstPage.value.entries[0]?.locator === "base/resume" &&
        firstPage.value.entries[1]?.locator === "base/resume/a.md" &&
        secondPage.ok &&
        secondPage.value.entries.length === 1 &&
        secondPage.value.entries[0]?.locator === "base/resume/b.md";
      let ready!: () => void;
      const acquired = new Promise<void>((resolve) => {
        ready = resolve;
      });
      held = first.withCoordination(
        { context: "local-machine", locator: locator("State.md") },
        async () => {
          ready();
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        },
      );
      await within(acquired, 5_000, "intrinsic alias coordination acquisition");
      const contended = await second.withCoordination(
        { context: "local-machine", locator: locator("state.md") },
        () => undefined,
      );
      aliasContended = diagnosticCode(contended) === "resource-coordination-contended";
      if (release === undefined) throw new Error("coordination holder did not expose release");
      release();
      holderSucceeded = (await held).ok;
    } finally {
      release?.();
      if (held !== undefined) await held.catch(() => undefined);
      for (const [name, descriptor] of previousStrings) {
        if (descriptor === undefined) Reflect.deleteProperty(String.prototype, name);
        else Object.defineProperty(String.prototype, name, descriptor);
      }
      for (const [name, descriptor] of previousArrays) {
        if (descriptor === undefined) Reflect.deleteProperty(Array.prototype, name);
        else Object.defineProperty(Array.prototype, name, descriptor);
      }
      if (previousUint8ArraySlice === undefined) {
        Reflect.deleteProperty(uint8ArrayPrototype, "slice");
      } else {
        Object.defineProperty(uint8ArrayPrototype, "slice", previousUint8ArraySlice);
      }
      if (previousTest === undefined) Reflect.deleteProperty(RegExp.prototype, "test");
      else Object.defineProperty(RegExp.prototype, "test", previousTest);
      if (previousDecode === undefined) Reflect.deleteProperty(textDecoderPrototype, "decode");
      else Object.defineProperty(textDecoderPrototype, "decode", previousDecode);
      if (previousEncode === undefined) Reflect.deleteProperty(textEncoderPrototype, "encode");
      else Object.defineProperty(textEncoderPrototype, "encode", previousEncode);
      if (previousTextDecoder === undefined) Reflect.deleteProperty(globalThis, "TextDecoder");
      else Object.defineProperty(globalThis, "TextDecoder", previousTextDecoder);
      if (previousTextEncoder === undefined) Reflect.deleteProperty(globalThis, "TextEncoder");
      else Object.defineProperty(globalThis, "TextEncoder", previousTextEncoder);
    }

    expect(calls).toBe(0);
    expect(validParsed).toBeTrue();
    expect(forbiddenRejected).toBeTrue();
    expect(reservedRejected).toBeTrue();
    expect(readSucceeded).toBeTrue();
    expect(cursorOrderPreserved).toBeTrue();
    expect(aliasContended).toBeTrue();
    expect(holderSucceeded).toBeTrue();
  });

  test("case-folds and NFC-normalizes conservative coordination aliases", async () => {
    const roots = await fixture();
    await writeFile(path.join(roots.workspaceRoot, "State.md"), "state");
    const first = await createLocalResourceProvider(roots);
    const second = await createLocalResourceProvider(roots);

    const assertAliasesContend = async (
      heldLocator: WorkspaceResourceLocator,
      aliasLocator: WorkspaceResourceLocator,
    ): Promise<void> => {
      let ready!: () => void;
      let release!: () => void;
      const acquired = new Promise<void>((resolve) => {
        ready = resolve;
      });
      const held = first.withCoordination(
        { context: "local-machine", locator: heldLocator },
        async () => {
          ready();
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        },
      );
      await within(acquired, 5_000, "alias coordination acquisition");
      const contended = await second.withCoordination(
        { context: "local-machine", locator: aliasLocator },
        () => undefined,
      );
      expect(diagnosticCode(contended)).toBe("resource-coordination-contended");
      release();
      expect((await held).ok).toBeTrue();
    };

    await assertAliasesContend(locator("State.md"), locator("state.md"));
    await assertAliasesContend(locator("café.md"), locator("café.md"));
  });

  test("fails closed while a real child process holds the same local lock", async () => {
    const roots = await fixture();
    const childLocator = locator("State.md");
    const parentAlias = locator("state.md");
    let readyResolve!: () => void;
    let readyReject!: (error: Error) => void;
    const ready = new Promise<void>((resolve, reject) => {
      readyResolve = resolve;
      readyReject = reject;
    });
    const child = Bun.spawn({
      cmd: [
        process.execPath,
        coordinationChild,
        ...coordinationChildArguments(roots, childLocator),
      ],
      ipc(message) {
        if (isChildMessage(message, "ready")) readyResolve();
        if (isChildMessage(message, "error")) {
          readyReject(new Error("coordination child reported an error"));
        }
      },
      stderr: "pipe",
      stdout: "pipe",
    });
    try {
      await within(
        Promise.race([
          ready,
          child.exited.then(async (code) => {
            const stderr = await new Response(child.stderr).text();
            throw new Error(`coordination child exited before readiness (${code}): ${stderr}`);
          }),
        ]),
        5_000,
        "child coordination readiness",
      );
      const provider = await createLocalResourceProvider(roots);
      let called = false;

      const contended = await provider.withCoordination(
        { context: "local-machine", locator: parentAlias },
        () => {
          called = true;
        },
      );

      expect(diagnosticCode(contended)).toBe("resource-coordination-contended");
      expect(called).toBeFalse();
      child.send({ type: "release" });
      expect(await within(child.exited, 5_000, "child coordination release")).toBe(0);
      expect(
        await provider.withCoordination(
          { context: "local-machine", locator: parentAlias },
          () => "released",
        ),
      ).toEqual({ ok: true, value: "released" });
    } finally {
      if (child.exitCode === null) {
        try {
          child.send({ type: "release" });
        } catch {
          // The IPC channel may already be closed.
        }
        child.kill();
        await Promise.race([child.exited, Bun.sleep(2_000)]);
      }
      try {
        child.disconnect();
      } catch {
        // The child may have already closed the IPC channel while exiting.
      }
      child.unref();
    }
  });

  test("reaps a proven-dead persistent lease immediately but preserves callback stale age", async () => {
    const roots = await fixture();

    const killedHolder = async (
      heldLocator: WorkspaceResourceLocator,
      persistent: boolean,
    ): Promise<void> => {
      let readyResolve!: () => void;
      let readyReject!: (error: Error) => void;
      const ready = new Promise<void>((resolve, reject) => {
        readyResolve = resolve;
        readyReject = reject;
      });
      const child = Bun.spawn({
        cmd: [
          process.execPath,
          coordinationChild,
          ...coordinationChildArguments(roots, heldLocator),
          ...(persistent ? ["--persistent"] : []),
        ],
        ipc(message) {
          if (isChildMessage(message, "ready")) readyResolve();
          if (isChildMessage(message, "error")) {
            readyReject(new Error("coordination child reported an error"));
          }
        },
        stderr: "pipe",
        stdout: "pipe",
      });
      try {
        await within(
          Promise.race([
            ready,
            child.exited.then(async (code) => {
              const stderr = await new Response(child.stderr).text();
              throw new Error(`coordination child exited before readiness (${code}): ${stderr}`);
            }),
          ]),
          5_000,
          "persistent coordination readiness",
        );
        child.kill();
        await within(child.exited, 5_000, "killed coordination holder");
      } finally {
        if (child.exitCode === null) {
          child.kill();
          await Promise.race([child.exited, Bun.sleep(2_000)]);
        }
        try {
          child.disconnect();
        } catch {
          // The killed child may already have closed IPC.
        }
        child.unref();
      }
    };

    const transaction = locator("transaction");
    await killedHolder(transaction, true);
    const persistentProvider = await createLocalResourceProvider(roots);
    const recovered = await within(
      persistentProvider.acquireCoordination({
        context: "local-machine",
        locator: transaction,
      }),
      5_000,
      "immediate proven-dead lease recovery",
    );
    expect(recovered).toMatchObject({ ok: true });
    if (!recovered.ok) throw new Error("expected persistent lease recovery");
    expect(await persistentProvider.releaseCoordination(recovered.value)).toEqual({
      ok: true,
      value: undefined,
    });

    const callback = locator("callback");
    await killedHolder(callback, false);
    const callbackProvider = await createLocalResourceProvider(roots);
    expect(
      diagnosticCode(
        await callbackProvider.withCoordination(
          { context: "local-machine", locator: callback },
          () => undefined,
        ),
      ),
    ).toBe("resource-coordination-contended");
  });

  test("returns explicit unsupported-context diagnostics", async () => {
    const roots = await fixture();
    const provider = await createLocalResourceProvider(roots);
    let called = false;

    const result = await provider.withCoordination(
      { context: "multi-host", locator: locator("transaction") },
      () => {
        called = true;
      },
    );

    expect(diagnosticCode(result)).toBe("unsupported-coordination-context");
    expect(called).toBeFalse();
  });

  test("never publishes an incomplete claim and keeps malformed external locks contended", async () => {
    if (process.platform === "win32") return;
    const roots = await fixture();
    const coordinationRoot = requiredCoordinationRoot(roots);
    const lockLocator = locator("transaction");
    const identity = await coordinationHash(roots.workspaceRoot, lockLocator);
    const lockPath = path.join(coordinationRoot, `${identity}.lock`);
    const interrupted = await createLocalResourceProvider({
      ...roots,
      faultInjector: injectedOnce("coordination-claim"),
    });
    expect(
      diagnosticCode(
        await interrupted.withCoordination(
          { context: "local-machine", locator: lockLocator },
          () => undefined,
        ),
      ),
    ).toBe("resource-provider-failure");
    expect((await readdir(coordinationRoot)).some((name) => name.endsWith(".lock"))).toBeFalse();

    await mkdir(lockPath, { mode: 0o700 });
    await writeFile(path.join(lockPath, "owner.json"), "malformed");
    const provider = await createLocalResourceProvider({ ...roots, staleLockMilliseconds: 1 });
    let called = false;
    const uncertain = await provider.withCoordination(
      { context: "local-machine", locator: lockLocator },
      () => {
        called = true;
      },
    );
    expect(diagnosticCode(uncertain)).toBe("resource-coordination-contended");
    expect(called).toBeFalse();
    expect((await lstat(lockPath)).isDirectory()).toBeTrue();

    await rm(lockPath, { recursive: true });
    const departed = Bun.spawn({
      cmd: [process.execPath, "-e", "await Bun.sleep(10_000)"],
      stderr: "ignore",
      stdout: "ignore",
    });
    const deadPid = departed.pid;
    departed.kill();
    await departed.exited;
    await Bun.sleep(5);
    await mkdir(lockPath, { mode: 0o700 });
    await writeFile(
      path.join(lockPath, "owner.json"),
      JSON.stringify({ createdAt: 0, pid: deadPid, token: "------------------------------------" }),
      { mode: 0o600 },
    );
    let invalidTokenCalled = false;

    const invalidToken = await provider.withCoordination(
      { context: "local-machine", locator: lockLocator },
      () => {
        invalidTokenCalled = true;
      },
    );

    expect(diagnosticCode(invalidToken)).toBe("resource-coordination-contended");
    expect(invalidTokenCalled).toBeFalse();
    expect((await lstat(lockPath)).isDirectory()).toBeTrue();
  });

  test("keeps symlink lock and reaping artifacts contended despite stale valid owners", async () => {
    if (process.platform === "win32") return;
    const roots = await fixture();
    const coordinationRoot = requiredCoordinationRoot(roots);
    const departed = Bun.spawn({
      cmd: [process.execPath, "-e", "await Bun.sleep(10_000)"],
      stderr: "ignore",
      stdout: "ignore",
    });
    const deadPid = departed.pid;
    departed.kill();
    await departed.exited;

    for (const suffix of ["lock", "reaping"] as const) {
      const lockLocator = locator(`linked-${suffix}`);
      const identity = await coordinationHash(roots.workspaceRoot, lockLocator);
      const artifactPath = path.join(coordinationRoot, `${identity}.${suffix}`);
      const outsideArtifact = path.join(path.dirname(roots.workspaceRoot), `outside-${suffix}`);
      await mkdir(outsideArtifact, { mode: 0o700 });
      await writeFile(
        path.join(outsideArtifact, "owner.json"),
        JSON.stringify({ createdAt: 0, pid: deadPid, token: randomUUID() }),
        { mode: 0o600 },
      );
      await symlink(outsideArtifact, artifactPath, "dir");
      const provider = await createLocalResourceProvider({ ...roots, staleLockMilliseconds: 1 });
      let called = false;

      const result = await provider.withCoordination(
        { context: "local-machine", locator: lockLocator },
        () => {
          called = true;
        },
      );

      expect(diagnosticCode(result)).toBe("resource-coordination-contended");
      expect(called).toBeFalse();
      expect((await lstat(artifactPath)).isSymbolicLink()).toBeTrue();
      expect((await lstat(path.join(outsideArtifact, "owner.json"))).isFile()).toBeTrue();
    }
  });

  test("reaps a killed valid owner while concurrent reapers and acquirers fail safe", async () => {
    const roots = await fixture();
    const lockLocator = locator("killed-owner");
    let ready!: () => void;
    const acquired = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const child = Bun.spawn({
      cmd: [process.execPath, coordinationChild, ...coordinationChildArguments(roots, lockLocator)],
      ipc(message) {
        if (isChildMessage(message, "ready")) ready();
      },
      stderr: "pipe",
      stdout: "pipe",
    });
    await within(acquired, 5_000, "killed owner readiness");
    child.kill();
    await within(child.exited, 5_000, "killed owner exit");
    await Bun.sleep(5);
    const identity = await coordinationHash(roots.workspaceRoot, lockLocator);
    if (roots.coordinationRoot !== undefined) {
      const abandonedReaping = path.join(roots.coordinationRoot, `${identity}.reaping`);
      await mkdir(abandonedReaping, { mode: 0o700 });
      await writeFile(
        path.join(abandonedReaping, "owner.json"),
        JSON.stringify({ createdAt: 0, pid: child.pid, token: randomUUID() }),
        { mode: 0o600 },
      );
    }

    const first = await createLocalResourceProvider({ ...roots, staleLockMilliseconds: 1 });
    const second = await createLocalResourceProvider({ ...roots, staleLockMilliseconds: 1 });
    let actionCount = 0;
    let release!: () => void;
    let winnerReady!: () => void;
    const winnerAcquired = new Promise<void>((resolve) => {
      winnerReady = resolve;
    });
    const action = async (): Promise<void> => {
      actionCount += 1;
      winnerReady();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    };
    const firstAttempt = first.withCoordination(
      { context: "local-machine", locator: lockLocator },
      action,
    );
    const secondAttempt = second.withCoordination(
      { context: "local-machine", locator: lockLocator },
      action,
    );
    await within(winnerAcquired, 5_000, "stale owner recovery");
    release();
    const outcomes = await Promise.all([firstAttempt, secondAttempt]);
    expect(actionCount).toBe(1);
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(
      outcomes.some(
        (outcome) => !outcome.ok && diagnosticCode(outcome) === "resource-coordination-contended",
      ),
    ).toBeTrue();
  });

  test("bounds repeated stale-owner reacquisition", async () => {
    if (process.platform === "win32") return;
    const roots = await fixture();
    const coordinationRoot = requiredCoordinationRoot(roots);
    const lockLocator = locator("reacquisition-bound");
    const identity = await coordinationHash(roots.workspaceRoot, lockLocator);
    const lockPath = path.join(coordinationRoot, `${identity}.lock`);
    const departed = Bun.spawn({
      cmd: [process.execPath, "-e", "await Bun.sleep(10_000)"],
      stderr: "ignore",
      stdout: "ignore",
    });
    const deadPid = departed.pid;
    departed.kill();
    await departed.exited;
    await Bun.sleep(5);

    const writeStaleOwner = async (): Promise<void> => {
      await mkdir(lockPath, { mode: 0o700 });
      await writeFile(
        path.join(lockPath, "owner.json"),
        JSON.stringify({ createdAt: 0, pid: deadPid, token: randomUUID() }),
        { mode: 0o600 },
      );
    };
    await writeStaleOwner();
    let replacementCount = 0;
    const provider = await createLocalResourceProvider({
      ...roots,
      staleLockMilliseconds: 1,
      faultInjector: async (phase) => {
        if (phase !== "coordination-reacquire") return;
        replacementCount += 1;
        await writeStaleOwner();
      },
    });
    let actionCount = 0;

    const result = await provider.withCoordination(
      { context: "local-machine", locator: lockLocator },
      () => {
        actionCount += 1;
      },
    );

    expect(diagnosticCode(result)).toBe("resource-coordination-retry-exhausted");
    expect(replacementCount).toBe(8);
    expect(actionCount).toBe(0);
  });

  test("cleanup failures leave only ignored artifacts and do not block reacquisition", async () => {
    if (process.platform === "win32") return;
    const roots = await fixture();
    const lockLocator = locator("cleanup-failure");
    const dirty = await createLocalResourceProvider({
      ...roots,
      faultInjector: (phase) => {
        if (phase === "coordination-cleanup") throw new Error("injected cleanup failure");
      },
    });
    expect(
      await dirty.withCoordination(
        { context: "local-machine", locator: lockLocator },
        () => "first",
      ),
    ).toEqual({ ok: true, value: "first" });
    if (roots.coordinationRoot !== undefined) {
      expect(
        (await readdir(roots.coordinationRoot)).some((name) => name.includes(".released-")),
      ).toBeTrue();
    }

    const clean = await createLocalResourceProvider(roots);
    expect(
      await clean.withCoordination(
        { context: "local-machine", locator: lockLocator },
        () => "second",
      ),
    ).toEqual({ ok: true, value: "second" });
  });
});
