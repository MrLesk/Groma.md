import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileStandalone } from "../../scripts/standalone-compiler.ts";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const defaultExecutable = path.join(
  projectRoot,
  "dist",
  process.platform === "win32" ? "groma.exe" : "groma",
);
const transactionStateLocator = "groma/transaction-state.json";

const ids = Object.freeze({
  shop: "ent_00000000000000000000000000000001",
  users: "ent_00000000000000000000000000000002",
  orders: "ent_00000000000000000000000000000003",
  orderItem: "ent_00000000000000000000000000000004",
  payment: "ent_00000000000000000000000000000005",
  authentication: "ent_00000000000000000000000000000006",
  login: "ent_00000000000000000000000000000007",
  googleLogin: "ent_00000000000000000000000000000008",
  invalid: "ent_00000000000000000000000000000009",
  recovery: "ent_0000000000000000000000000000000a",
});
const relationshipId = "rel_00000000000000000000000000000001";

interface VerificationOptions {
  readonly executable: string;
  readonly skipCrash: boolean;
}

interface JsonEnvelope {
  readonly command: string;
  readonly exitCode: number;
  readonly ok: boolean;
  readonly result: unknown;
}

interface ProcessResult {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

interface JsonResult extends ProcessResult {
  readonly envelope: JsonEnvelope;
}

interface SnapshotEntry {
  readonly bytes: string;
  readonly path: string;
}

function parseOptions(args: readonly string[]): VerificationOptions {
  let executable = defaultExecutable;
  let skipCrash = false;
  for (const argument of args) {
    if (argument === "--skip-crash") {
      skipCrash = true;
    } else if (argument.startsWith("--executable=")) {
      executable = path.resolve(projectRoot, argument.slice("--executable=".length));
    } else {
      throw new Error(
        "Usage: bun run tests/iteration-1a/verify.ts [--executable=<path>] [--skip-crash]",
      );
    }
  }
  return { executable, skipCrash };
}

async function runProcess(
  executable: string,
  workspaceRoot: string,
  args: readonly string[],
  input?: string,
  environment: Readonly<Record<string, string>> = {},
): Promise<ProcessResult> {
  const child = Bun.spawn({
    cmd: [executable, ...args],
    cwd: workspaceRoot,
    env: { ...process.env, ...environment },
    stderr: "pipe",
    stdin: input === undefined ? "ignore" : "pipe",
    stdout: "pipe",
  });
  if (input !== undefined) {
    const stdin = child.stdin;
    if (stdin === undefined) throw new Error("compiled process stdin was unavailable");
    stdin.write(input);
    stdin.end();
  }
  const stdout = new Response(child.stdout).text();
  const stderr = new Response(child.stderr).text();
  const timeout = setTimeout(() => child.kill(), 15_000);
  try {
    const [exitCode, capturedStdout, capturedStderr] = await Promise.all([
      child.exited,
      stdout,
      stderr,
    ]);
    return { exitCode, stderr: capturedStderr, stdout: capturedStdout };
  } finally {
    clearTimeout(timeout);
  }
}

async function runJson(
  executable: string,
  workspaceRoot: string,
  args: readonly string[],
  input?: string,
): Promise<JsonResult> {
  const result = await runProcess(executable, workspaceRoot, ["--format", "json", ...args], input);
  assert.equal(result.stderr, "", `unexpected stderr for ${args.join(" ")}`);
  assert.ok(result.stdout.endsWith("\n"), `missing output framing for ${args.join(" ")}`);
  assert.equal(
    result.stdout.slice(0, -1).includes("\n"),
    false,
    `command streamed more than one JSON document for ${args.join(" ")}`,
  );
  const envelope = JSON.parse(result.stdout) as JsonEnvelope;
  assert.equal(envelope.exitCode, result.exitCode, `exit mismatch for ${args.join(" ")}`);
  return { ...result, envelope };
}

async function success(
  executable: string,
  workspaceRoot: string,
  args: readonly string[],
  input?: string,
): Promise<JsonResult> {
  const result = await runJson(executable, workspaceRoot, args, input);
  assert.equal(result.exitCode, 0, result.stdout);
  assert.equal(result.envelope.ok, true, result.stdout);
  return result;
}

function diagnosticsContain(envelope: JsonEnvelope, code: string): boolean {
  return JSON.stringify(envelope.result).includes(`"code":"${code}"`);
}

async function failure(
  executable: string,
  workspaceRoot: string,
  args: readonly string[],
  exitCode: number,
  diagnosticCode?: string,
  input?: string,
): Promise<JsonResult> {
  const result = await runJson(executable, workspaceRoot, args, input);
  assert.equal(result.exitCode, exitCode, result.stdout);
  assert.equal(result.envelope.ok, false, result.stdout);
  if (diagnosticCode !== undefined) {
    assert.equal(diagnosticsContain(result.envelope, diagnosticCode), true, result.stdout);
  }
  return result;
}

function resultRecord(result: JsonResult): Record<string, unknown> {
  assert.equal(typeof result.envelope.result, "object");
  assert.notEqual(result.envelope.result, null);
  return result.envelope.result as Record<string, unknown>;
}

function valueRecord(result: JsonResult): Record<string, unknown> {
  const value = resultRecord(result).value;
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  return value as Record<string, unknown>;
}

function mutationRevision(result: JsonResult, componentId: string): string {
  const revisions = resultRecord(result).revisions;
  assert.ok(Array.isArray(revisions));
  const match = revisions.find(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      (entry as { componentId?: unknown }).componentId === componentId,
  ) as { revision?: unknown } | undefined;
  const revision = match?.revision;
  assert(typeof revision === "string", result.stdout);
  return revision;
}

function componentIds(result: JsonResult): string[] {
  const items = valueRecord(result).items;
  assert.ok(Array.isArray(items));
  return items.map((item) => {
    assert.equal(typeof item, "object");
    assert.notEqual(item, null);
    const component = (item as { component?: unknown }).component;
    assert.equal(typeof component, "object");
    assert.notEqual(component, null);
    const id = (component as { id?: unknown }).id;
    assert(typeof id === "string");
    return id;
  });
}

async function component(
  executable: string,
  workspaceRoot: string,
  id: string,
): Promise<{ readonly component: Record<string, unknown>; readonly revision: string }> {
  const result = await success(executable, workspaceRoot, [
    "component",
    "get",
    id,
    "--relationships-limit",
    "100",
  ]);
  const item = valueRecord(result).item as Record<string, unknown>;
  assert.equal(typeof item, "object");
  assert.notEqual(item, null);
  const revision = item.revision;
  assert(typeof revision === "string");
  assert.equal(typeof item.component, "object");
  assert.notEqual(item.component, null);
  return { component: item.component as Record<string, unknown>, revision };
}

async function createComponent(
  executable: string,
  workspaceRoot: string,
  request: Readonly<Record<string, unknown>>,
): Promise<JsonResult> {
  return success(
    executable,
    workspaceRoot,
    ["component", "create", "--stdin"],
    JSON.stringify(request),
  );
}

async function snapshot(directory: string): Promise<readonly SnapshotEntry[]> {
  try {
    await access(directory);
  } catch {
    return [];
  }
  const entries: SnapshotEntry[] = [];
  const visit = async (current: string): Promise<void> => {
    const children = await readdir(current, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      const absolute = path.join(current, child.name);
      if (child.isDirectory()) {
        await visit(absolute);
      } else if (child.isFile()) {
        entries.push({
          bytes: Buffer.from(await readFile(absolute)).toString("base64"),
          path: path.relative(directory, absolute).split(path.sep).join("/"),
        });
      }
    }
  };
  await visit(directory);
  return entries;
}

const gromaSnapshot = (workspaceRoot: string) => snapshot(path.join(workspaceRoot, "groma"));
const intentSnapshot = (workspaceRoot: string) =>
  snapshot(path.join(workspaceRoot, "groma", "intent"));

async function expectFailureWithoutChanges(
  executable: string,
  workspaceRoot: string,
  args: readonly string[],
  exitCode: number,
  diagnosticCode: string,
  input?: string,
): Promise<void> {
  const before = await gromaSnapshot(workspaceRoot);
  await failure(executable, workspaceRoot, args, exitCode, diagnosticCode, input);
  assert.deepEqual(await gromaSnapshot(workspaceRoot), before);
}

async function verifyTerminal(executable: string, workspaceRoot: string): Promise<void> {
  if (process.platform === "win32") return;
  const command =
    process.platform === "darwin"
      ? ["script", "-q", "/dev/null", executable]
      : ["script", "-q", "-e", "-c", executable, "/dev/null"];
  const result = await runProcess(command[0]!, workspaceRoot, command.slice(1));
  assert.equal(result.exitCode, 0, result.stderr);
  const output = result.stdout.replaceAll("\r", "");
  assert.ok(output.length < 1_048_576);
  assert.equal(output.includes("\u001b"), false);
  assert.ok(output.includes(`  - id="${ids.orders}"`), output);
  assert.ok(output.includes(`    - id="${ids.orderItem}"`), output);
}

async function verifyWorkflow(executable: string, workspaceRoot: string): Promise<void> {
  const missingBare = await runProcess(executable, workspaceRoot, []);
  assert.equal(missingBare.exitCode, 0);
  assert.equal(missingBare.stderr, "");
  assert.equal(missingBare.stdout, "No Groma workspace is initialized here.\nRun: groma init\n");
  assert.deepEqual(await gromaSnapshot(workspaceRoot), []);
  await failure(
    executable,
    workspaceRoot,
    ["component", "roots", "--limit", "10"],
    3,
    "no-workspace",
  );
  assert.deepEqual(await gromaSnapshot(workspaceRoot), []);

  await success(executable, workspaceRoot, ["init"]);
  await createComponent(executable, workspaceRoot, {
    component: { id: ids.users, name: "Users", type: "domain" },
  });
  await createComponent(executable, workspaceRoot, {
    component: {
      id: ids.authentication,
      name: "Authentication",
      parent: ids.users,
      type: "service",
    },
  });
  await createComponent(executable, workspaceRoot, {
    component: { id: ids.login, name: "Login", parent: ids.authentication, type: "service" },
  });
  await createComponent(executable, workspaceRoot, {
    component: {
      id: ids.googleLogin,
      name: "GoogleLogin",
      parent: ids.login,
      type: "adapter",
    },
  });
  await createComponent(executable, workspaceRoot, {
    component: { id: ids.shop, name: "Shop", type: "domain" },
  });
  const orders = await createComponent(executable, workspaceRoot, {
    component: {
      "example.groma.dev/owner": "architecture",
      actions: [
        { description: "Place an order", id: "act_place", name: "Place order" },
        { id: "act_cancel", name: "Cancel order" },
      ],
      desired: "present",
      id: ids.orders,
      inputs: [
        { id: "inp_order", name: "Order request" },
        { id: "inp_cancel", name: "Cancel request" },
      ],
      intent: "Own the durable ordering lifecycle.",
      lifecycle: "active",
      name: "Orders",
      outputs: [
        { id: "out_ordered", name: "Order placed" },
        { id: "out_cancelled", name: "Order cancelled" },
      ],
      parent: ids.shop,
      type: "component",
    },
    relationships: [
      {
        description: "Authenticates checkout through",
        id: relationshipId,
        target: ids.login,
        type: "depends-on",
      },
    ],
  });
  await createComponent(executable, workspaceRoot, {
    component: { id: ids.orderItem, name: "OrderItem", parent: ids.orders, type: "component" },
  });
  await createComponent(executable, workspaceRoot, {
    component: { id: ids.payment, name: "Payment", parent: ids.orders, type: "adapter" },
  });

  const expectedIds = [
    ids.shop,
    ids.users,
    ids.orders,
    ids.orderItem,
    ids.payment,
    ids.authentication,
    ids.login,
    ids.googleLogin,
  ].sort();
  const observed: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await success(executable, workspaceRoot, [
      "component",
      "list",
      "--limit",
      "3",
      ...(cursor === undefined ? [] : ["--cursor", cursor]),
    ]);
    observed.push(...componentIds(page));
    const value = valueRecord(page);
    cursor = value.hasMore === true ? (value.nextCursor as string) : undefined;
  } while (cursor !== undefined);
  assert.deepEqual(observed, expectedIds);

