import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { CLI_EXIT, type CliInputSource } from "../contracts.ts";
import { GROMA_VERSION, HELP_TEXT, runProgram, type ProgramOutput } from "../program.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function workspace(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "groma-cli-"));
  roots.push(root);
  return root;
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

  test("executes the complete one-shot component workflow across host restarts", async () => {
    const root = await workspace();
    const domain = "ent_00000000000000000000000000000001";
    const target = "ent_00000000000000000000000000000002";
    const child = "ent_00000000000000000000000000000003";
    const grandchild = "ent_00000000000000000000000000000004";
    const relationship = "rel_00000000000000000000000000000001";

    const initialized = await jsonCommand(root, ["init"]);
    expect(initialized).toMatchObject({
      envelope: { command: "init", exitCode: 0, ok: true },
      exitCode: 0,
    });
    expect((initialized.envelope.result.value as { status: string }).status).toBe("initialized");

    const requestFile = path.join(root, "create-domain.json");
    await writeFile(
      requestFile,
      JSON.stringify({ component: { id: domain, name: "Shop", type: "domain" } }),
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
      JSON.stringify({ component: { id: target, name: "Users", type: "domain" } }),
    );
    const createdChild = await jsonCommand(
      root,
      ["component", "create", "--input", "-"],
      JSON.stringify({
        component: {
          actions: [{ id: "checkout", name: "Checkout" }],
          id: child,
          intent: "Own carts",
          name: "Cart",
          parent: domain,
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
        item: { component: { id: child, name: "Cart", parent: domain, type: "service" } },
        relationships: { items: [{ relationship: { id: relationship, target } }] },
      },
    });
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

    const updated = await jsonCommand(
      root,
      ["component", "update", "--stdin"],
      JSON.stringify({
        expectedRevision: childRevision,
        id: child,
        patch: { name: "Shopping cart", type: "capability" },
      }),
    );
    const updatedRevision = committedRevision(updated.envelope, child);
    expect(updated.envelope).toMatchObject({
      exitCode: 0,
      ok: true,
      result: { value: { id: child, name: "Shopping cart", type: "capability" } },
    });

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

    const firstStableRead = await jsonCommand(root, ["component", "roots", "--limit", "10"]);
    const secondStableRead = await jsonCommand(root, ["component", "roots", "--limit", "10"]);
    expect(secondStableRead.text).toBe(firstStableRead.text);
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
