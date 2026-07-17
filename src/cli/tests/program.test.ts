import { afterEach, describe, expect, test } from "bun:test";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createDefaultBootstrapRegistry } from "../../host/index.ts";
import { CLI_EXIT, CLI_MAX_RENDERED_BYTES, type CliInputSource } from "../contracts.ts";
import {
  GROMA_VERSION,
  HELP_TEXT,
  runProgram,
  type ProgramOptions,
  type ProgramOutput,
} from "../program.ts";

const roots: string[] = [];
// This cold integration invokes the package manager, TypeScript, a nested Bun test process,
// and several fresh Host compositions. Keep a finite CI allowance above Bun's 5s unit default.
const generatedPackageWorkflowTimeoutMilliseconds = 15_000;

function testGeneratedPackageWorkflow(run: () => Promise<void>): void {
  test(
    "scaffolds, tests, adds, enables, and reloads one package through public paths",
    run,
    generatedPackageWorkflowTimeoutMilliseconds,
  );
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function workspace(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "groma-cli-"));
  roots.push(root);
  return root;
}

async function fileTreeSnapshot(directory: string): Promise<readonly string[]> {
  const entries: string[] = [];
  const visit = async (current: string, prefix: string): Promise<void> => {
    const children = await readdir(current, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      const relative = prefix.length === 0 ? child.name : `${prefix}/${child.name}`;
      const absolute = path.join(current, child.name);
      if (child.isDirectory()) await visit(absolute, relative);
      else entries.push(`${relative}:${Buffer.from(await readFile(absolute)).toString("base64")}`);
    }
  };
  await visit(directory, "");
  return Object.freeze(entries);
}