  const roots = await success(executable, workspaceRoot, ["component", "roots", "--limit", "10"]);
  assert.deepEqual(componentIds(roots), [ids.shop, ids.users]);
  assert.deepEqual(
    componentIds(
      await success(executable, workspaceRoot, [
        "component",
        "children",
        ids.orders,
        "--limit",
        "10",
      ]),
    ),
    [ids.orderItem, ids.payment],
  );
  const exactOrders = await success(executable, workspaceRoot, [
    "component",
    "get",
    ids.orders,
    "--relationships-limit",
    "10",
  ]);
  assert.ok(exactOrders.stdout.includes(relationshipId));
  assert.ok(exactOrders.stdout.includes(ids.login));

  const beforeRepeat = await intentSnapshot(workspaceRoot);
  const repeated = await success(
    executable,
    workspaceRoot,
    ["component", "update", "--stdin"],
    JSON.stringify({
      expectedRevision: mutationRevision(orders, ids.orders),
      id: ids.orders,
      patch: {
        actions: [
          { description: "Place an order", id: "act_place", name: "Place order" },
          { id: "act_cancel", name: "Cancel order" },
        ],
        inputs: [
          { id: "inp_order", name: "Order request" },
          { id: "inp_cancel", name: "Cancel request" },
        ],
        outputs: [
          { id: "out_ordered", name: "Order placed" },
          { id: "out_cancelled", name: "Order cancelled" },
        ],
      },
    }),
  );
  assert.deepEqual(await intentSnapshot(workspaceRoot), beforeRepeat);
  assert.equal(
    mutationRevision(repeated, ids.orders),
    mutationRevision(orders, ids.orders),
    "semantically identical serialization changed the content revision",
  );
  const originalPath = beforeRepeat.find((entry) => entry.path.includes(ids.orders))?.path;
  assert.equal(typeof originalPath, "string");

