import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, watch } from "node:fs";
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
const processTerminationGraceMilliseconds = 5_000;
const processSettlementTimeoutMilliseconds = 10_000;
const projectionStageObservationTimeoutMilliseconds = 15_000;
const defaultWorkspaceConfiguration = `schema: groma/v0.1
projects:
  - id: "project.default"
    name: "workspace"
    source: "."
    scanners: []
    coverage:
      - id: "workspace"
        resourceRoot: "."
`;

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

interface CapturedProcess {
  readonly exited: Promise<number>;
  readonly forceTerminate: () => void;
  readonly hasExited: () => boolean;
  readonly pid: number;
  readonly settle: () => Promise<void>;
  readonly terminate: () => void;
  readonly wait: () => Promise<readonly [number, string, string]>;
  readonly wasForceKilled: () => boolean;
  readonly writeInput: (input: string) => void;
}

interface BoundedRead {
  readonly cancel: () => void;
  readonly promise: Promise<string>;
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

function readBounded(
  stream: ReadableStream<Uint8Array>,
  label: string,
  maximumBytes = maximumCommandOutputBytes,
): BoundedRead {
  const reader = stream.getReader();
  let cancellation: Promise<void> | undefined;
  let released = false;
  const cancel = (): void => {
    if (released || cancellation !== undefined) return;
    cancellation = Promise.resolve()
      .then(() => reader.cancel())
      .catch(() => undefined);
  };
  const promise = (async (): Promise<string> => {
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        total += item.value.byteLength;
        if (total > maximumBytes) {
          cancel();
          await cancellation;
          throw new Error(`${label} exceeded its ${maximumBytes}-byte output bound`);
        }
        chunks.push(item.value.slice());
      }
    } finally {
      if (cancellation !== undefined) await cancellation;
      released = true;
      reader.releaseLock();
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(bytes);
  })();
  return Object.freeze({ cancel, promise });
}

function spawnCapturedProcess(
  executable: string,
  scenario: Scenario,
  args: readonly string[],
  options: {
    readonly acceptsInput?: boolean;
    readonly stderrBytes?: number;
    readonly stdoutBytes?: number;
    readonly timeoutMilliseconds?: number;
  } = {},
): CapturedProcess {
  const label = args.join(" ");
  const child = Bun.spawn({
    cmd: [executable, ...args],
    cwd: scenario.workspace,
    env: { ...process.env, HOME: scenario.home, USERPROFILE: scenario.home },
    stderr: "pipe",
    stdin: options.acceptsInput === true ? "pipe" : "ignore",
    stdout: "pipe",
  });
  const exited = child.exited;
  const stdout = readBounded(child.stdout, `${label} stdout`, options.stdoutBytes);
  const stderr = readBounded(child.stderr, `${label} stderr`, options.stderrBytes ?? 1_048_576);
  let processExited = false;
  let forceKilled = false;
  let terminationStarted = false;
  let forceKillTimer: ReturnType<typeof setTimeout> | undefined;
  void exited.then(
    () => {
      processExited = true;
    },
    () => {
      processExited = true;
    },
  );

  const forceTerminate = (): void => {
    if (processExited) return;
    forceKilled = true;
    terminationStarted = true;
    try {
      child.kill("SIGKILL");
    } catch {
      // Settlement remains bounded and may retry this idempotent signal.
    }
  };

  const terminate = (): void => {
    if (processExited || terminationStarted) return;
    terminationStarted = true;
    try {
      child.kill("SIGTERM");
    } catch {
      // Settlement below distinguishes an already-exited process from failed cleanup.
    }
    forceKillTimer = setTimeout(() => {
      if (processExited) return;
      forceTerminate();
    }, processTerminationGraceMilliseconds);
  };

  const result = Promise.all([exited, stdout.promise, stderr.promise]);
  void result.catch(() => undefined);
  const settled = Promise.allSettled([exited, stdout.promise, stderr.promise]);
  const timeoutMilliseconds = options.timeoutMilliseconds ?? commandTimeoutMilliseconds;
  let lifetimeTimer: ReturnType<typeof setTimeout> | undefined;
  const lifetimeExpired = new Promise<never>((_resolve, reject) => {
    lifetimeTimer = setTimeout(() => {
      terminate();
      reject(new Error(`${label} timed out after ${timeoutMilliseconds}ms`));
    }, timeoutMilliseconds);
  });
  void settled.then(() => {
    if (lifetimeTimer !== undefined) clearTimeout(lifetimeTimer);
    if (forceKillTimer !== undefined) clearTimeout(forceKillTimer);
  });

  const settle = async (): Promise<void> => {
    if (!processExited) terminate();
    let settlementTimer: ReturnType<typeof setTimeout> | undefined;
    const settlementExpired = new Promise<never>((_resolve, reject) => {
      settlementTimer = setTimeout(() => {
        forceTerminate();
        stdout.cancel();
        stderr.cancel();
        reject(
          new Error(
            `${label} did not settle within ${processSettlementTimeoutMilliseconds}ms after termination`,
          ),
        );
      }, processSettlementTimeoutMilliseconds);
    });
    try {
      await Promise.race([settled.then(() => undefined), settlementExpired]);
    } finally {
      if (settlementTimer !== undefined) clearTimeout(settlementTimer);
    }
  };

  return Object.freeze({
    exited,
    forceTerminate,
    hasExited: () => child.exitCode !== null || child.signalCode !== null,
    pid: child.pid,
    settle,
    terminate,
    wait: () => Promise.race([result, lifetimeExpired]),
    wasForceKilled: () => forceKilled || child.signalCode === "SIGKILL",
    writeInput: (input: string): void => {
      const stdin = child.stdin;
      if (stdin === undefined || typeof stdin === "number") {
        throw new Error("compiled process stdin was unavailable");
      }
      stdin.write(input);
      stdin.end();
    },
  });
}

