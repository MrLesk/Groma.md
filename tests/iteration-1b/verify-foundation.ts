import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const defaultExecutable = path.join(
  projectRoot,
  "dist",
  process.platform === "win32" ? "groma.exe" : "groma",
);
const commandTimeoutMilliseconds = 30_000;
const maximumCommandOutputBytes = 8 * 1024 * 1024 + 64 * 1024;
const maximumPageRequests = 32;

const ids = Object.freeze({
  checkout: "ent_10000000000000000000000000000001",
  payment: "ent_10000000000000000000000000000002",
  cart: "ent_10000000000000000000000000000003",
  staleA: "ent_20000000000000000000000000000001",
  staleB: "ent_20000000000000000000000000000002",
  staleC: "ent_20000000000000000000000000000003",
  incompatible: "ent_40000000000000000000000000000001",
});
const relationshipId = "rel_10000000000000000000000000000001";

interface VerifyOptions {
  readonly executable: string;
}

interface Scenario {
  readonly home: string;
  readonly workspace: string;
}

interface ProcessResult {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

interface JsonEnvelope {
  readonly command: string;
  readonly exitCode: number;
  readonly ok: boolean;
  readonly result: unknown;
}

interface JsonResult extends ProcessResult {
  readonly envelope: JsonEnvelope;
}

interface SnapshotEntry {
  readonly path: string;
  readonly sha256: string;
}

interface PageValue<T> {
  readonly generation: number;
  readonly hasMore: boolean;
  readonly items: readonly T[];
  readonly nextCursor?: string;
}

interface Component {
  readonly iconDomain?: string;
  readonly id: string;
  readonly label?: string;
  readonly name?: string;
  readonly parent?: string;
  readonly summary?: string;
}

interface ExportItem {
  readonly component: Component;
  readonly relationships: readonly { readonly id: string }[];
}

function parseOptions(args: readonly string[]): VerifyOptions {
  let executable = defaultExecutable;
  let executableSeen = false;
  for (const argument of args) {
    if (argument.startsWith("--executable=") && !executableSeen) {
      const value = argument.slice("--executable=".length);
      assert.notEqual(value, "", "--executable requires a path");
      executable = path.resolve(projectRoot, value);
      executableSeen = true;
      continue;
    }
    throw new Error("Usage: bun run tests/iteration-1b/verify-foundation.ts [--executable=<path>]");
  }
  return Object.freeze({ executable });
}

async function createScenario(root: string, name: string): Promise<Scenario> {
  const scenarioRoot = path.join(root, name);
  const home = path.join(scenarioRoot, "home");
  const workspace = path.join(scenarioRoot, "workspace");
  await mkdir(home, { recursive: true });
  await mkdir(workspace, { recursive: true });
  return Object.freeze({ home, workspace });
}

async function readBounded(
  stream: ReadableStream<Uint8Array>,
  label: string,
  maximumBytes = maximumCommandOutputBytes,
): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      total += item.value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new Error(`${label} exceeded its ${maximumBytes}-byte output bound`);
      }
      chunks.push(item.value.slice());
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function runProcess(
  executable: string,
  scenario: Scenario,
  args: readonly string[],
  input?: string,
): Promise<ProcessResult> {
  const child = Bun.spawn({
    cmd: [executable, ...args],
    cwd: scenario.workspace,
    env: { ...process.env, HOME: scenario.home, USERPROFILE: scenario.home },
    stderr: "pipe",
    stdin: input === undefined ? "ignore" : "pipe",
    stdout: "pipe",
  });
  if (input !== undefined) {
    const stdin = child.stdin;
    assert.notEqual(stdin, undefined, "compiled process stdin was unavailable");
    stdin!.write(input);
    stdin!.end();
  }
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, commandTimeoutMilliseconds);
  const exited = child.exited;
  const stdout = readBounded(child.stdout, `${args.join(" ")} stdout`);
  const stderr = readBounded(child.stderr, `${args.join(" ")} stderr`, 1_048_576);
  try {
    const [exitCode, capturedStdout, capturedStderr] = await Promise.all([exited, stdout, stderr]);
    assert.equal(timedOut, false, `${args.join(" ")} timed out`);
    return { exitCode, stderr: capturedStderr, stdout: capturedStdout };
  } catch (error) {
    try {
      child.kill();
    } catch {
      // The process may have exited while a bounded stream reader was rejecting.
    }
    await Promise.allSettled([exited, stdout, stderr]);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function runJson(
  executable: string,
  scenario: Scenario,
  args: readonly string[],
  input?: string,
): Promise<JsonResult> {
  const result = await runProcess(executable, scenario, ["--format", "json", ...args], input);
  assert.equal(result.stderr, "", `unexpected stderr for ${args.join(" ")}`);
  assert.ok(result.stdout.endsWith("\n"), `missing JSON framing for ${args.join(" ")}`);
  assert.equal(
    result.stdout.slice(0, -1).includes("\n"),
    false,
    `streamed multiple documents for ${args.join(" ")}`,
  );
  const envelope = JSON.parse(result.stdout) as JsonEnvelope;
  assert.equal(envelope.exitCode, result.exitCode, result.stdout);
  return Object.freeze({ ...result, envelope });
}

async function success(
  executable: string,
  scenario: Scenario,
  args: readonly string[],
  input?: string,
): Promise<JsonResult> {
  const result = await runJson(executable, scenario, args, input);
  assert.equal(result.exitCode, 0, result.stdout);
  assert.equal(result.envelope.ok, true, result.stdout);
  return result;
}

async function failure(
  executable: string,
  scenario: Scenario,
  args: readonly string[],
  exitCode: number,
  diagnosticCode: string,
  input?: string,
): Promise<JsonResult> {
  const result = await runJson(executable, scenario, args, input);
  assert.equal(result.exitCode, exitCode, result.stdout);
  assert.equal(result.envelope.ok, false, result.stdout);
  assert.ok(
    JSON.stringify(result.envelope.result).includes(`"code":"${diagnosticCode}"`),
    result.stdout,
  );
  return result;
}

function resultValue<T>(result: JsonResult): T {
  assert.equal(typeof result.envelope.result, "object", result.stdout);
  assert.notEqual(result.envelope.result, null, result.stdout);
  const applicationResult = result.envelope.result as {
    readonly ok?: unknown;
    readonly value?: unknown;
  };
  assert.equal(applicationResult.ok, true, result.stdout);
  return applicationResult.value as T;
}

function pageValue<T>(result: JsonResult, limit: number, label: string): PageValue<T> {
  const value = resultValue<Partial<PageValue<T>>>(result);
  assert.ok(Number.isSafeInteger(value.generation), `${label} generation is not bounded`);
  assert.equal(typeof value.hasMore, "boolean", `${label} hasMore is not boolean`);
  assert.ok(Array.isArray(value.items), `${label} items are not an array`);
  assert.ok(value.items.length <= limit, `${label} exceeded requested limit ${limit}`);
  assert.equal(value.hasMore, value.nextCursor !== undefined, `${label} cursor contract diverged`);
  if (value.nextCursor !== undefined) {
    assert.equal(typeof value.nextCursor, "string", `${label} cursor is not a string`);
    assert.ok(value.nextCursor.length > 0, `${label} cursor is empty`);
  }
  return value as PageValue<T>;
}

async function canonicalSnapshot(workspace: string): Promise<readonly SnapshotEntry[]> {
  const root = path.join(workspace, "groma");
  const entries: SnapshotEntry[] = [];
  try {
    await lstat(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return Object.freeze(entries);
    throw error;
  }
  const visit = async (directory: string): Promise<void> => {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      const absolute = path.join(directory, child.name);
      if (child.isDirectory()) {
        await visit(absolute);
      } else {
        assert.equal(child.isFile(), true, `unsupported canonical entry: ${absolute}`);
        entries.push({
          path: path.relative(root, absolute).split(path.sep).join("/"),
          sha256: createHash("sha256")
            .update(await readFile(absolute))
            .digest("hex"),
        });
      }
    }
  };
  await visit(root);
  return Object.freeze(entries);
}

async function requireMissing(candidate: string, message: string): Promise<void> {
  try {
    await lstat(candidate);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error(message);
}

async function createComponent(
  executable: string,
  scenario: Scenario,
  request: Readonly<Record<string, unknown>>,
): Promise<JsonResult> {
  return success(executable, scenario, ["component", "create", "--stdin"], JSON.stringify(request));
}

async function exportAll(
  executable: string,
  scenario: Scenario,
  limit: number,
): Promise<{ readonly generation: number; readonly items: readonly ExportItem[] }> {
  const items: ExportItem[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  let generation: number | undefined;
  let requests = 0;
  do {
    requests += 1;
    assert.ok(requests <= maximumPageRequests, "complete export exceeded its page-count bound");
    const result = await success(executable, scenario, [
      "blueprint",
      "export",
      "--limit",
      String(limit),
      ...(cursor === undefined ? [] : ["--cursor", cursor]),
    ]);
    const page = pageValue<ExportItem>(result, limit, "blueprint export");
    generation ??= page.generation;
    assert.equal(page.generation, generation, "complete export changed generation between pages");
    items.push(...page.items);
    cursor = page.nextCursor;
    if (cursor !== undefined) {
      assert.equal(cursors.has(cursor), false, "complete export cursor repeated");
      cursors.add(cursor);
    }
  } while (cursor !== undefined);
  assert.notEqual(generation, undefined, "complete export returned no generation");
  return Object.freeze({ generation, items: Object.freeze(items) });
}

async function verifyFoundationWorkflow(executable: string, scenario: Scenario): Promise<void> {
  assert.deepEqual(await canonicalSnapshot(scenario.workspace), []);
  await failure(executable, scenario, ["component", "roots", "--limit", "1"], 3, "no-workspace");
  assert.deepEqual(await canonicalSnapshot(scenario.workspace), []);

  await success(executable, scenario, ["init"]);
  assert.equal(
    await readFile(path.join(scenario.workspace, "groma", "groma.yaml"), "utf8"),
    "schema: groma/v0.1\n",
  );
  await createComponent(executable, scenario, {
    component: {
      id: ids.payment,
      intent: "Own payment authorization and settlement.",
      name: "Payment",
      type: "service",
    },
  });
  await createComponent(executable, scenario, {
    component: {
      iconDomain: "shop.example.com",
      id: ids.checkout,
      intent: "Coordinate checkout from cart to payment.",
      label: "Checkout flow",
      name: "Checkout",
      summary: "Coordinates checkout from cart to payment.",
      type: "domain",
    },
    relationships: [
      {
        description: "Delegates authorization to payment.",
        id: relationshipId,
        target: ids.payment,
        type: "depends-on",
      },
    ],
  });
  await createComponent(executable, scenario, {
    component: {
      id: ids.cart,
      intent: "Keep the selected products for checkout.",
      name: "Cart",
      parent: ids.checkout,
      type: "component",
    },
  });

  const beforeReads = await canonicalSnapshot(scenario.workspace);
  const exact = resultValue<{
    readonly item: { readonly component: Component };
  }>(
    await success(executable, scenario, [
      "component",
      "get",
      ids.checkout,
      "--relationships-limit",
      "1",
    ]),
  );
  assert.deepEqual(
    {
      iconDomain: exact.item.component.iconDomain,
      label: exact.item.component.label,
      summary: exact.item.component.summary,
    },
    {
      iconDomain: "shop.example.com",
      label: "Checkout flow",
      summary: "Coordinates checkout from cart to payment.",
    },
  );

  const list = pageValue<{ readonly component: Component }>(
    await success(executable, scenario, ["component", "list", "--limit", "2"]),
    2,
    "component list",
  );
  assert.equal(list.items.length, 2);
  assert.equal(list.hasMore, true);
  const roots = pageValue<{ readonly component: Component }>(
    await success(executable, scenario, ["component", "roots", "--limit", "2"]),
    2,
    "component roots",
  );
  assert.deepEqual(
    roots.items.map((item) => item.component.id),
    [ids.checkout, ids.payment],
  );
  const children = pageValue<{ readonly component: Component }>(
    await success(executable, scenario, ["component", "children", ids.checkout, "--limit", "1"]),
    1,
    "component children",
  );
  assert.deepEqual(
    children.items.map((item) => item.component.id),
    [ids.cart],
  );

  const firstExport = await exportAll(executable, scenario, 1);
  assert.deepEqual(
    firstExport.items.map((item) => item.component.id),
    [ids.checkout, ids.payment, ids.cart],
  );
  const exportedCheckout = firstExport.items.find(
    (item) => item.component.id === ids.checkout,
  )?.component;
  assert.deepEqual(
    {
      iconDomain: exportedCheckout?.iconDomain,
      label: exportedCheckout?.label,
      summary: exportedCheckout?.summary,
    },
    {
      iconDomain: "shop.example.com",
      label: "Checkout flow",
      summary: "Coordinates checkout from cart to payment.",
    },
  );
  assert.deepEqual(
    firstExport.items.flatMap((item) => item.relationships.map((relationship) => relationship.id)),
    [relationshipId],
  );
  const secondExport = await exportAll(executable, scenario, 1);
  assert.equal(secondExport.generation, firstExport.generation);
  assert.equal(JSON.stringify(secondExport.items), JSON.stringify(firstExport.items));

  const search = pageValue<Component>(
    await success(executable, scenario, [
      "blueprint",
      "search",
      "checkout from cart",
      "--limit",
      "1",
    ]),
    1,
    "blueprint search",
  );
  assert.equal(search.items.length, 1);
  assert.equal(search.items[0]?.id, ids.checkout);
  assert.equal(search.items[0]?.label, "Checkout flow");
  assert.equal(search.items[0]?.summary, "Coordinates checkout from cart to payment.");
  assert.equal(search.items[0]?.iconDomain, "shop.example.com");
  const traversal = pageValue<{
    readonly component: Component;
    readonly relationship: { readonly id: string };
  }>(
    await success(executable, scenario, [
      "blueprint",
      "traverse",
      ids.payment,
      "--direction",
      "incoming",
      "--depth",
      "1",
      "--relation-type",
      "depends-on",
      "--limit",
      "1",
    ]),
    1,
    "blueprint traverse",
  );
  assert.equal(traversal.items[0]?.component.id, ids.checkout);
  assert.equal(traversal.items[0]?.relationship.id, relationshipId);

  assert.deepEqual(await canonicalSnapshot(scenario.workspace), beforeReads);

  const cacheRoot = path.join(scenario.workspace, ".groma-cache");
  await writeFile(path.join(cacheRoot, "projection-index.json"), "{corrupt\n", "utf8");
  await writeFile(path.join(cacheRoot, "projection-read-current.json"), "{corrupt\n", "utf8");
  const repaired = await exportAll(executable, scenario, 1);
  assert.equal(repaired.generation, firstExport.generation);
  assert.equal(JSON.stringify(repaired.items), JSON.stringify(firstExport.items));
  assert.deepEqual(await canonicalSnapshot(scenario.workspace), beforeReads);
}

async function verifyMalformedConfiguration(executable: string, scenario: Scenario): Promise<void> {
  await success(executable, scenario, ["init"]);
  const configuration = path.join(scenario.workspace, "groma", "groma.yaml");
  const validBytes = await readFile(configuration);
  const beforeCorruption = await canonicalSnapshot(scenario.workspace);
  await writeFile(configuration, "schema: [\n", "utf8");
  const malformed = await canonicalSnapshot(scenario.workspace);
  await failure(
    executable,
    scenario,
    ["component", "roots", "--limit", "1"],
    3,
    "workspace-configuration-malformed",
  );
  assert.deepEqual(await canonicalSnapshot(scenario.workspace), malformed);
  await writeFile(configuration, validBytes);
  await success(executable, scenario, ["component", "roots", "--limit", "1"]);
  assert.equal(await readFile(configuration, "utf8"), "schema: groma/v0.1\n");
  assert.deepEqual(await canonicalSnapshot(scenario.workspace), beforeCorruption);
}

async function verifyStaleCursor(executable: string, scenario: Scenario): Promise<void> {
  await success(executable, scenario, ["init"]);
  await createComponent(executable, scenario, { component: { id: ids.staleA, name: "A" } });
  await createComponent(executable, scenario, { component: { id: ids.staleB, name: "B" } });
  const first = pageValue<ExportItem>(
    await success(executable, scenario, ["blueprint", "export", "--limit", "1"]),
    1,
    "stale cursor first page",
  );
  assert.equal(first.hasMore, true);
  assert.notEqual(first.nextCursor, undefined);
  await createComponent(executable, scenario, { component: { id: ids.staleC, name: "C" } });
  const afterExpectedMutation = await canonicalSnapshot(scenario.workspace);
  await failure(
    executable,
    scenario,
    ["blueprint", "export", "--limit", "1", "--cursor", first.nextCursor!],
    4,
    "stale-cursor",
  );
  assert.deepEqual(await canonicalSnapshot(scenario.workspace), afterExpectedMutation);
  const recovered = await exportAll(executable, scenario, 1);
  assert.deepEqual(
    recovered.items.map((item) => item.component.id),
    [ids.staleA, ids.staleB, ids.staleC],
  );
  assert.deepEqual(await canonicalSnapshot(scenario.workspace), afterExpectedMutation);
}

async function verifyIncompatibleCapability(executable: string, scenario: Scenario): Promise<void> {
  if (process.platform === "win32") return;
  await success(executable, scenario, ["init"]);
  await createComponent(executable, scenario, {
    component: { id: ids.incompatible, name: "Recovery sentinel" },
  });
  const packageRoot = path.join(scenario.workspace, "local-incompatible");
  const pluginRoot = path.join(packageRoot, "plugins");
  const startSentinel = path.join(packageRoot, "start-sentinel.txt");
  await mkdir(pluginRoot, { recursive: true });
  await writeFile(
    path.join(packageRoot, "groma.package.json"),
    `${JSON.stringify({
      apiVersion: "groma.package/v1",
      name: "foundation-incompatible",
      plugins: ["./plugins/incompatible.js"],
      runtimeApiVersion: "groma.plugin/v1",
      sdkApiVersion: "groma.sdk/v1",
      version: "1.0.0",
    })}\n`,
  );
  await writeFile(
    path.join(pluginRoot, "incompatible.js"),
    `import { appendFileSync } from "node:fs";
export const plugin = Object.freeze({
  manifest: Object.freeze({
    apiVersion: "groma.plugin/v1",
    id: "foundation.incompatible",
    phase: 1,
    provides: Object.freeze([]),
    requires: Object.freeze([Object.freeze({
      cardinality: "single",
      id: "groma.graph/v1",
      version: "2.0.0"
    })]),
    version: "1.0.0"
  }),
  start: () => {
    appendFileSync(${JSON.stringify(startSentinel)}, "started\\n");
    return Object.freeze({ capabilities: Object.freeze([]) });
  }
});
`,
  );
  await success(executable, scenario, ["package", "add", "./local-incompatible"]);
  const beforeUntrustedEnable = await canonicalSnapshot(scenario.workspace);
  await failure(
    executable,
    scenario,
    ["package", "enable", "foundation-incompatible", "./plugins/incompatible.js"],
    4,
    "plugin-full-user-permissions-trust-required",
  );
  assert.deepEqual(await canonicalSnapshot(scenario.workspace), beforeUntrustedEnable);
  await success(executable, scenario, [
    "package",
    "enable",
    "foundation-incompatible",
    "./plugins/incompatible.js",
    "--trust-full-user-permissions",
  ]);
  await requireMissing(startSentinel, "incompatible plugin started while it was being enabled");

  const enabled = await canonicalSnapshot(scenario.workspace);
  const rejected = await failure(
    executable,
    scenario,
    ["component", "roots", "--limit", "1"],
    5,
    "host-bootstrap-failed",
  );
  assert.ok(rejected.stdout.length < 65_536, "startup diagnostic exceeded its narrow bound");
  await requireMissing(startSentinel, "incompatible plugin start ran before resolution failed");
  assert.deepEqual(await canonicalSnapshot(scenario.workspace), enabled);

  await success(executable, scenario, [
    "package",
    "disable",
    "foundation-incompatible",
    "./plugins/incompatible.js",
  ]);
  const recovered = pageValue<{ readonly component: Component }>(
    await success(executable, scenario, ["component", "roots", "--limit", "1"]),
    1,
    "incompatible capability recovery",
  );
  assert.equal(recovered.items[0]?.component.id, ids.incompatible);
}

async function waitForInterruptionProgress(
  progressFile: string,
  exited: Promise<number>,
): Promise<boolean> {
  let processExited = false;
  void exited.then(() => {
    processExited = true;
  });
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      await lstat(progressFile);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (processExited) return false;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("cold export did not publish progress evidence before its timeout");
}

async function verifyInterruptedRead(executable: string, scenario: Scenario): Promise<void> {
  await success(executable, scenario, ["init"]);
  const interruptionIds = Array.from(
    { length: 80 },
    (_, index) => `ent_${(0x3000 + index).toString(16).padStart(32, "0")}`,
  );
  const padding = "x".repeat(55_000);
  await createComponent(executable, scenario, {
    component: {
      id: interruptionIds[0],
      intent: "Keep an interrupted cold projection read canonical-state neutral.",
      name: "Interrupted read 0",
      "verify.groma/padding": padding,
    },
  });
  const intentRoot = path.join(scenario.workspace, "groma", "intent", "00");
  await Promise.all(
    interruptionIds
      .slice(1)
      .map((id, offset) =>
        writeFile(
          path.join(intentRoot, `${id}.md`),
          `---\nschema: groma/v0.1\nid: ${id}\nkind: component\nname: Interrupted read ${offset + 1}\nverify.groma/padding: ${padding}\n---\n\n# Intent\n\nKeep an interrupted cold projection read canonical-state neutral.\n`,
          "utf8",
        ),
      ),
  );
  const fixtureRead = pageValue<{ readonly component: Component }>(
    await success(executable, scenario, ["component", "list", "--limit", "100"]),
    100,
    "interruption fixture",
  );
  assert.deepEqual(
    fixtureRead.items.map((item) => item.component.id),
    interruptionIds,
  );
  const primedExport = await exportAll(executable, scenario, 100);
  assert.deepEqual(
    primedExport.items.map((item) => item.component.id),
    interruptionIds,
  );
  const before = await canonicalSnapshot(scenario.workspace);
  const cacheRoot = path.join(scenario.workspace, ".groma-cache");
  await rm(cacheRoot, { force: true, recursive: true });

  const child = Bun.spawn({
    cmd: [executable, "--format", "json", "blueprint", "export", "--limit", "1"],
    cwd: scenario.workspace,
    env: { ...process.env, HOME: scenario.home, USERPROFILE: scenario.home },
    stderr: "pipe",
    stdout: "pipe",
  });
  const exited = child.exited;
  if (!(await waitForInterruptionProgress(cacheRoot, exited))) {
    const [exitCode, stdout, stderr] = await Promise.all([
      exited,
      readBounded(child.stdout, "early cold export stdout", 2_500_000),
      readBounded(child.stderr, "early cold export stderr", 1_048_576),
    ]);
    throw new Error(
      `cold export exited before publishing progress evidence: ${exitCode}\n${stderr}${stdout}`,
    );
  }
  child.kill("SIGTERM");
  let forced = false;
  const cleanup = setTimeout(() => {
    forced = true;
    child.kill("SIGKILL");
  }, 5_000);
  try {
    const [exitCode, stdout, stderr] = await Promise.all([
      exited,
      readBounded(child.stdout, "interrupted export stdout", 2_500_000),
      readBounded(child.stderr, "interrupted export stderr", 1_048_576),
    ]);
    assert.equal(forced, false, "interrupted export required SIGKILL cleanup");
    assert.notEqual(exitCode, 0, "SIGTERM did not interrupt the cold export");
    assert.equal(stderr, "", "interrupted export wrote unexpected stderr");
    if (stdout !== "") {
      assert.ok(stdout.endsWith("\n"), "interrupted export emitted a partial envelope");
      const envelope = JSON.parse(stdout) as JsonEnvelope;
      assert.equal(envelope.exitCode, exitCode, stdout);
      assert.equal(envelope.ok, false, stdout);
      assert.deepEqual(envelope.result, { signal: "SIGTERM", status: "cancelled" });
    }
  } finally {
    clearTimeout(cleanup);
  }
  assert.deepEqual(await canonicalSnapshot(scenario.workspace), before);
  const recovered = await exportAll(executable, scenario, 100);
  assert.deepEqual(
    recovered.items.map((item) => item.component.id),
    interruptionIds,
  );
  assert.deepEqual(await canonicalSnapshot(scenario.workspace), before);
}

const options = parseOptions(Bun.argv.slice(2));
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "groma-iteration-1b-foundation-"));
try {
  await verifyFoundationWorkflow(
    options.executable,
    await createScenario(temporaryRoot, "foundation"),
  );
  await verifyMalformedConfiguration(
    options.executable,
    await createScenario(temporaryRoot, "malformed-configuration"),
  );
  await verifyStaleCursor(options.executable, await createScenario(temporaryRoot, "stale-cursor"));
  await verifyIncompatibleCapability(
    options.executable,
    await createScenario(temporaryRoot, "incompatible-capability"),
  );
  await verifyInterruptedRead(
    options.executable,
    await createScenario(temporaryRoot, "interrupted-read"),
  );
  console.log(`Verified complete Iteration 1B foundation: ${options.executable}`);
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}