  const renamed = await success(
    executable,
    workspaceRoot,
    ["component", "update", "--stdin"],
    JSON.stringify({
      expectedRevision: mutationRevision(repeated, ids.orders),
      id: ids.orders,
      patch: { name: "Ordering" },
    }),
  );
  const reparented = await success(executable, workspaceRoot, [
    "component",
    "reparent",
    ids.orders,
    "--revision",
    mutationRevision(renamed, ids.orders),
    "--parent",
    ids.users,
  ]);
  assert.equal(valueRecord(reparented).id, ids.orders);
  const moved = await component(executable, workspaceRoot, ids.orders);
  assert.equal(moved.component.id, ids.orders);
  assert.equal(moved.component.name, "Ordering");
  assert.equal(moved.component.parent, ids.users);
  assert.equal(
    (await intentSnapshot(workspaceRoot)).find((entry) => entry.path.includes(ids.orders))?.path,
    originalPath,
  );

  const firstStable = await success(executable, workspaceRoot, [
    "component",
    "roots",
    "--limit",
    "10",
  ]);
  const secondStable = await success(executable, workspaceRoot, [
    "component",
    "roots",
    "--limit",
    "10",
  ]);
  assert.equal(secondStable.stdout, firstStable.stdout);

  const firstHelp = await runProcess(executable, workspaceRoot, []);
  const secondHelp = await runProcess(executable, workspaceRoot, []);
  assert.equal(firstHelp.exitCode, 0);
  assert.equal(firstHelp.stderr, "");
  assert.equal(firstHelp.stdout, secondHelp.stdout);
  assert.ok(firstHelp.stdout.includes("Usage:\n"));
  await verifyTerminal(executable, workspaceRoot);