async function runProcess(
  executable: string,
  scenario: Scenario,
  args: readonly string[],
  input?: string,
): Promise<ProcessResult> {
  const captured = spawnCapturedProcess(executable, scenario, args, {
    acceptsInput: input !== undefined,
  });
  let operationFailed = false;
  try {
    if (input !== undefined) captured.writeInput(input);
    const [exitCode, capturedStdout, capturedStderr] = await captured.wait();
    return { exitCode, stderr: capturedStderr, stdout: capturedStdout };
  } catch (error) {
    operationFailed = true;
    throw error;
  } finally {
    try {
      await captured.settle();
    } catch (cleanupError) {
      if (!operationFailed) throw cleanupError;
    }
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
    defaultWorkspaceConfiguration,
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
  assert.equal(await readFile(configuration, "utf8"), defaultWorkspaceConfiguration);
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
  const evaluationSentinel = path.join(packageRoot, "evaluation-sentinel.txt");
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
appendFileSync(${JSON.stringify(evaluationSentinel)}, "evaluated\\n");
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
  await requireMissing(
    evaluationSentinel,
    "untrusted incompatible plugin module was evaluated before trust was granted",
  );
  await requireMissing(startSentinel, "untrusted incompatible plugin start ran before trust");
  await success(executable, scenario, [
    "package",
    "enable",
    "foundation-incompatible",
    "./plugins/incompatible.js",
    "--trust-full-user-permissions",
  ]);
  assert.equal(await readFile(evaluationSentinel, "utf8"), "evaluated\n");
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
  assert.equal(await readFile(evaluationSentinel, "utf8"), "evaluated\nevaluated\n");
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

async function verifyInterruptedRead(executable: string, scenario: Scenario): Promise<void> {
  await success(executable, scenario, ["init"]);
  const interruptionIds = Array.from(
    { length: 40 },
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
  // These 39 hand-written canonical Markdown fixtures intentionally create a representative cold
  // projection rebuild; the compiled public CLI validates every fixture immediately afterward.
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
  await mkdir(cacheRoot, { recursive: true });
  const ignorePath = path.join(cacheRoot, ".gitignore");
  await writeFile(ignorePath, "*\n", "utf8");

  const projectionIndexPath = path.join(cacheRoot, "projection-index.json");
  const projectionReadManifestPath = path.join(cacheRoot, "projection-read-current.json");
  assert.deepEqual(await readdir(cacheRoot), [".gitignore"], "cold cache was not fresh");
  assert.equal(await readFile(ignorePath, "utf8"), "*\n", "cold cache ignore file changed");
  await requireMissing(projectionIndexPath, "cold cache already contained a projection index");
  await requireMissing(
    projectionReadManifestPath,
    "cold cache already contained a projection read manifest",
  );
  const projectionStagePrefix = `.groma-stage-${createHash("sha256")
    .update(".groma-cache/projection-index.json")
    .digest("hex")}-`;
  let captured: CapturedProcess | undefined;
  let childExitedBeforeStage = false;
  let observedStagePath: string | undefined;
  let pendingStageName: string | undefined;
  let watcherFailure: Error | undefined;
  const observeStageName = (name: string): void => {
    if (!name.startsWith(projectionStagePrefix)) return;
    if (captured === undefined) {
      pendingStageName = name;
      return;
    }
    const expectedPrefix = `${projectionStagePrefix}${captured.pid}-`;
    if (
      observedStagePath !== undefined ||
      !name.startsWith(expectedPrefix) ||
      name.length === expectedPrefix.length
    ) {
      return;
    }
    observedStagePath = path.join(cacheRoot, name);
    captured.forceTerminate();
  };
  const watcher = watch(
    cacheRoot,
    { encoding: "utf8", persistent: false },
    (_eventType, filename) => {
      if (filename !== null) observeStageName(filename);
    },
  );
  watcher.on("error", (error) => {
    watcherFailure = error;
    if (captured !== undefined) captured.terminate();
  });
  let capturedResult: readonly [number, string, string] | undefined;
  let operationFailed = false;
  try {
    captured = spawnCapturedProcess(
      executable,
      scenario,
      ["--format", "json", "blueprint", "export", "--limit", "1"],
      {
        stderrBytes: 1_048_576,
        stdoutBytes: 1_048_576,
        timeoutMilliseconds: 30_000,
      },
    );
    const processResult = captured.wait();
    void processResult.catch(() => undefined);
    if (watcherFailure !== undefined) captured.terminate();
    else if (pendingStageName !== undefined) observeStageName(pendingStageName);
    // The exporter is a separate process, so this bounded synchronous observation loop can detect
    // its exclusive stage and send SIGKILL without timer or fs.watch delivery latency.
    const observationDeadline = Date.now() + projectionStageObservationTimeoutMilliseconds;
    while (
      observedStagePath === undefined &&
      !captured.hasExited() &&
      Date.now() < observationDeadline
    ) {
      const entries = readdirSync(cacheRoot);
      assert.ok(entries.length <= 64, "cold cache root exceeded its observation bound");
      for (const entry of entries) observeStageName(entry);
    }
    childExitedBeforeStage = observedStagePath === undefined && captured.hasExited();
    if (observedStagePath === undefined && !childExitedBeforeStage) {
      throw new Error(
        `cold export did not stage its projection index within ${projectionStageObservationTimeoutMilliseconds}ms`,
      );
    }
    capturedResult = await processResult;
  } catch (error) {
    operationFailed = true;
    throw error;
  } finally {
    try {
      watcher.close();
    } finally {
      try {
        if (captured !== undefined) await captured.settle();
      } catch (cleanupError) {
        if (!operationFailed) throw cleanupError;
      }
    }
  }
  if (watcherFailure !== undefined) throw watcherFailure;
  assert.notEqual(
    capturedResult,
    undefined,
    "interrupted export did not report its process result",
  );
  const [exitCode, stdout, stderr] = capturedResult;
  assert.equal(
    childExitedBeforeStage,
    false,
    "cold export exited before staging its projection index",
  );
  assert.ok(observedStagePath !== undefined, "cold export never staged its projection index");
  assert.equal(captured.wasForceKilled(), true, "staged projection rebuild did not force SIGKILL");
  assert.notEqual(exitCode, 0, "interrupted cold export completed successfully");
  assert.equal(stdout, "", "interrupted export wrote unexpected stdout");
  assert.equal(stderr, "", "interrupted export wrote unexpected stderr");
  assert.equal((await lstat(observedStagePath)).isFile(), true, "projection stage did not survive");
  await requireMissing(projectionIndexPath, "interrupted export published its projection index");
  await requireMissing(
    projectionReadManifestPath,
    "interrupted export published its projection read manifest",
  );
  assert.deepEqual(await canonicalSnapshot(scenario.workspace), before);
  const recovered = await exportAll(executable, scenario, 100);
  assert.deepEqual(recovered, primedExport, "interrupted export recovery changed the blueprint");
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
