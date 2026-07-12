import { afterEach, describe, expect, test } from "bun:test";
import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { Result } from "../../core/result.ts";
import {
  type LocalResourceFaultPhase,
  createLocalResourceProvider,
} from "../local-resource-provider.ts";
import {
  type ResourceEnumerationPage,
  type StagedReplacementHandle,
  type WorkspaceResourceLocator,
  workspaceResourceLocator,
} from "../contracts.ts";

const temporaryRoots: string[] = [];
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

async function fixture(): Promise<{ coordinationRoot: string; workspaceRoot: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "groma-resource-provider-"));
  temporaryRoots.push(root);
  const workspaceRoot = path.join(root, "workspace");
  const coordinationRoot = path.join(root, "coordination");
  await mkdir(workspaceRoot);
  await mkdir(coordinationRoot);
  return { coordinationRoot, workspaceRoot };
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
});

describe("same-machine coordination", () => {
  test("rejects a volatile coordination path that resolves into canonical contents", async () => {
    const roots = await fixture();
    const linkedCoordination = path.join(path.dirname(roots.workspaceRoot), "linked-coordination");
    try {
      await symlink(roots.workspaceRoot, linkedCoordination, "dir");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }

    expect(
      createLocalResourceProvider({
        coordinationRoot: linkedCoordination,
        workspaceRoot: roots.workspaceRoot,
      }),
    ).rejects.toThrow("outside the canonical workspace");
  });

  test("fails closed under concurrent same-process providers and releases callback scope", async () => {
    const roots = await fixture();
    const first = await createLocalResourceProvider(roots);
    const second = await createLocalResourceProvider(roots);
    const request = { context: "local-machine" as const, locator: locator("transaction") };
    let release!: () => void;
    const held = first.withCoordination(request, async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return "first";
    });
    await Bun.sleep(5);

    const contended = await second.withCoordination(request, () => "second");
    expect(diagnosticCode(contended)).toBe("resource-coordination-contended");
    release();
    expect(await held).toEqual({ ok: true, value: "first" });
    expect(await second.withCoordination(request, () => "after")).toEqual({
      ok: true,
      value: "after",
    });
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

  test("reaps an old owner proven dead but never steals uncertain owner state", async () => {
    const roots = await fixture();
    const canonicalRoot = await realpath(roots.workspaceRoot);
    const lockLocator = locator("transaction");
    const identity = createHash("sha256")
      .update(canonicalRoot)
      .update("\0")
      .update(lockLocator)
      .digest("hex");
    const lockPath = path.join(roots.coordinationRoot, `${identity}.lock`);
    let deadPid: number | undefined;
    for (const candidate of [2_147_483_647, 2_000_000_000, process.pid + 1_000_000]) {
      try {
        process.kill(candidate, 0);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ESRCH") {
          deadPid = candidate;
          break;
        }
      }
    }
    if (deadPid === undefined) return;
    await mkdir(lockPath);
    await writeFile(
      path.join(lockPath, "owner.json"),
      JSON.stringify({ createdAt: 0, pid: deadPid, token: randomUUID() }),
    );
    const provider = await createLocalResourceProvider({
      ...roots,
      staleLockMilliseconds: 1,
    });

    expect(
      await provider.withCoordination(
        { context: "local-machine", locator: lockLocator },
        () => "recovered",
      ),
    ).toEqual({ ok: true, value: "recovered" });

    await mkdir(lockPath);
    const uncertain = await provider.withCoordination(
      { context: "local-machine", locator: lockLocator },
      () => "must-not-run",
    );
    expect(diagnosticCode(uncertain)).toBe("resource-coordination-contended");
    expect((await lstat(lockPath)).isDirectory()).toBeTrue();
  });
});