  await expectFailureWithoutChanges(
    executable,
    workspaceRoot,
    ["component", "update", "--stdin"],
    4,
    "content-revision-conflict",
    JSON.stringify({ expectedRevision: "stale-revision", id: ids.orders, patch: { name: "No" } }),
  );
  const users = await component(executable, workspaceRoot, ids.users);
  await expectFailureWithoutChanges(
    executable,
    workspaceRoot,
    ["component", "reparent", ids.users, "--revision", users.revision, "--parent", ids.login],
    4,
    "component-containment-cycle",
  );
  await expectFailureWithoutChanges(
    executable,
    workspaceRoot,
    ["component", "create", "--stdin"],
    4,
    "invalid-component-parent",
    JSON.stringify({ component: { id: ids.invalid, parent: [ids.shop, ids.users] } }),
  );
  await expectFailureWithoutChanges(
    executable,
    workspaceRoot,
    ["component", "create", "--stdin"],
    4,
    "unknown-entity",
    JSON.stringify({
      component: { id: ids.invalid },
      relationships: [{ target: ids.recovery, type: "depends-on" }],
    }),
  );
  await expectFailureWithoutChanges(
    executable,
    workspaceRoot,
    ["component", "update", "--stdin"],
    4,
    "ambiguous-relationship-mutation",
    JSON.stringify({
      expectedRevision: moved.revision,
      id: ids.orders,
      patch: {},
      relationships: {
        remove: [relationshipId],
        upsert: [{ id: relationshipId, target: ids.login, type: "depends-on" }],
      },
    }),
  );
  await expectFailureWithoutChanges(
    executable,
    workspaceRoot,
    ["component", "create", "--stdin"],
    2,
    "cli-invalid-input",
    '{"component":',
  );
}