function captureOutput(): ProgramOutput & { errors: string[]; output: string[] } {
  const errors: string[] = [];
  const output: string[] = [];
  return {
    errors,
    output,
    writeError: (message) => errors.push(message),
    writeOutput: (message) => output.push(message),
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

interface JsonEnvelope {
  readonly command: string;
  readonly exitCode: number;
  readonly ok: boolean;
  readonly result: Record<string, unknown>;
}

async function jsonCommand(
  root: string,
  args: readonly string[],
  input?: string,
  extraOptions: Pick<ProgramOptions, "userDataRoot"> = {},
): Promise<{ readonly envelope: JsonEnvelope; readonly exitCode: number; readonly text: string }> {
  const captured = captureOutput();
  const inputReader =
    input === undefined
      ? undefined
      : {
          read: async (_source: CliInputSource) => input,
        };
  const exitCode = await runProgram(["--format", "json", ...args], captured, {
    ...(inputReader === undefined ? {} : { inputReader }),
    terminal: { stdin: false, stdout: false },
    ...extraOptions,
    workspaceRoot: root,
  });
  expect(captured.errors).toEqual([]);
  expect(captured.output).toHaveLength(1);
  const text = captured.output[0]!;
  return { envelope: JSON.parse(text) as JsonEnvelope, exitCode, text };
}

function committedRevision(envelope: JsonEnvelope, id: string): string {
  const revisions = envelope.result.revisions as Array<{
    readonly componentId: string;
    readonly revision: string | null;
  }>;
  const revision = revisions.find((entry) => entry.componentId === id)?.revision;
  if (typeof revision !== "string") throw new Error(`missing committed revision for ${id}`);
  return revision;
}

describe("CLI program", () => {
  for (const args of [["--help"], ["-h"]] as const) {
    test(`renders help for ${JSON.stringify(args)}`, async () => {
      const captured = captureOutput();

      expect(await runProgram(args, captured)).toBe(CLI_EXIT.success);
      expect(captured.output).toEqual([HELP_TEXT]);
      expect(captured.errors).toEqual([]);
    });
  }

  for (const args of [["--version"], ["-V"]] as const) {
    test(`renders the version for ${JSON.stringify(args)}`, async () => {
      const captured = captureOutput();

      expect(await runProgram(args, captured)).toBe(CLI_EXIT.success);
      expect(captured.output).toEqual([`${GROMA_VERSION}\n`]);
      expect(captured.errors).toEqual([]);
    });
  }

  test("wraps explicit JSON help and version requests in the machine envelope", async () => {
    for (const [argument, result] of [
      ["--help", { usage: HELP_TEXT }],
      ["--version", { version: GROMA_VERSION }],
    ] as const) {
      const captured = captureOutput();

      expect(await runProgram(["--format", "json", argument], captured)).toBe(CLI_EXIT.success);
      expect(captured.errors).toEqual([]);
      expect(captured.output).toHaveLength(1);
      expect(JSON.parse(captured.output[0]!) as JsonEnvelope).toEqual({
        command: argument.slice(2),
        exitCode: 0,
        ok: true,
        result,
      });
    }
  });

  test("preserves the requested JSON envelope for an oversized invocation", async () => {
    const captured = captureOutput();
    const exitCode = await runProgram(
      ["--format", "json", ...Array.from({ length: 256 }, () => "argument")],
      captured,
    );

    expect(exitCode).toBe(CLI_EXIT.usage);
    expect(captured.errors).toEqual([]);
    expect(captured.output).toHaveLength(1);
    expect(JSON.parse(captured.output[0]!) as JsonEnvelope).toMatchObject({
      command: "invocation",
      exitCode: CLI_EXIT.usage,
      ok: false,
      result: { diagnostics: [{ code: "cli-invalid-invocation" }], ok: false },
    });
  });

  test("offers initialization without creating files when the workspace is missing", async () => {
    const root = await workspace();
    const captured = captureOutput();

    expect(
      await runProgram([], captured, {
        terminal: { stdin: false, stdout: false },
        workspaceRoot: root,
      }),
    ).toBe(CLI_EXIT.success);
    expect(captured.output).toEqual(["No Groma workspace is initialized here.\nRun: groma init\n"]);
    expect(await readdir(root)).toEqual([]);
  });

  test("requires an initialized workspace for explicit migration inspection", async () => {
    const root = await workspace();

    expect(await jsonCommand(root, ["migrate", "status"])).toMatchObject({
      envelope: {
        command: "migrate status",
        exitCode: CLI_EXIT.workspace,
        ok: false,
        result: { diagnostics: [{ code: "no-workspace" }], ok: false },
      },
      exitCode: CLI_EXIT.workspace,
    });
    expect(await readdir(root)).toEqual([]);
  });

  test("initializes and restarts an empty home-rooted workspace without creating contained user state", async () => {
    const root = await workspace();
    const containedUserDataRoot = path.join(root, ".groma");

    expect(
      await jsonCommand(root, ["init"], undefined, { userDataRoot: containedUserDataRoot }),
    ).toMatchObject({ envelope: { command: "init", exitCode: CLI_EXIT.success, ok: true } });
    await expect(lstat(containedUserDataRoot)).rejects.toThrow();
    expect(
      await jsonCommand(root, ["component", "roots", "--limit", "1"], undefined, {
        userDataRoot: containedUserDataRoot,
      }),
    ).toMatchObject({
      envelope: { command: "component roots", exitCode: CLI_EXIT.success, ok: true },
    });
    await expect(lstat(containedUserDataRoot)).rejects.toThrow();
  });

  test("renders a limit-one official export whose escaped JSON exceeds one MiB", async () => {
    const root = await workspace();
    const source = "ent_00000000000000000000000000000001";
    const target = "ent_00000000000000000000000000000002";
    const description = "\\".repeat(600_000);
    const registry = createDefaultBootstrapRegistry({
      surface: { start: () => ({ completion: Promise.resolve(), stop: async () => {} }) },
    });
    const composed = await registry.compose({ workspaceRoot: root });
    expect(composed.ok).toBeTrue();
    if (!composed.ok) return;
    expect(await composed.value.operations.initialize({})).toMatchObject({
      ok: true,
      value: { status: "initialized" },
    });
    expect(
      await composed.value.operations.createComponent({
        component: { id: target, name: "Target", type: "service" },
      }),
    ).toMatchObject({ status: "committed" });
    expect(
      await composed.value.operations.createComponent({
        component: { id: source, name: "Large relationship source", type: "domain" },
        relationships: [{ description, target, type: "depends-on" }],
      }),
    ).toMatchObject({ status: "committed" });
    const sourceBytes = await readFile(path.join(root, "groma", "intent", "00", `${source}.md`));
    expect(sourceBytes.byteLength).toBeLessThanOrEqual(1_048_576);

    const exported = await jsonCommand(root, ["blueprint", "export", "--limit", "1"]);
    const renderedBytes = new TextEncoder().encode(exported.text).byteLength;
    expect(renderedBytes).toBeGreaterThan(1_048_576);
    expect(renderedBytes).toBeLessThanOrEqual(CLI_MAX_RENDERED_BYTES);
    expect(exported).toMatchObject({
      envelope: {
        command: "blueprint export",
        exitCode: CLI_EXIT.success,
        ok: true,
        result: {
          ok: true,
          value: {
            hasMore: true,
            items: [
              {
                component: { id: source },
                relationships: [{ description, source, target }],
              },
            ],
          },
        },
      },
      exitCode: CLI_EXIT.success,
    });
  });

  test("executes the complete one-shot component workflow across host restarts", async () => {
    const root = await workspace();
    const domain = "ent_00000000000000000000000000000001";
    const target = "ent_00000000000000000000000000000002";
    const child = "ent_00000000000000000000000000000003";
    const grandchild = "ent_00000000000000000000000000000004";
    const relationship = "rel_00000000000000000000000000000001";
    const maximumExpansionSearchTerm = "\u0800".repeat(255);

    const initialized = await jsonCommand(root, ["init"]);
    expect(initialized).toMatchObject({
      envelope: { command: "init", exitCode: 0, ok: true },
      exitCode: 0,
    });
    expect((initialized.envelope.result.value as { status: string }).status).toBe("initialized");

    const requestFile = path.join(root, "create-domain.json");
    await writeFile(
      requestFile,
      JSON.stringify({
        component: {
          id: domain,
          intent: maximumExpansionSearchTerm,
          name: "Shop",
          type: "domain",
        },
      }),
      "utf8",
    );
    const createdDomain = await jsonCommand(root, [
      "component",
      "create",
      "--input",
      path.basename(requestFile),
    ]);
    expect(createdDomain).toMatchObject({
      envelope: { command: "component create", exitCode: 0, ok: true },
      exitCode: 0,
    });

    await jsonCommand(
      root,
      ["component", "create", "--stdin"],
      JSON.stringify({
        component: {
          id: target,
          intent: maximumExpansionSearchTerm,
          name: "Users",
          type: "domain",
        },
      }),
    );
    const createdChild = await jsonCommand(
      root,
      ["component", "create", "--input", "-"],
      JSON.stringify({
        component: {
          actions: [{ id: "checkout", name: "Checkout" }],
          iconDomain: "shop.example.com",
          id: child,
          intent: "Own carts",
          label: "Shopping cart",
          name: "Cart",
          parent: domain,
          summary: "Owns the active shopping cart.",
          type: "service",
        },
        relationships: [
          { description: "Authenticates through", id: relationship, target, type: "depends-on" },
        ],
      }),
    );
    const childRevision = committedRevision(createdChild.envelope, child);
    const createdGrandchild = await jsonCommand(
      root,
      ["component", "create", "--stdin"],
      JSON.stringify({
        component: { id: grandchild, name: "Line item", parent: child, type: "service" },
      }),
    );
    const grandchildRevision = committedRevision(createdGrandchild.envelope, grandchild);

    const firstPage = await jsonCommand(root, ["component", "list", "--limit", "2"]);
    expect(firstPage.envelope).toMatchObject({
      command: "component list",
      exitCode: 0,
      ok: true,
      result: { ok: true, value: { hasMore: true } },
    });
    const firstValue = firstPage.envelope.result.value as {
      readonly generation: number;
      readonly nextCursor: string;
    };
    const secondPage = await jsonCommand(root, [
      "component",
      "list",
      "--limit",
      "2",
      "--cursor",
      firstValue.nextCursor,
    ]);
    expect(secondPage.envelope.result).toMatchObject({ ok: true, value: { hasMore: false } });

    const rootsPage = await jsonCommand(root, ["component", "roots", "--limit", "10"]);
    expect(
      (
        rootsPage.envelope.result.value as { items: Array<{ component: { id: string } }> }
      ).items.map((item) => item.component.id),
    ).toEqual([domain, target]);
    const children = await jsonCommand(root, ["component", "children", domain, "--limit", "10"]);
    expect(children.envelope.result).toMatchObject({
      ok: true,
      value: { items: [{ component: { id: child, parent: domain } }] },
    });

    const exact = await jsonCommand(root, [
      "component",
      "get",
      child,
      "--relationships-limit",
      "10",
    ]);
    expect(exact.envelope.result).toMatchObject({
      ok: true,
      value: {
        item: {
          component: {
            iconDomain: "shop.example.com",
            id: child,
            label: "Shopping cart",
            name: "Cart",
            parent: domain,
            summary: "Owns the active shopping cart.",
            type: "service",
          },
        },
        relationships: { items: [{ relationship: { id: relationship, target } }] },
      },
    });

    const canonicalBeforeBlueprintReads = await fileTreeSnapshot(path.join(root, "groma"));
    const exportedComponents: Array<{ readonly id: string }> = [];
    const exportedRelationships: Array<{ readonly id: string }> = [];
    let exportCursor: string | undefined;
    let exportGeneration: number | undefined;
    do {
      const page = await jsonCommand(root, [
        "blueprint",
        "export",
        "--limit",
        "2",
        ...(exportCursor === undefined ? [] : ["--cursor", exportCursor]),
      ]);
      expect(page.envelope).toMatchObject({
        command: "blueprint export",
        exitCode: CLI_EXIT.success,
        ok: true,
        result: { ok: true },
      });
      const value = page.envelope.result.value as {
        readonly generation: number;
        readonly hasMore: boolean;
        readonly items: Array<{
          readonly component: { readonly id: string };
          readonly relationships: Array<{ readonly id: string }>;
        }>;
        readonly nextCursor?: string;
      };
      expect(Array.isArray(value.items), page.text).toBeTrue();
      exportGeneration ??= value.generation;
      expect(value.generation).toBe(exportGeneration);
      exportedComponents.push(...value.items.map((item) => item.component));
      exportedRelationships.push(...value.items.flatMap((item) => item.relationships));
      exportCursor = value.nextCursor;
      expect(value.hasMore).toBe(exportCursor !== undefined);
    } while (exportCursor !== undefined);
    expect(exportedComponents.map((item) => item.id)).toEqual([domain, target, child, grandchild]);
    expect(exportedRelationships.map((item) => item.id)).toEqual([relationship]);

    const firstExport = await jsonCommand(root, ["blueprint", "export", "--limit", "2"]);
    const plainExport = captureOutput();
    expect(
      await runProgram(["blueprint", "export", "--limit", "2"], plainExport, {
        terminal: { stdin: false, stdout: false },
        workspaceRoot: root,
      }),
    ).toBe(CLI_EXIT.success);
    const plainExportResult = plainExport.output[0]!.split("\n").find((line) =>
      line.startsWith("result: "),
    );
    expect(JSON.parse(plainExportResult!.slice("result: ".length))).toEqual(
      firstExport.envelope.result,
    );

    const incoming = await jsonCommand(root, [
      "blueprint",
      "traverse",
      target,
      "--direction",
      "incoming",
      "--depth",
      "1",
      "--relation-type",
      "depends-on",
      "--limit",
      "10",
    ]);
    expect(incoming.envelope.result).toMatchObject({
      ok: true,
      value: {
        generation: exportGeneration,
        items: [
          {
            component: { id: child, intent: "Own carts", parent: domain },
            direction: "incoming",
            from: target,
            relationship: { id: relationship, source: child, target },
          },
        ],
      },
    });
    const searched = await jsonCommand(root, [
      "blueprint",
      "search",
      "active shopping cart",
      "--limit",
      "10",
    ]);
    expect(searched.envelope.result).toMatchObject({
      ok: true,
      value: {
        generation: exportGeneration,
        items: [
          {
            actions: [{ id: "checkout", name: "Checkout" }],
            id: child,
            intent: "Own carts",
            parent: domain,
          },
        ],
      },
    });
    const plainSearch = captureOutput();
    expect(
      await runProgram(
        ["blueprint", "search", "active shopping cart", "--limit", "10"],
        plainSearch,
        { terminal: { stdin: false, stdout: false }, workspaceRoot: root },
      ),
    ).toBe(CLI_EXIT.success);
    const plainResultLine = plainSearch.output[0]!.split("\n").find((line) =>
      line.startsWith("result: "),
    );
    expect(plainResultLine).toBeDefined();
    expect(JSON.parse(plainResultLine!.slice("result: ".length))).toEqual(searched.envelope.result);

    const maximumSearch = await jsonCommand(root, [
      "blueprint",
      "search",
      maximumExpansionSearchTerm,
      "--limit",
      "1",
    ]);
    const maximumSearchValue = maximumSearch.envelope.result.value as {
      readonly nextCursor: string;
    };
    expect(maximumSearchValue.nextCursor.length).toBeGreaterThan(2_048);
    expect(maximumSearchValue.nextCursor.length).toBeLessThanOrEqual(4_096);
    expect(
      await jsonCommand(root, [
        "blueprint",
        "search",
        maximumExpansionSearchTerm,
        "--limit",
        "1",
        "--cursor",
        maximumSearchValue.nextCursor,
      ]),
    ).toMatchObject({ envelope: { exitCode: CLI_EXIT.success, ok: true } });
    expect(await fileTreeSnapshot(path.join(root, "groma"))).toEqual(canonicalBeforeBlueprintReads);
    const plainRead = captureOutput();
    expect(
      await runProgram(["component", "get", child, "--relationships-limit", "10"], plainRead, {
        terminal: { stdin: false, stdout: false },
        workspaceRoot: root,
      }),
    ).toBe(0);
    expect(plainRead.errors).toEqual([]);
    expect(plainRead.output).toHaveLength(1);
    expect(plainRead.output[0]).toContain("command: component get\nexit-code: 0\nok: true\n");
    expect(plainRead.output[0]).toContain(`\"id\":\"${child}\"`);
    expect(plainRead.output[0]).toContain('"generation":');
    expect(plainRead.output[0]).toContain('"revision":"sha256:');
    expect(plainRead.output[0]).not.toMatch(/\u001b|\x1b/);

    const labeledOverview = captureOutput();
    expect(
      await runProgram([], labeledOverview, {
        terminal: { stdin: true, stdout: true },
        workspaceRoot: root,
      }),
    ).toBe(0);
    expect(labeledOverview.output[0]).toContain('display="Shopping cart"');
    expect(labeledOverview.output[0]).toContain('name="Cart"');

    const updated = await jsonCommand(
      root,
      ["component", "update", "--stdin"],
      JSON.stringify({
        expectedRevision: childRevision,
        id: child,
        patch: {
          iconDomain: null,
          label: null,
          name: "Shopping cart",
          summary: "Coordinates selected products and checkout readiness.",
          type: "capability",
        },
      }),
    );
    const updatedRevision = committedRevision(updated.envelope, child);
    expect(updated.envelope).toMatchObject({
      exitCode: 0,
      ok: true,
      result: {
        value: {
          id: child,
          name: "Shopping cart",
          summary: "Coordinates selected products and checkout readiness.",
          type: "capability",
        },
      },
    });
    const updatedValue = updated.envelope.result.value as {
      readonly iconDomain?: string;
      readonly label?: string;
    };
    expect(updatedValue.label).toBeUndefined();
    expect(updatedValue.iconDomain).toBeUndefined();

    const reparented = await jsonCommand(root, [
      "component",
      "reparent",
      child,
      "--revision",
      updatedRevision,
      "--parent",
      target,
    ]);
    expect(reparented.envelope).toMatchObject({
      exitCode: 0,
      ok: true,
      result: { value: { id: child, parent: target } },
    });
    expect(await Bun.file(path.join(root, "groma", "aliases.md")).exists()).toBeFalse();
    expect(
      await jsonCommand(root, [
        "blueprint",
        "search",
        maximumExpansionSearchTerm,
        "--limit",
        "1",
        "--cursor",
        maximumSearchValue.nextCursor,
      ]),
    ).toMatchObject({
      envelope: {
        exitCode: CLI_EXIT.semantic,
        ok: false,
        result: { diagnostics: [{ code: "stale-cursor" }], ok: false },
      },
    });

    const stableReadArgs = ["component", "get", child, "--relationships-limit", "10"] as const;
    const firstStableRead = await jsonCommand(root, stableReadArgs);
    const secondStableRead = await jsonCommand(root, stableReadArgs);
    expect(secondStableRead.text).toBe(firstStableRead.text);
    expect(secondStableRead.envelope.result).toMatchObject({
      value: {
        item: {
          component: {
            id: child,
            name: "Shopping cart",
            summary: "Coordinates selected products and checkout readiness.",
          },
        },
      },
    });
    expect(
      (secondStableRead.envelope.result.value as { generation: number }).generation,
    ).toBeGreaterThan(firstValue.generation);

    const terminal = captureOutput();
    expect(
      await runProgram([], terminal, {
        terminal: { stdin: true, stdout: true },
        workspaceRoot: root,
      }),
    ).toBe(0);
    expect(terminal.output).toHaveLength(1);
    expect(terminal.output[0]).toContain('name="Shopping cart"');
    expect(terminal.output[0]).toContain('display="Shopping cart"');
    expect(terminal.output[0]).toContain(`  - id="${child}"`);
    expect(terminal.output[0]).toContain(`    - id="${grandchild}"`);
    expect(terminal.output[0]).not.toMatch(/\u001b|\x1b/);

    const removed = await jsonCommand(root, [
      "component",
      "remove",
      grandchild,
      "--revision",
      grandchildRevision,
    ]);
    expect(removed.envelope).toMatchObject({
      exitCode: 0,
      ok: true,
      result: { value: grandchild },
    });
  });

  test("rejects an export cursor from different content at the same generation", async () => {
    const historyA = await workspace();
    const historyB = await workspace();
    const first = "ent_00000000000000000000000000000011";
    const second = "ent_00000000000000000000000000000012";
    for (const [root, suffix] of [
      [historyA, "A"],
      [historyB, "B"],
    ] as const) {
      await jsonCommand(root, ["init"]);
      await jsonCommand(
        root,
        ["component", "create", "--stdin"],
        JSON.stringify({ component: { id: first, name: `First ${suffix}` } }),
      );
      await jsonCommand(
        root,
        ["component", "create", "--stdin"],
        JSON.stringify({ component: { id: second, name: `Second ${suffix}` } }),
      );
    }
    const fromA = await jsonCommand(historyA, ["blueprint", "export", "--limit", "1"]);
    const aValue = fromA.envelope.result.value as {
      readonly generation: number;
      readonly hasMore: boolean;
      readonly nextCursor: string;
    };
    expect(aValue.hasMore).toBeTrue();
    const bGeneration = (
      (await jsonCommand(historyB, ["component", "list", "--limit", "2"])).envelope.result
        .value as { readonly generation: number }
    ).generation;
    expect(bGeneration).toBe(aValue.generation);
    const before = await fileTreeSnapshot(path.join(historyB, "groma"));

    expect(
      await jsonCommand(historyB, [
        "blueprint",
        "export",
        "--limit",
        "1",
        "--cursor",
        aValue.nextCursor,
      ]),
    ).toMatchObject({
      envelope: {
        exitCode: CLI_EXIT.semantic,
        ok: false,
        result: { diagnostics: [{ code: "cursor-query-mismatch" }], ok: false },
      },
    });
    expect(await fileTreeSnapshot(path.join(historyB, "groma"))).toEqual(before);
  });

  test("merges through the public CLI and resolves the obsolete ID after restart", async () => {
    const root = await workspace();
    const obsolete = "ent_00000000000000000000000000000021";
    const survivor = "ent_00000000000000000000000000000022";
    const target = "ent_00000000000000000000000000000023";
    const relationship = "rel_00000000000000000000000000000021";
    await jsonCommand(root, ["init"]);
    const obsoleteCreate = await jsonCommand(
      root,
      ["component", "create", "--stdin"],
      JSON.stringify({ component: { id: obsolete, name: "Old checkout" } }),
    );
    expect(obsoleteCreate.envelope).toMatchObject({
      command: "component create",
      exitCode: 0,
      ok: true,
    });
    await jsonCommand(
      root,
      ["component", "create", "--stdin"],
      JSON.stringify({ component: { id: target, name: "Payments" } }),
    );
    await jsonCommand(
      root,
      ["component", "create", "--stdin"],
      JSON.stringify({
        component: { id: survivor, name: "Checkout" },
        relationships: [{ id: relationship, target, type: "depends-on" }],
      }),
    );

    const merged = await jsonCommand(root, [
      "component",
      "merge",
      obsolete,
      "--into",
      survivor,
      "--revision",
      committedRevision(obsoleteCreate.envelope, obsolete),
    ]);
    expect(merged.envelope).toMatchObject({
      command: "component merge",
      exitCode: 0,
      ok: true,
      result: { value: { id: survivor, name: "Checkout" } },
    });

    const read = await jsonCommand(root, [
      "component",
      "get",
      obsolete,
      "--relationships-limit",
      "1",
    ]);
    expect(read.envelope).toMatchObject({
      command: "component get",
      exitCode: 0,
      ok: true,
      result: { value: { item: { component: { id: survivor, name: "Checkout" } } } },
    });
    expect(
      await jsonCommand(root, [
        "blueprint",
        "traverse",
        obsolete,
        "--direction",
        "outgoing",
        "--depth",
        "1",
        "--limit",
        "1",
      ]),
    ).toMatchObject({
      envelope: {
        exitCode: CLI_EXIT.success,
        ok: true,
        result: {
          value: {
            items: [
              {
                component: { id: target },
                from: survivor,
                relationship: { id: relationship, source: survivor, target },
              },
            ],
          },
        },
      },
    });
    expect(await readFile(path.join(root, "groma", "aliases.md"), "utf8")).toBe(
      `---\nschema: groma/aliases/v0.1\naliases:\n  - source: ${obsolete}\n    target: ${survivor}\n---\n`,
    );
  });

  test("previews and applies an older canonical document explicitly before public reload", async () => {
    const root = await workspace();
    const id = "ent_00000000000000000000000000000031";
    await jsonCommand(root, ["init"]);
    await jsonCommand(
      root,
      ["component", "create", "--stdin"],
      JSON.stringify({ component: { id, name: "Legacy checkout", type: "service" } }),
    );
    const intentFile = path.join(root, "groma", "intent", "00", `${id}.md`);
    const current = `${(await readFile(intentFile, "utf8")).replace(
      "---\nschema: groma/v0.1",
      '---\nlabel: Legacy checkout\nschema: "groma/v0.1"',
    )}\n# Intent\n\nThe body token schema: groma/v0 is prose and must remain unchanged.\n`;
    const older = current.replace("groma/v0.1", "groma/v0");
    const configurationFile = path.join(root, "groma", "groma.yaml");
    const currentConfiguration = "plugins: []\r\nschema: groma/v0.1\r\npackages: []\r\n";
    const olderConfiguration = "plugins: []\r\nschema: >-\r\n  groma/v0\r\npackages: []\r\n";
    const lockFile = path.join(root, "groma", "packages.lock");
    const currentLock = '{"packages":[],"schema":"groma.packages-lock/v1"}\n';
    const olderLock = currentLock.replace(
      '"schema":"groma.packages-lock/v1"',
      '"schema":"groma.packages-lock/v0"',
    );
    await writeFile(intentFile, older, "utf8");
    await writeFile(configurationFile, olderConfiguration, "utf8");
    await writeFile(lockFile, olderLock, "utf8");

    const ordinaryRead = await jsonCommand(root, ["component", "list", "--limit", "10"]);
    expect(ordinaryRead).toMatchObject({
      envelope: {
        exitCode: CLI_EXIT.workspace,
        ok: false,
        result: { diagnostics: [{ code: "workspace-configuration-conflict" }] },
      },
    });
    expect(await readFile(intentFile, "utf8")).toBe(older);
    expect(await readFile(configurationFile, "utf8")).toBe(olderConfiguration);
    expect(await readFile(lockFile, "utf8")).toBe(olderLock);

    const status = await jsonCommand(root, ["migrate", "status"]);
    expect(status).toMatchObject({
      envelope: {
        command: "migrate status",
        exitCode: 0,
        ok: true,
        result: {
          ok: true,
          value: {
            completePath: true,
            documentVersions: [0],
            mixedVersions: false,
            schemaFloor: 0,
          },
        },
      },
    });
    const preview = await jsonCommand(root, ["migrate", "preview"]);
    expect(preview).toMatchObject({
      envelope: {
        command: "migrate preview",
        exitCode: 0,
        ok: true,
        result: { ok: true },
      },
    });
    expect(await readFile(intentFile, "utf8")).toBe(older);
    expect(await readFile(configurationFile, "utf8")).toBe(olderConfiguration);
    expect(await readFile(lockFile, "utf8")).toBe(olderLock);

    const applied = await jsonCommand(root, ["migrate", "apply"]);
    expect(applied).toMatchObject({
      envelope: { command: "migrate apply", exitCode: 0, ok: true, result: { status: "applied" } },
    });
    expect(await readFile(intentFile, "utf8")).toBe(current);
    expect(await readFile(configurationFile, "utf8")).toBe(currentConfiguration);
    expect(await readFile(lockFile, "utf8")).toBe(currentLock);

    const reloaded = await jsonCommand(root, [
      "component",
      "get",
      id,
      "--relationships-limit",
      "10",
    ]);
    expect(reloaded).toMatchObject({
      envelope: {
        command: "component get",
        exitCode: 0,
        ok: true,
        result: { value: { item: { component: { id, name: "Legacy checkout" } } } },
      },
    });
  });

  test("manages a trust-gated local package end to end without touching project package-manager files", async () => {
    const root = await workspace();
    const userDataRoot = await workspace();
    await jsonCommand(root, ["init"], undefined, { userDataRoot });
    const packageRoot = path.join(root, "plugins", "example");
    await mkdir(path.join(packageRoot, "plugins"), { recursive: true });
    await writeFile(
      path.join(packageRoot, "groma.package.json"),
      `${JSON.stringify({
        apiVersion: "groma.package/v1",
        name: "example-cli",
        plugins: ["./plugins/alpha.js", "./plugins/beta.js"],
        runtimeApiVersion: "groma.plugin/v1",
        sdkApiVersion: "groma.sdk/v1",
        version: "1.0.0",
      })}\n`,
    );
    const moduleSource = (id: string) => `
export const plugin = Object.freeze({
  manifest: Object.freeze({
    apiVersion: "groma.plugin/v1",
    id: ${JSON.stringify(id)},
    phase: 1,
    provides: Object.freeze([]),
    requires: Object.freeze([]),
    version: "1.0.0"
  }),
  start: () => Object.freeze({ capabilities: Object.freeze([]) })
});
`;
    const migrationModuleSource = `
const encoder = new TextEncoder();
const decoder = new TextDecoder();
export const plugin = Object.freeze({
  manifest: Object.freeze({
    apiVersion: "groma.plugin/v1",
    id: "example.alpha",
    phase: 1,
    provides: Object.freeze([{ cardinality: "multiple", id: "groma.schema-migrators/v1", version: "1.0.0" }]),
    requires: Object.freeze([]),
    version: "1.0.0"
  }),
  start: () => Object.freeze({ capabilities: Object.freeze([{
    id: "groma.schema-migrators/v1",
    version: "1.0.0",
    value: Object.freeze({
      apiVersion: "groma.schema-migration/v1",
      id: "example.alpha.schemas",
      migrators: Object.freeze([Object.freeze({
        fromSchema: "example.records/v0",
        fromVersion: 0,
        id: "example.alpha.record-v0-to-v1",
        migrate: (input) => Object.freeze({
          ok: true,
          value: Object.freeze({ bytes: encoder.encode(decoder.decode(input.bytes).replace("example.records/v0", "example.records/v1")) })
        }),
        toSchema: "example.records/v1",
        toVersion: 1
      })]),
      schemas: Object.freeze([
        Object.freeze({ schema: "example.records/v0", version: 0 }),
        Object.freeze({ schema: "example.records/v1", version: 1 })
      ])
    })
  }]) })
});
`;
    await writeFile(path.join(packageRoot, "plugins", "alpha.js"), migrationModuleSource);
    await writeFile(path.join(packageRoot, "plugins", "beta.js"), moduleSource("example.beta"));
    const projectPackage = path.join(root, "package.json");
    const projectLock = path.join(root, "bun.lock");
    await writeFile(projectPackage, '{"private":true}\n');
    await writeFile(projectLock, "project-owned\n");

    expect(
      await jsonCommand(root, ["package", "add", "./plugins/example"], undefined, {
        userDataRoot,
      }),
    ).toMatchObject({
      envelope: { command: "package add", exitCode: 0, ok: true },
      exitCode: 0,
    });
    expect(
      await jsonCommand(
        root,
        ["package", "enable", "example-cli", "./plugins/alpha.js"],
        undefined,
        { userDataRoot },
      ),
    ).toMatchObject({
      envelope: {
        command: "package enable",
        exitCode: CLI_EXIT.semantic,
        ok: false,
        result: { diagnostics: [{ code: "plugin-full-user-permissions-trust-required" }] },
      },
    });
    expect(
      await jsonCommand(
        root,
        ["package", "enable", "example-cli", "./plugins/alpha.js", "--trust-full-user-permissions"],
        undefined,
        { userDataRoot },
      ),
    ).toMatchObject({
      envelope: { command: "package enable", exitCode: 0, ok: true },
    });
    const pluginRecord = path.join(root, "groma", "records", "example.alpha", "record.json");
    await mkdir(path.dirname(pluginRecord), { recursive: true });
    const olderPluginRecord = '{"schema":"example.records/v0","value":1}\n';
    const currentPluginRecord = '{"schema":"example.records/v1","value":1}\n';
    await writeFile(pluginRecord, olderPluginRecord);
    expect(
      await jsonCommand(root, ["migrate", "status"], undefined, { userDataRoot }),
    ).toMatchObject({
      envelope: {
        command: "migrate status",
        exitCode: CLI_EXIT.success,
        ok: true,
        result: { value: { completePath: true, schemaFloor: 0 } },
      },
    });
    expect(
      await jsonCommand(root, ["migrate", "apply"], undefined, { userDataRoot }),
    ).toMatchObject({
      envelope: {
        command: "migrate apply",
        exitCode: CLI_EXIT.success,
        ok: true,
        result: { status: "applied" },
      },
    });
    expect(await readFile(pluginRecord, "utf8")).toBe(currentPluginRecord);
    expect(
      await jsonCommand(root, ["package", "inspect", "example-cli"], undefined, {
        userDataRoot,
      }),
    ).toMatchObject({
      envelope: {
        command: "package inspect",
        exitCode: 0,
        ok: true,
        result: { value: { enabled: ["./plugins/alpha.js"], integrity: "exact" } },
      },
    });
    await writeFile(
      path.join(packageRoot, "plugins", "alpha.js"),
      `${migrationModuleSource}\n// changed after enable\n`,
    );
    expect(
      await jsonCommand(root, ["package", "inspect", "example-cli"], undefined, {
        userDataRoot,
      }),
    ).toMatchObject({
      envelope: {
        exitCode: 0,
        ok: true,
        result: { value: { integrity: "entry-drift" } },
      },
    });
    expect(
      await jsonCommand(root, ["component", "roots", "--limit", "1"], undefined, {
        userDataRoot,
      }),
    ).toMatchObject({
      envelope: {
        exitCode: CLI_EXIT.workspace,
        ok: false,
        result: {
          diagnostics: [{ code: "plugin-package-integrity-drift" }],
          status: "startup-failure",
        },
      },
    });
    expect(
      await jsonCommand(
        root,
        ["package", "disable", "example-cli", "./plugins/alpha.js"],
        undefined,
        { userDataRoot },
      ),
    ).toMatchObject({ envelope: { command: "package disable", exitCode: 0, ok: true } });
    expect(
      await jsonCommand(root, ["package", "remove", "example-cli"], undefined, {
        userDataRoot,
      }),
    ).toMatchObject({ envelope: { command: "package remove", exitCode: 0, ok: true } });
    expect(await readFile(projectPackage, "utf8")).toBe('{"private":true}\n');
    expect(await readFile(projectLock, "utf8")).toBe("project-owned\n");
  });

  testGeneratedPackageWorkflow(async () => {
    if (process.platform === "win32") return;
    const root = await workspace();
    const userDataRoot = await workspace();
    const scaffolded = await jsonCommand(
      root,
      [
        "package",
        "scaffold",
        "./plugins/scaffolded",
        "--name",
        "example-scaffolded",
        "--plugin",
        "example.scaffolded",
        "--provides",
        "example.scaffolded/v1",
        "--provides",
        "example.secondary/v1",
      ],
      undefined,
      { userDataRoot },
    );
    expect(scaffolded).toMatchObject({
      envelope: {
        command: "package scaffold",
        exitCode: CLI_EXIT.success,
        ok: true,
        result: {
          value: {
            destination: "./plugins/scaffolded",
            entry: "./plugins/plugin.ts",
            files: [
              "groma.package.json",
              "package.json",
              "plugins/plugin.ts",
              "tests/conformance.test.ts",
            ],
            name: "example-scaffolded",
            pluginId: "example.scaffolded",
            provides: ["example.scaffolded/v1", "example.secondary/v1"],
          },
        },
      },
      exitCode: CLI_EXIT.success,
    });
    const packageRoot = path.join(root, "plugins", "scaffolded");
    const packageMetadata = await readFile(path.join(packageRoot, "package.json"));
    const sdkInstall = Bun.spawn(
      [process.execPath, "add", "--dev", "--no-save", `groma@file:${process.cwd()}`],
      { cwd: packageRoot, stderr: "pipe", stdout: "pipe" },
    );
    const [sdkInstallExit, sdkInstallOutput, sdkInstallError] = await Promise.all([
      sdkInstall.exited,
      new Response(sdkInstall.stdout).text(),
      new Response(sdkInstall.stderr).text(),
    ]);
    expect(sdkInstallExit, `${sdkInstallOutput}\n${sdkInstallError}`).toBe(CLI_EXIT.success);
    expect(await readFile(path.join(packageRoot, "package.json"))).toEqual(packageMetadata);
    await expect(lstat(path.join(packageRoot, "bun.lock"))).rejects.toThrow();
    const typecheck = Bun.spawn(
      [
        path.join(process.cwd(), "node_modules", ".bin", "tsc"),
        "--noEmit",
        "--strict",
        "--allowImportingTsExtensions",
        "--target",
        "ES2022",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--skipLibCheck",
        path.join(packageRoot, "plugins", "plugin.ts"),
      ],
      { cwd: packageRoot, stderr: "pipe", stdout: "pipe" },
    );
    const [typecheckExit, typecheckOutput, typecheckError] = await Promise.all([
      typecheck.exited,
      new Response(typecheck.stdout).text(),
      new Response(typecheck.stderr).text(),
    ]);
    expect(typecheckExit, `${typecheckOutput}\n${typecheckError}`).toBe(CLI_EXIT.success);
    const conformance = Bun.spawn(
      [process.execPath, "test", path.join(packageRoot, "tests", "conformance.test.ts")],
      { cwd: packageRoot, stderr: "pipe", stdout: "pipe" },
    );
    const [conformanceExit, conformanceOutput, conformanceError] = await Promise.all([
      conformance.exited,
      new Response(conformance.stdout).text(),
      new Response(conformance.stderr).text(),
    ]);
    expect(conformanceExit, `${conformanceOutput}\n${conformanceError}`).toBe(CLI_EXIT.success);
    expect(`${conformanceOutput}\n${conformanceError}`).toContain("1 pass");
    expect(`${conformanceOutput}\n${conformanceError}`).toContain("0 fail");

    await jsonCommand(root, ["init"], undefined, { userDataRoot });
    expect(
      await jsonCommand(root, ["package", "add", "./plugins/scaffolded"], undefined, {
        userDataRoot,
      }),
    ).toMatchObject({
      envelope: { command: "package add", exitCode: CLI_EXIT.success, ok: true },
    });
    expect(
      await jsonCommand(
        root,
        [
          "package",
          "enable",
          "example-scaffolded",
          "./plugins/plugin.ts",
          "--trust-full-user-permissions",
        ],
        undefined,
        { userDataRoot },
      ),
    ).toMatchObject({
      envelope: { command: "package enable", exitCode: CLI_EXIT.success, ok: true },
    });
    expect(
      await jsonCommand(root, ["component", "roots", "--limit", "1"], undefined, {
        userDataRoot,
      }),
    ).toMatchObject({
      envelope: { command: "component roots", exitCode: CLI_EXIT.success, ok: true },
    });
  });

  test("returns the indeterminate exit class when a package-state commit cannot be acknowledged", async () => {
    const root = await workspace();
    const userDataRoot = await workspace();
    await jsonCommand(root, ["init"], undefined, { userDataRoot });
    const packageRoot = path.join(root, "plugins", "indeterminate");
    await mkdir(path.join(packageRoot, "plugins"), { recursive: true });
    await writeFile(
      path.join(packageRoot, "groma.package.json"),
      `${JSON.stringify({
        apiVersion: "groma.package/v1",
        name: "example-indeterminate",
        plugins: ["./plugins/entry.js"],
        runtimeApiVersion: "groma.plugin/v1",
        sdkApiVersion: "groma.sdk/v1",
        version: "1.0.0",
      })}\n`,
    );
    await writeFile(path.join(packageRoot, "plugins", "entry.js"), "export const plugin = {};\n");
    const captured = captureOutput();

    const exitCode = await runProgram(
      ["--format", "json", "package", "add", "./plugins/indeterminate"],
      captured,
      {
        createRegistry: (surface) =>
          createDefaultBootstrapRegistry({
            resourceFaultInjector: (phase) => {
              if (phase === "after-rename") throw new Error("private acknowledgement failure");
            },
            surface,
            userDataRoot,
          }),
        terminal: { stdin: false, stdout: false },
        userDataRoot,
        workspaceRoot: root,
      },
    );

    expect(exitCode, captured.output[0]).toBe(CLI_EXIT.indeterminate);
    expect(captured.errors).toEqual([]);
    expect(captured.output).toHaveLength(1);
    expect(JSON.parse(captured.output[0]!) as JsonEnvelope).toMatchObject({
      command: "package add",
      exitCode: CLI_EXIT.indeterminate,
      ok: false,
      result: {
        diagnostics: [
          {
            code: "plugin-package-state-indeterminate",
            message:
              "Blueprint plugin package state may have committed; review groma/groma.yaml and groma/packages.lock before retrying, and reconcile a mismatch with package disable or remove",
          },
        ],
        ok: false,
      },
    });
    expect(captured.output[0]).not.toContain("private acknowledgement failure");
  });

  test("returns exit 6 when configuration publication fails after the package lock commits", async () => {
    const root = await workspace();
    const userDataRoot = await workspace();
    await jsonCommand(root, ["init"], undefined, { userDataRoot });
    const packageRoot = path.join(root, "plugins", "partial-publication");
    await mkdir(path.join(packageRoot, "plugins"), { recursive: true });
    await writeFile(
      path.join(packageRoot, "groma.package.json"),
      `${JSON.stringify({
        apiVersion: "groma.package/v1",
        name: "example-partial-publication",
        plugins: ["./plugins/entry.js"],
        runtimeApiVersion: "groma.plugin/v1",
        sdkApiVersion: "groma.sdk/v1",
        version: "1.0.0",
      })}\n`,
    );
    await writeFile(
      path.join(packageRoot, "plugins", "entry.js"),
      `export const plugin = Object.freeze({
  manifest: Object.freeze({
    apiVersion: "groma.plugin/v1",
    id: "example.partial-publication",
    phase: 1,
    provides: Object.freeze([]),
    requires: Object.freeze([]),
    version: "1.0.0"
  }),
  start: () => Object.freeze({ capabilities: Object.freeze([]) })
});\n`,
    );
    expect(
      await jsonCommand(root, ["package", "add", "./plugins/partial-publication"], undefined, {
        userDataRoot,
      }),
    ).toMatchObject({ exitCode: CLI_EXIT.success });
    const configurationFile = path.join(root, "groma", "groma.yaml");
    const lockFile = path.join(root, "groma", "packages.lock");
    const configurationBefore = await readFile(configurationFile);
    const lockBefore = await readFile(lockFile);
    const captured = captureOutput();
    let configurationReplacementFailed = false;
    const exitCode = await runProgram(
      [
        "--format",
        "json",
        "package",
        "enable",
        "example-partial-publication",
        "./plugins/entry.js",
        "--trust-full-user-permissions",
      ],
      captured,
      {
        createRegistry: (surface) =>
          createDefaultBootstrapRegistry({
            resourceFaultInjector: (phase, fault) => {
              if (phase === "rename" && fault?.locator === "groma/groma.yaml") {
                configurationReplacementFailed = true;
                throw new Error("private configuration replacement failure");
              }
              if (phase === "coordination-release" && configurationReplacementFailed) {
                throw new Error("private coordination release failure");
              }
            },
            surface,
            userDataRoot,
          }),
        terminal: { stdin: false, stdout: false },
        userDataRoot,
        workspaceRoot: root,
      },
    );

    expect(exitCode, captured.output[0]).toBe(CLI_EXIT.indeterminate);
    expect(captured.errors).toEqual([]);
    expect(JSON.parse(captured.output[0]!) as JsonEnvelope).toMatchObject({
      command: "package enable",
      exitCode: CLI_EXIT.indeterminate,
      ok: false,
      result: {
        diagnostics: [
          {
            code: "plugin-package-state-indeterminate",
            message:
              "Blueprint plugin package state may have committed; review groma/groma.yaml and groma/packages.lock before retrying, and reconcile a mismatch with package disable or remove",
          },
        ],
        ok: false,
      },
    });
    expect(captured.output[0]).not.toContain("private");
    expect(await readFile(configurationFile)).toEqual(configurationBefore);
    expect(await readFile(lockFile)).not.toEqual(lockBefore);
    expect(await readFile(lockFile, "utf8")).toContain("example.partial-publication");
  });

  test("uses stable invocation, workspace, semantic, and signal exit classes", async () => {
    const root = await workspace();
    const invalid = await jsonCommand(root, ["component", "list"]);
    expect(invalid).toMatchObject({
      envelope: { exitCode: CLI_EXIT.usage, ok: false },
      exitCode: CLI_EXIT.usage,
    });

    const unavailable = await jsonCommand(root, ["component", "roots", "--limit", "1"]);
    expect(unavailable).toMatchObject({
      envelope: { exitCode: CLI_EXIT.workspace, ok: false },
      exitCode: CLI_EXIT.workspace,
    });

    await jsonCommand(root, ["init"]);
    const id = "ent_00000000000000000000000000000005";
    await jsonCommand(
      root,
      ["component", "create", "--stdin"],
      JSON.stringify({ component: { id, name: "API" } }),
    );
    const conflict = await jsonCommand(root, [
      "component",
      "remove",
      id,
      "--revision",
      "stale-revision",
    ]);
    expect(conflict).toMatchObject({
      envelope: { exitCode: CLI_EXIT.semantic, ok: false },
      exitCode: CLI_EXIT.semantic,
    });

    const cancelledOutput = captureOutput();
    const cancelled = await runProgram(["--format", "json", "init"], cancelledOutput, {
      signalSource: {
        subscribe: (listener) => {
          listener("SIGTERM");
          return () => {};
        },
      },
      workspaceRoot: root,
    });
    expect(cancelled).toBe(143);
    expect(JSON.parse(cancelledOutput.output[0]!) as JsonEnvelope).toMatchObject({
      exitCode: 143,
      ok: false,
      result: { signal: "SIGTERM", status: "cancelled" },
    });
  });

  test("shows help for bare non-interactive use after initialization", async () => {
    const root = await workspace();
    await jsonCommand(root, ["init"]);
    const captured = captureOutput();

    expect(
      await runProgram([], captured, {
        terminal: { stdin: false, stdout: false },
        workspaceRoot: root,
      }),
    ).toBe(0);
    expect(captured.output).toEqual([HELP_TEXT]);
  });

  test("renders a bounded plain diagnostic for a conflicting bare workspace", async () => {
    const root = await workspace();
    await mkdir(path.join(root, "groma"));
    await writeFile(path.join(root, "groma", "groma.yaml"), "schema: incompatible\n", "utf8");
    const captured = captureOutput();

    expect(
      await runProgram([], captured, {
        terminal: { stdin: true, stdout: true },
        workspaceRoot: root,
      }),
    ).toBe(CLI_EXIT.workspace);
    expect(captured.errors).toEqual([]);
    expect(captured.output).toHaveLength(1);
    expect(captured.output[0]).toContain("command: overview\nexit-code: 3\nok: false\n");
    expect(captured.output[0]).toContain("workspace-configuration-conflict");
    expect(captured.output[0]).not.toContain(root);
  });

  test("classifies transient bootstrap and package-state reads and cleans once", async () => {
    for (const failureRead of [2, 3, 4, 5] as const) {
      const root = await workspace();
      await Bun.write(
        path.join(root, "groma", "groma.yaml"),
        "schema: groma/v0.1\nplugins:\n  - official.alpha\n",
      );
      const events: string[] = [];
      let reads = 0;
      const probe = {
        manifest: {
          apiVersion: "groma.plugin/v1" as const,
          id: `official.bootstrap-fault-probe-${failureRead}`,
          phase: 0 as const,
          provides: [],
          requires: [],
          version: "1.0.0",
        },
        start: () => {
          events.push("phase-zero:start");
          return {
            capabilities: [],
            stop: () => {
              events.push("phase-zero:stop");
            },
          };
        },
      };
      const optional = {
        manifest: {
          apiVersion: "groma.plugin/v1" as const,
          id: "official.alpha",
          phase: 1 as const,
          provides: [],
          requires: [],
          version: "1.0.0",
        },
        start: () => {
          events.push("optional:start");
          return {
            capabilities: [],
            stop: () => {
              events.push("optional:stop");
            },
          };
        },
      };
      const captured = captureOutput();
      const exitCode = await runProgram(
        ["--format", "json", "component", "roots", "--limit", "1"],
        captured,
        {
          createRegistry: (surface) =>
            createDefaultBootstrapRegistry({
              additionalBootstrapPlugins: [probe],
              additionalRuntimePlugins: [optional],
              resourceFaultInjector: (phase) => {
                if (phase !== "read") return;
                reads += 1;
                if (reads === failureRead) throw new Error("transient read failure");
              },
              surface,
            }),
          terminal: { stdin: false, stdout: false },
          workspaceRoot: root,
        },
      );

      const expectedExit = failureRead === 3 ? CLI_EXIT.workspace : CLI_EXIT.infrastructure;
      expect(exitCode, String(failureRead)).toBe(expectedExit);
      expect(captured.errors, String(failureRead)).toEqual([]);
      expect(captured.output, String(failureRead)).toHaveLength(1);
      const envelope = JSON.parse(captured.output[0]!) as JsonEnvelope;
      expect(envelope, String(failureRead)).toMatchObject({
        exitCode: expectedExit,
        ok: false,
        result: {
          diagnostics: [
            {
              code:
                failureRead === 3
                  ? "plugin-package-lock-unavailable"
                  : failureRead === 4
                    ? "workspace-discovery-failed"
                    : "workspace-configuration-provider-failure",
              message:
                failureRead === 3
                  ? "The exact plugin package lock is unavailable"
                  : failureRead === 4
                    ? "Workspace configuration discovery failed"
                    : "Workspace configuration access failed",
            },
          ],
          status: "startup-failure",
        },
      });
      expect(captured.output[0], String(failureRead)).not.toContain(
        "workspace-configuration-changed",
      );
      expect(reads, String(failureRead)).toBe(failureRead);
      expect(
        events.filter((event) => event === "phase-zero:start"),
        String(failureRead),
      ).toHaveLength(1);
      expect(
        events.filter((event) => event === "phase-zero:stop"),
        String(failureRead),
      ).toHaveLength(1);
      expect(
        events.filter((event) => event === "optional:start"),
        String(failureRead),
      ).toHaveLength(failureRead === 5 ? 1 : 0);
      expect(
        events.filter((event) => event === "optional:stop"),
        String(failureRead),
      ).toHaveLength(failureRead === 5 ? 1 : 0);
    }
  });

  test("separates unsupported project requests from invalid Host registrations", async () => {
    const userRoot = await workspace();
    await Bun.write(
      path.join(userRoot, "groma", "groma.yaml"),
      "schema: groma/v0.1\nplugins:\n  - acme.project\n",
    );
    const userOutput = captureOutput();
    const userExit = await runProgram(
      ["--format", "json", "component", "roots", "--limit", "1"],
      userOutput,
      {
        terminal: { stdin: false, stdout: false },
        workspaceRoot: userRoot,
      },
    );
    expect(userExit).toBe(CLI_EXIT.workspace);
    expect(JSON.parse(userOutput.output[0]!) as JsonEnvelope).toMatchObject({
      exitCode: CLI_EXIT.workspace,
      result: {
        diagnostics: [
          {
            code: "project-plugin-validation-required",
            message:
              "Project-provided plugins are unsupported in this release pending package and trust validation",
          },
        ],
      },
    });

    const embedderRoot = await workspace();
    const embedderOutput = captureOutput();
    const embedderExit = await runProgram(
      ["--format", "json", "component", "roots", "--limit", "1"],
      embedderOutput,
      {
        createRegistry: (surface) =>
          createDefaultBootstrapRegistry({
            additionalRuntimePlugins: [
              {
                manifest: {
                  apiVersion: "groma.plugin/v1",
                  id: "acme.host-registration",
                  phase: 1,
                  provides: [],
                  requires: [],
                  version: "1.0.0",
                },
                start: () => ({ capabilities: [] }),
              },
            ],
            surface,
          }),
        terminal: { stdin: false, stdout: false },
        workspaceRoot: embedderRoot,
      },
    );
    expect(embedderExit).toBe(CLI_EXIT.infrastructure);
    expect(JSON.parse(embedderOutput.output[0]!) as JsonEnvelope).toMatchObject({
      exitCode: CLI_EXIT.infrastructure,
      result: {
        diagnostics: [
          {
            code: "host-runtime-registration-invalid",
            message: "Host runtime registrations must use the official namespace",
          },
        ],
      },
    });
  });

  test("classifies user-actionable local package bootstrap failures as workspace exits", async () => {
    for (const [code, message] of [
      ["invalid-local-plugin-package-source", "Local plugin package source is malformed"],
      [
        "plugin-package-enabled-limit-exceeded",
        "Enabled local plugins exceed this Host's runtime capacity",
      ],
      [
        "plugin-package-lock-changed",
        "Blueprint plugin package state changed during startup; restart after changes settle",
      ],
      ["plugin-package-plugin-id-conflict", "Enabled local plugins must use distinct plugin IDs"],
      [
        "plugin-package-user-state-changed",
        "Local plugin package state changed during startup; restart after changes settle",
      ],
      ["plugin-package-user-state-unavailable", "Local plugin package state is unavailable"],
      [
        "personal-plugin-capability-forbidden",
        "Personal plugins may provide or require only groma.presentation.* capabilities",
      ],
    ] as const) {
      const root = await workspace();
      const captured = captureOutput();
      const exitCode = await runProgram(
        ["--format", "json", "component", "roots", "--limit", "1"],
        captured,
        {
          createRegistry: () => ({
            compose: async () =>
              Object.freeze({
                diagnostics: Object.freeze([Object.freeze({ code, message: `/private/${code}` })]),
                ok: false as const,
              }),
          }),
          terminal: { stdin: false, stdout: false },
          workspaceRoot: root,
        },
      );

      expect(exitCode, code).toBe(CLI_EXIT.workspace);
      expect(captured.errors, code).toEqual([]);
      expect(JSON.parse(captured.output[0]!) as JsonEnvelope, code).toMatchObject({
        exitCode: CLI_EXIT.workspace,
        ok: false,
        result: {
          diagnostics: [{ code, message }],
          status: "startup-failure",
        },
      });
      expect(captured.output[0], code).not.toContain("/private/");
    }
  });

  test("gives infrastructure precedence for mixed bootstrap diagnostics", async () => {
    for (const [infrastructureCode, infrastructureMessage] of [
      [
        "host-runtime-registration-invalid",
        "Host runtime registrations must use the official namespace",
      ],
      [
        "unsupported-bootstrap-target",
        "Workspace bootstrap does not support this runtime platform or architecture",
      ],
      ["workspace-configuration-parser-failed", "Workspace configuration parsing failed"],
      ["workspace-configuration-provider-failure", "Workspace configuration access failed"],
      ["workspace-discovery-failed", "Workspace configuration discovery failed"],
    ] as const) {
      const root = await workspace();
      const captured = captureOutput();
      const exitCode = await runProgram(
        ["--format", "json", "component", "roots", "--limit", "1"],
        captured,
        {
          createRegistry: () => ({
            compose: async () =>
              Object.freeze({
                diagnostics: Object.freeze([
                  Object.freeze({
                    code: infrastructureCode,
                    message: `/private/${infrastructureCode}`,
                  }),
                  Object.freeze({
                    code: "plugin-package-lock-unavailable",
                    message: "/private/lock",
                  }),
                ]),
                ok: false as const,
              }),
          }),
          terminal: { stdin: false, stdout: false },
          workspaceRoot: root,
        },
      );
      const packageDiagnostic = {
        code: "plugin-package-lock-unavailable",
        message: "The exact plugin package lock is unavailable",
      };
      const infrastructureDiagnostic = {
        code: infrastructureCode,
        message: infrastructureMessage,
      };

      expect(exitCode, infrastructureCode).toBe(CLI_EXIT.infrastructure);
      expect(captured.errors, infrastructureCode).toEqual([]);
      expect(JSON.parse(captured.output[0]!) as JsonEnvelope, infrastructureCode).toMatchObject({
        exitCode: CLI_EXIT.infrastructure,
        ok: false,
        result: {
          diagnostics:
            infrastructureCode < packageDiagnostic.code
              ? [infrastructureDiagnostic, packageDiagnostic]
              : [packageDiagnostic, infrastructureDiagnostic],
          status: "startup-failure",
        },
      });
      expect(captured.output[0], infrastructureCode).not.toContain("/private/");
    }
  });

  test("keeps unsupported runtime targets in the infrastructure exit class", async () => {
    const root = await workspace();
    const captured = captureOutput();
    const createRegistry: NonNullable<ProgramOptions["createRegistry"]> = (surface) =>
      createDefaultBootstrapRegistry({
        surface,
        target: { architecture: "x64", platform: "freebsd" as never },
      });

    const exitCode = await runProgram(
      ["--format", "json", "component", "roots", "--limit", "1"],
      captured,
      {
        createRegistry,
        terminal: { stdin: false, stdout: false },
        workspaceRoot: root,
      },
    );

    expect(exitCode).toBe(CLI_EXIT.infrastructure);
    expect(JSON.parse(captured.output[0]!) as JsonEnvelope).toMatchObject({
      exitCode: CLI_EXIT.infrastructure,
      result: {
        diagnostics: [
          {
            code: "unsupported-bootstrap-target",
            message: "Workspace bootstrap does not support this runtime platform or architecture",
          },
        ],
      },
    });
  });

  test("rejects invalid UTF-8 file input without leaking the path", async () => {
    const root = await workspace();
    await jsonCommand(root, ["init"]);
    const file = path.join(root, "private-request.json");
    await writeFile(file, Uint8Array.of(0xc3, 0x28));
    const result = await jsonCommand(root, ["component", "create", "--input", path.basename(file)]);

    expect(result.exitCode).toBe(CLI_EXIT.usage);
    expect(result.text).toContain("cli-input-unavailable");
    expect(result.text).not.toContain(file);
  });

  test("stops reading a file as soon as its streamed bytes exceed the input bound", async () => {
    const root = await workspace();
    await jsonCommand(root, ["init"]);
    const file = path.join(root, "oversized-request.json");
    await writeFile(file, new Uint8Array(2 * 1_048_576));

    const result = await jsonCommand(root, ["component", "create", "--input", path.basename(file)]);

    expect(result.exitCode).toBe(CLI_EXIT.usage);
    expect(result.text).toContain("cli-input-unavailable");
  });

  test("SIGTERM cancels a pending stdin stream without waiting for the pipe to close", async () => {
    const root = await workspace();
    await jsonCommand(root, ["init"]);
    const child = Bun.spawn({
      cmd: [
        process.execPath,
        path.resolve(import.meta.dir, "../main.ts"),
        "--format",
        "json",
        "component",
        "create",
        "--stdin",
      ],
      cwd: root,
      stderr: "pipe",
      stdin: "pipe",
      stdout: "pipe",
    });
    try {
      await Bun.sleep(250);
      child.kill("SIGTERM");
      expect(await within(child.exited, 2_000, "pending CLI stdin cancellation")).toBe(143);
      const stdout = await new Response(child.stdout).text();
      expect(JSON.parse(stdout) as JsonEnvelope).toMatchObject({
        exitCode: 143,
        ok: false,
        result: { signal: "SIGTERM", status: "cancelled" },
      });
    } finally {
      child.stdin.end();
      if (child.exitCode === null) {
        child.kill(9);
        await Promise.race([child.exited, Bun.sleep(2_000)]);
      }
    }
  });
});