async function verifyMalformedCanonicalDocument(executable: string, workspaceRoot: string) {
  await success(executable, workspaceRoot, ["init"]);
  await createComponent(executable, workspaceRoot, {
    component: { id: ids.shop, name: "Shop", type: "domain" },
  });
  const files = await intentSnapshot(workspaceRoot);
  assert.equal(files.length, 1);
  const file = path.join(workspaceRoot, "groma", "intent", files[0]!.path);
  await writeFile(file, "---\nschema: groma/v0.1\nschema: duplicate\n---\n", "utf8");
  const malformed = await gromaSnapshot(workspaceRoot);
  const result = await failure(
    executable,
    workspaceRoot,
    ["component", "list", "--limit", "10"],
    5,
    "workspace-recovery-failed",
  );
  assert.ok(JSON.stringify(result.envelope.result).includes("diagnostics"));
  assert.deepEqual(await gromaSnapshot(workspaceRoot), malformed);
}

interface CrashCase {
  readonly expected: "new" | "old";
  readonly locator: "journal" | "source";
  readonly occurrence: number;
  readonly operation: "create" | "delete";
  readonly phase:
    | "after-rename"
    | "removal-after-unlink"
    | "removal-parent-directory-sync"
    | "replacement-after-rename-before-mode"
    | "replacement-parent-directory-sync"
    | "replacement-target-file-sync";
}

const replacementPhases: readonly CrashCase["phase"][] = [
  "replacement-after-rename-before-mode",
  "replacement-target-file-sync",
  "replacement-parent-directory-sync",
  "after-rename",
];
const crashCases: readonly CrashCase[] = [
  {
    expected: "old",
    locator: "journal",
    occurrence: 1,
    operation: "create",
    phase: "after-rename",
  },
  ...replacementPhases.map((phase): CrashCase => ({
    expected: "new",
    locator: "journal",
    occurrence: 2,
    operation: "create",
    phase,
  })),
  ...replacementPhases.map((phase): CrashCase => ({
    expected: "new",
    locator: "source",
    occurrence: 1,
    operation: "create",
    phase,
  })),
  ...replacementPhases.map((phase): CrashCase => ({
    expected: "new",
    locator: "journal",
    occurrence: 3,
    operation: "create",
    phase,
  })),
  {
    expected: "new",
    locator: "source",
    occurrence: 1,
    operation: "delete",
    phase: "removal-after-unlink",
  },
  {
    expected: "new",
    locator: "source",
    occurrence: 1,
    operation: "delete",
    phase: "removal-parent-directory-sync",
  },
];

function intentLocator(id: string): string {
  return `groma/intent/${id.slice(4, 6)}/${id}.md`;
}

async function verifyCrashCase(
  executable: string,
  crashExecutable: string,
  workspaceRoot: string,
  crashCase: CrashCase,
): Promise<void> {
  await success(executable, workspaceRoot, ["init"]);
  await createComponent(executable, workspaceRoot, {
    component: { id: ids.users, name: "Recovery target", type: "domain" },
  });
  let command: readonly string[];
  let input: string | undefined;
  if (crashCase.operation === "create") {
    command = ["--format", "json", "component", "create", "--stdin"];
    input = JSON.stringify({
      component: { id: ids.orders, name: "Crash candidate", parent: ids.users, type: "service" },
      relationships: [{ id: relationshipId, target: ids.users, type: "depends-on" }],
    });
  } else {
    const created = await createComponent(executable, workspaceRoot, {
      component: { id: ids.orders, name: "Delete candidate", type: "service" },
    });
    command = [
      "--format",
      "json",
      "component",
      "remove",
      ids.orders,
      "--revision",
      mutationRevision(created, ids.orders),
    ];
  }
  const crashed = await runProcess(crashExecutable, workspaceRoot, command, input, {
    GROMA_VERIFY_FAULT_LOCATOR:
      crashCase.locator === "journal" ? transactionStateLocator : intentLocator(ids.orders),
    GROMA_VERIFY_FAULT_OCCURRENCE: String(crashCase.occurrence),
    GROMA_VERIFY_FAULT_PHASE: crashCase.phase,
  });
  assert.equal(crashed.exitCode, 86, `${crashCase.phase}: ${crashed.stderr}${crashed.stdout}`);

  const listed = await success(executable, workspaceRoot, ["component", "list", "--limit", "10"]);
  const expectedIds =
    crashCase.expected === "new" && crashCase.operation === "create"
      ? [ids.users, ids.orders].sort()
      : [ids.users];
  assert.deepEqual(componentIds(listed), expectedIds, `${crashCase.phase} recovery`);
  const generation = valueRecord(listed).generation;
  assert.equal(
    generation,
    crashCase.expected === "old" ? 1 : crashCase.operation === "delete" ? 3 : 2,
  );
  assert.equal(
    (await gromaSnapshot(workspaceRoot)).some((entry) => entry.path.includes(".groma-stage-")),
    false,
  );

  if (crashCase.expected === "old") {
    await createComponent(executable, workspaceRoot, {
      component: { id: ids.orders, name: "Valid after rollback", type: "service" },
    });
  } else if (crashCase.operation === "create") {
    const recovered = await component(executable, workspaceRoot, ids.orders);
    assert.equal(recovered.component.parent, ids.users);
    const exact = await success(executable, workspaceRoot, [
      "component",
      "get",
      ids.orders,
      "--relationships-limit",
      "10",
    ]);
    assert.ok(exact.stdout.includes(relationshipId));
    await success(
      executable,
      workspaceRoot,
      ["component", "update", "--stdin"],
      JSON.stringify({
        expectedRevision: recovered.revision,
        id: ids.orders,
        patch: { name: `Recovered ${crashCase.phase}` },
      }),
    );
  } else {
    await createComponent(executable, workspaceRoot, {
      component: { id: ids.recovery, name: "Valid after deletion recovery" },
    });
  }
}

async function verifyCrashes(executable: string, temporaryRoot: string): Promise<void> {
  const crashExecutable = path.join(
    temporaryRoot,
    process.platform === "win32" ? "groma-crash.exe" : "groma-crash",
  );
  const exitCode = await compileStandalone({
    cwd: projectRoot,
    entrypoint: path.join(projectRoot, "tests", "iteration-1a", "crash-main.ts"),
    outputFile: crashExecutable,
  });
  assert.equal(exitCode, 0, "verification crash executable compilation failed");
  // Windows deliberately skips directory sync and therefore never reaches these fault phases.
  const hostCrashCases = crashCases.filter(
    (entry) =>
      process.platform !== "win32" ||
      (entry.phase !== "replacement-parent-directory-sync" &&
        entry.phase !== "removal-parent-directory-sync"),
  );
  for (let index = 0; index < hostCrashCases.length; index += 1) {
    const workspaceRoot = path.join(temporaryRoot, `crash-${index}`);
    await mkdir(workspaceRoot);
    await verifyCrashCase(executable, crashExecutable, workspaceRoot, hostCrashCases[index]!);
  }
}

const options = parseOptions(Bun.argv.slice(2));
await access(options.executable);
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "groma-iteration-1a-"));
try {
  const workflowRoot = path.join(temporaryRoot, "workflow");
  await mkdir(workflowRoot);
  await verifyWorkflow(options.executable, workflowRoot);

  const malformedRoot = path.join(temporaryRoot, "malformed");
  await mkdir(malformedRoot);
  await verifyMalformedCanonicalDocument(options.executable, malformedRoot);

  if (!options.skipCrash) {
    await verifyCrashes(options.executable, temporaryRoot);
  }
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}

console.log(
  `Verified Iteration 1A compiled-binary workflow${options.skipCrash ? "" : " and crash recovery"}: ${options.executable}`,
);
