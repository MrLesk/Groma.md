import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const defaultExecutable = path.join(
  projectRoot,
  "dist",
  process.platform === "win32" ? "groma.exe" : "groma",
);
const pageLimit = 7;
// Test-harness runaway protection only; this never limits canonical components or presentation nodes.
const testHarnessPageRequestLimit = 256;
const declarationStatuses = ["ambiguous", "constraint", "edge", "partial"] as const;
type DeclarationStatus = (typeof declarationStatuses)[number];

interface BaselineCounts {
  readonly actions: number;
  readonly components: number;
  readonly declarations: number;
  readonly edges: number;
  readonly embeddedItems: number;
  readonly inputs: number;
  readonly intents: number;
  readonly outputs: number;
  readonly roots: number;
}

interface BaselineDigests {
  readonly declarations: string;
  readonly edges: string;
  readonly embeddedItems: string;
  readonly export: string;
  readonly parents: string;
  readonly roots: string;
  readonly seeds: string;
}

interface BaselineSummary {
  readonly counts: BaselineCounts;
  readonly digests: BaselineDigests;
  readonly statusCounts: Readonly<Record<DeclarationStatus, number>>;
}

const expectedBaseline: BaselineSummary = Object.freeze({
  counts: Object.freeze({
    actions: 158,
    components: 43,
    declarations: 87,
    edges: 104,
    embeddedItems: 398,
    inputs: 129,
    intents: 43,
    outputs: 111,
    roots: 9,
  }),
  digests: Object.freeze({
    declarations: "e3db534b863260a06949e97f4389653c8e99617d8d67ce97ace196aed23fee82",
    edges: "5dd4a3e5b3b737ced7971611a1426847515cfbb362ea75eed78ca16e66a40cb7",
    embeddedItems: "76551c8739a13767d01eef6459cae01a49f5ddc8e02d0bc37a40b50fdd1053bc",
    export: "0d7088ca97244f4c0c704ca2586fcd091b162d511d8a5e7f3ac6c7b6ed9579b9",
    parents: "196e03f6931485dfd821e56352c97bae249d6adce41754b99a98066af0d8e532",
    roots: "4d67f79c129d2b67be1284d4e46eae94d1c74f6ce94f9537059f479bb82d232a",
    seeds: "9a6b8c55f6f9147d94be1b16d86d58946b6fbd940f1652b507b68571f4f45e14",
  }),
  statusCounts: Object.freeze({ ambiguous: 8, constraint: 17, edge: 53, partial: 9 }),
});

interface JsonEnvelope {
  readonly command: string;
  readonly exitCode: number;
  readonly ok: boolean;
  readonly result: unknown;
}

interface StandardItem {
  readonly extensions: Readonly<Record<string, unknown>>;
  readonly id: string;
  readonly name?: string;
}

interface Declaration {
  readonly edgeIds?: readonly string[];
  readonly key: string;
  readonly status: DeclarationStatus;
  readonly text: string;
}

interface Component {
  readonly actions?: readonly StandardItem[];
  readonly desired?: string;
  readonly extensions: Readonly<Record<string, unknown>> & {
    readonly "groma.md/first-delivery"?: string;
    readonly "groma.md/relationship-declarations"?: readonly Declaration[];
    readonly "groma.md/seed-key"?: string;
  };
  readonly iconDomain?: string;
  readonly id: string;
  readonly inputs?: readonly StandardItem[];
  readonly intent?: string;
  readonly kind: "component";
  readonly label?: string;
  readonly lifecycle?: string;
  readonly outputs?: readonly StandardItem[];
  readonly parent?: string;
  readonly summary?: string;
  readonly type?: string;
}

interface Relationship {
  readonly description?: string;
  readonly extensions: Readonly<Record<string, unknown>>;
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly type: string;
}

interface ExportItem {
  readonly component: Component;
  readonly relationships: readonly Relationship[];
}

interface PagedItems<T> {
  readonly generation: number;
  readonly items: readonly T[];
}

interface VerifyOptions {
  readonly executable: string;
  readonly reportBaseline: boolean;
}

function optionsFrom(args: readonly string[]): VerifyOptions {
  let executable = defaultExecutable;
  let executableSeen = false;
  let reportBaseline = false;
  for (const argument of args) {
    if (argument === "--report-baseline" && !reportBaseline) {
      reportBaseline = true;
      continue;
    }
    if (argument.startsWith("--executable=") && !executableSeen) {
      const value = argument.slice("--executable=".length);
      assert.notEqual(value, "", "--executable requires a path");
      executable = path.resolve(projectRoot, value);
      executableSeen = true;
      continue;
    }
    throw new Error(
      "Usage: bun run tests/iteration-1b/verify-self-blueprint.ts " +
        "[--report-baseline] [--executable=<path>]",
    );
  }
  return Object.freeze({ executable, reportBaseline });
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

async function command(
  executable: string,
  workspace: string,
  args: readonly string[],
  input?: string,
): Promise<JsonEnvelope> {
  const child = Bun.spawn({
    cmd: [executable, "--format", "json", ...args],
    cwd: workspace,
    env: {
      ...process.env,
      HOME: path.join(path.dirname(workspace), "home"),
      USERPROFILE: path.join(path.dirname(workspace), "home"),
    },
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
  const timeout = setTimeout(() => child.kill(), 30_000);
  try {
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    assert.equal(stderr, "", `unexpected stderr for ${args.join(" ")}`);
    assert.ok(stdout.endsWith("\n"), `missing JSON framing for ${args.join(" ")}`);
    assert.equal(
      stdout.slice(0, -1).includes("\n"),
      false,
      `streamed output for ${args.join(" ")}`,
    );
    const envelope = JSON.parse(stdout) as JsonEnvelope;
    assert.equal(exitCode, 0, stdout);
    assert.equal(envelope.exitCode, exitCode, stdout);
    assert.equal(envelope.ok, true, stdout);
    return envelope;
  } finally {
    clearTimeout(timeout);
  }
}

function resultValue<T>(envelope: JsonEnvelope): T {
  assert.equal(typeof envelope.result, "object");
  assert.notEqual(envelope.result, null);
  const result = envelope.result as { readonly ok?: unknown; readonly value?: unknown };
  assert.equal(result.ok, true, JSON.stringify(envelope));
  return result.value as T;
}

function validatedPage<T>(
  rawValue: unknown,
  expectedGeneration: number | undefined,
  seenCursors: Set<string>,
  label: string,
): { readonly generation: number; readonly items: readonly T[]; readonly nextCursor?: string } {
  assert.equal(typeof rawValue, "object", `${label} page result must be an object`);
  assert.notEqual(rawValue, null, `${label} page result must not be null`);
  const value = rawValue as {
    readonly generation?: unknown;
    readonly hasMore?: unknown;
    readonly items?: unknown;
    readonly nextCursor?: unknown;
  };
  assert.equal(typeof value.generation, "number", `${label} page generation must be a number`);
  const generation = value.generation as number;
  assert.ok(
    Number.isSafeInteger(generation) && generation >= 0,
    `${label} page generation must be a nonnegative safe integer`,
  );
  if (expectedGeneration !== undefined) {
    assert.equal(generation, expectedGeneration, `${label} pages changed generation`);
  }
  assert.ok(Array.isArray(value.items), `${label} page items must be an array`);
  const items = value.items as readonly T[];
  assert.ok(items.length <= pageLimit, `${label} page exceeded requested limit ${pageLimit}`);
  assert.equal(typeof value.hasMore, "boolean", `${label} page hasMore must be boolean`);
  const hasMore = value.hasMore as boolean;
  const hasCursor = value.nextCursor !== undefined;
  assert.equal(hasMore, hasCursor, `${label} page cursor contract diverged`);
  if (!hasMore) return Object.freeze({ generation, items });

  assert.ok(items.length > 0, `${label} page cannot continue without items`);
  assert.equal(typeof value.nextCursor, "string", `${label} next cursor must be a string`);
  const nextCursor = value.nextCursor as string;
  assert.ok(nextCursor.trim().length > 0, `${label} next cursor must not be empty`);
  assert.equal(
    seenCursors.has(nextCursor),
    false,
    `${label} next cursor repeated or formed a cycle`,
  );
  seenCursors.add(nextCursor);
  return Object.freeze({ generation, items, nextCursor });
}

async function exportAll(executable: string, workspace: string): Promise<PagedItems<ExportItem>> {
  const items: ExportItem[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  let generation: number | undefined;
  let pageRequests = 0;
  do {
    assert.ok(
      pageRequests < testHarnessPageRequestLimit,
      `paged export exceeded test-harness limit of ${testHarnessPageRequestLimit} page requests`,
    );
    pageRequests += 1;
    const envelope = await command(executable, workspace, [
      "blueprint",
      "export",
      "--limit",
      String(pageLimit),
      ...(cursor === undefined ? [] : ["--cursor", cursor]),
    ]);
    const page = validatedPage<ExportItem>(
      resultValue<unknown>(envelope),
      generation,
      seenCursors,
      "paged export",
    );
    generation ??= page.generation;
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor !== undefined);
  assert.notEqual(generation, undefined, "paged export did not return a generation");
  return Object.freeze({ generation, items: Object.freeze(items) });
}

async function rootIdsAll(executable: string, workspace: string): Promise<PagedItems<string>> {
  const ids: string[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  let generation: number | undefined;
  let pageRequests = 0;
  do {
    assert.ok(
      pageRequests < testHarnessPageRequestLimit,
      `paged roots exceeded test-harness limit of ${testHarnessPageRequestLimit} page requests`,
    );
    pageRequests += 1;
    const envelope = await command(executable, workspace, [
      "component",
      "roots",
      "--limit",
      String(pageLimit),
      ...(cursor === undefined ? [] : ["--cursor", cursor]),
    ]);
    const page = validatedPage<{ readonly component: Component }>(
      resultValue<unknown>(envelope),
      generation,
      seenCursors,
      "paged roots",
    );
    generation ??= page.generation;
    ids.push(...page.items.map((item) => item.component.id));
    cursor = page.nextCursor;
  } while (cursor !== undefined);
  assert.notEqual(generation, undefined, "paged roots did not return a generation");
  return Object.freeze({ generation, items: Object.freeze(ids) });
}

async function canonicalSnapshot(
  root: string,
): Promise<readonly { path: string; sha256: string }[]> {
  const entries: Array<{ path: string; sha256: string }> = [];
  const visit = async (directory: string): Promise<void> => {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) => compareText(left.name, right.name));
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
  return entries;
}

async function requireMissing(candidate: string): Promise<void> {
  try {
    await lstat(candidate);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error(`${candidate} unexpectedly exists`);
}

function integrityAudit(items: readonly ExportItem[]): BaselineSummary {
  const ordered = [...items].sort((left, right) =>
    compareText(left.component.id, right.component.id),
  );
  const components = ordered.map((item) => item.component);
  assert.ok(components.length > 0, "self-blueprint must contain a component");
  assert.equal(
    components.every((component) => typeof component.id === "string" && component.id.length > 0),
    true,
    "component identities must be nonempty strings",
  );
  assert.equal(
    new Set(components.map((component) => component.id)).size,
    components.length,
    "component identities must be unique",
  );
  assert.equal(
    components.every((component) => component.kind === "component"),
    true,
    "every canonical entity must be a component",
  );
  const intentCount = components.filter(
    (component) => typeof component.intent === "string" && component.intent.trim().length > 0,
  ).length;
  assert.equal(
    intentCount,
    components.length,
    "every self-blueprint component must have nonempty intent",
  );

  const seeds = components.map((component) => ({
    id: component.id,
    seed: component.extensions["groma.md/seed-key"],
  }));
  const roots = components
    .filter((component) => component.parent === undefined)
    .map((component) => ({
      id: component.id,
      seed: component.extensions["groma.md/seed-key"],
      type: component.type,
    }));
  assert.ok(roots.length > 0, "self-blueprint containment must have at least one root");
  const parents = components
    .filter((component) => component.parent !== undefined)
    .map((component) => ({ id: component.id, parent: component.parent }));
  const componentIds = new Set(components.map((component) => component.id));
  assert.equal(
    parents.every((entry) => componentIds.has(entry.parent!)),
    true,
    "every structural parent must resolve to a component",
  );
  const parentById = new Map(parents.map((entry) => [entry.id, entry.parent!]));
  for (const component of components) {
    const seen = new Set<string>();
    let current = component.id;
    while (true) {
      assert.equal(seen.has(current), false, `containment cycle reaches ${current}`);
      seen.add(current);
      const parent = parentById.get(current);
      if (parent === undefined) break;
      current = parent;
    }
  }

  const embeddedItems = components
    .flatMap((component) =>
      (["inputs", "outputs", "actions"] as const).flatMap((category) =>
        (component[category] ?? []).map((item) => ({ category, component: component.id, item })),
      ),
    )
    .sort((left, right) => compareText(left.item.id, right.item.id));
  const inputCount = components.reduce(
    (total, component) => total + (component.inputs?.length ?? 0),
    0,
  );
  const outputCount = components.reduce(
    (total, component) => total + (component.outputs?.length ?? 0),
    0,
  );
  const actionCount = components.reduce(
    (total, component) => total + (component.actions?.length ?? 0),
    0,
  );
  assert.equal(
    embeddedItems.every((entry) => typeof entry.item.id === "string" && entry.item.id.length > 0),
    true,
    "embedded item identities must be nonempty strings",
  );
  assert.equal(
    new Set(embeddedItems.map((entry) => entry.item.id)).size,
    embeddedItems.length,
    "embedded item identities must be unique",
  );

  const declarations = components
    .flatMap((component) =>
      (component.extensions["groma.md/relationship-declarations"] ?? []).map((declaration) => ({
        component: component.id,
        declaration,
      })),
    )
    .sort((left, right) => compareText(left.declaration.key, right.declaration.key));
  const mutableStatusCounts: Record<DeclarationStatus, number> = {
    ambiguous: 0,
    constraint: 0,
    edge: 0,
    partial: 0,
  };
  for (const { declaration } of declarations) {
    assert.ok(
      declarationStatuses.includes(declaration.status),
      `unsupported declaration status: ${String(declaration.status)}`,
    );
    assert.ok(
      typeof declaration.key === "string" && declaration.key.length > 0,
      "declaration keys must be nonempty strings",
    );
    assert.ok(
      typeof declaration.text === "string" && declaration.text.length > 0,
      `${declaration.key} must preserve nonempty declaration text`,
    );
    mutableStatusCounts[declaration.status] += 1;
  }
  const statusCounts = Object.freeze({ ...mutableStatusCounts });
  assert.equal(
    new Set(declarations.map((entry) => entry.declaration.key)).size,
    declarations.length,
    "declaration keys must be unique",
  );

  const edges = ordered
    .flatMap((item) => item.relationships)
    .sort((left, right) => compareText(left.id, right.id));
  assert.equal(
    edges.every((edge) => typeof edge.id === "string" && edge.id.length > 0),
    true,
    "relationship identities must be nonempty strings",
  );
  assert.equal(
    new Set(edges.map((edge) => edge.id)).size,
    edges.length,
    "relationship identities must be unique",
  );
  assert.equal(
    edges.every((edge) => edge.type === "relates-to"),
    true,
    "self-blueprint declaration edges must use neutral relates-to type",
  );
  assert.equal(
    edges.every((edge) => componentIds.has(edge.source) && componentIds.has(edge.target)),
    true,
    "relationship endpoints must resolve to components",
  );
  assert.equal(
    ordered.every((item) =>
      item.relationships.every((relationship) => relationship.source === item.component.id),
    ),
    true,
    "exported relationships must be owned by their source component",
  );
  const edgesById = new Map(edges.map((edge) => [edge.id, edge]));
  const declaredEdgeIds: string[] = [];
  for (const { component, declaration } of declarations) {
    if (declaration.status !== "edge" && declaration.status !== "partial") {
      assert.equal(declaration.edgeIds, undefined);
      continue;
    }
    assert.ok(
      Array.isArray(declaration.edgeIds) && declaration.edgeIds.length > 0,
      `${declaration.key} must reference at least one edge`,
    );
    for (const edgeId of declaration.edgeIds) {
      assert.equal(typeof edgeId, "string", `${declaration.key} has a malformed edge ID`);
      const edge = edgesById.get(edgeId);
      assert.notEqual(edge, undefined, `${declaration.key} references missing edge ${edgeId}`);
      assert.equal(edge!.source, component);
      assert.equal(edge!.description, declaration.text);
      declaredEdgeIds.push(edgeId);
    }
  }
  assert.deepEqual(
    declaredEdgeIds.sort(compareText),
    edges.map((edge) => edge.id).sort(compareText),
  );

  const digests = Object.freeze({
    declarations: digest(declarations),
    edges: digest(edges),
    embeddedItems: digest(embeddedItems),
    export: digest(ordered),
    parents: digest(parents),
    roots: digest(roots),
    seeds: digest(seeds),
  });
  return Object.freeze({
    counts: Object.freeze({
      actions: actionCount,
      components: components.length,
      declarations: declarations.length,
      edges: edges.length,
      embeddedItems: embeddedItems.length,
      inputs: inputCount,
      intents: intentCount,
      outputs: outputCount,
      roots: roots.length,
    }),
    digests,
    statusCounts,
  });
}

function assertExpectedBaseline(summary: BaselineSummary): void {
  assert.deepEqual(summary, expectedBaseline);
}

async function exerciseReportBaselineWithSupportedEdit(
  executable: string,
  temporaryRoot: string,
  sourceSummary: BaselineSummary,
): Promise<void> {
  const workspace = path.join(temporaryRoot, "report-count-change");
  const canonicalRoot = path.join(workspace, "groma");
  const cacheRoot = path.join(workspace, ".groma-cache");
  await cp(path.join(projectRoot, "groma"), canonicalRoot, { recursive: true });
  await command(
    executable,
    workspace,
    ["component", "create", "--stdin"],
    JSON.stringify({
      component: {
        intent: "Prove that baseline reporting accepts a supported architecture count change.",
        name: "Baseline report regression probe",
        type: "domain",
      },
    }),
  );
  const afterEdit = await canonicalSnapshot(canonicalRoot);
  const changed = await exportAll(executable, workspace);
  const changedSummary = integrityAudit(changed.items);
  assert.equal(changedSummary.counts.components, sourceSummary.counts.components + 1);
  assert.equal(changedSummary.counts.roots, sourceSummary.counts.roots + 1);
  assert.notDeepEqual(changedSummary, sourceSummary);
  await lstat(path.join(cacheRoot, "projection-index.json"));

  await rm(cacheRoot, { force: true, recursive: true });
  await requireMissing(cacheRoot);
  const rebuilt = await exportAll(executable, workspace);
  assert.equal(
    rebuilt.generation,
    changed.generation,
    "report edit projection rebuild changed generation",
  );
  assert.equal(canonicalJson(rebuilt.items), canonicalJson(changed.items));
  assert.deepEqual(integrityAudit(rebuilt.items), changedSummary);
  assert.deepEqual(await canonicalSnapshot(canonicalRoot), afterEdit);
}

const options = optionsFrom(Bun.argv.slice(2));
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "groma-self-blueprint-verify-"));
try {
  const sourceCanonicalRoot = path.join(projectRoot, "groma");
  const sourceBefore = await canonicalSnapshot(sourceCanonicalRoot);
  const workspace = path.join(temporaryRoot, "workspace");
  const canonicalRoot = path.join(workspace, "groma");
  const cacheRoot = path.join(workspace, ".groma-cache");
  await mkdir(path.join(temporaryRoot, "home"));
  await cp(path.join(projectRoot, "groma"), canonicalRoot, { recursive: true });
  const before = await canonicalSnapshot(canonicalRoot);
  await requireMissing(cacheRoot);

  const first = await exportAll(options.executable, workspace);
  const firstSummary = integrityAudit(first.items);
  if (!options.reportBaseline) assertExpectedBaseline(firstSummary);
  await lstat(path.join(cacheRoot, "projection-index.json"));

  const roots = await rootIdsAll(options.executable, workspace);
  assert.equal(roots.generation, first.generation, "root read generation differed from export");
  assert.deepEqual(
    [...roots.items].sort(compareText),
    first.items
      .filter((item) => item.component.parent === undefined)
      .map((item) => item.component.id)
      .sort(compareText),
  );

  await rm(cacheRoot, { force: true, recursive: true });
  await requireMissing(cacheRoot);
  const rebuilt = await exportAll(options.executable, workspace);
  assert.equal(rebuilt.generation, first.generation, "projection rebuild changed generation");
  assert.equal(canonicalJson(rebuilt.items), canonicalJson(first.items));
  assert.deepEqual(integrityAudit(rebuilt.items), firstSummary);
  await lstat(path.join(cacheRoot, "projection-index.json"));
  assert.deepEqual(await canonicalSnapshot(canonicalRoot), before);

  if (options.reportBaseline) {
    await exerciseReportBaselineWithSupportedEdit(options.executable, temporaryRoot, firstSummary);
    console.log(JSON.stringify({ mode: "report-baseline", ...firstSummary }));
  } else {
    const { counts } = firstSummary;
    console.log(
      `Self-blueprint verified: ${counts.components} components, ${counts.roots} roots, ` +
        `${counts.embeddedItems} embedded items, ${counts.declarations} declarations, ` +
        `${counts.edges} edges.`,
    );
  }
  assert.deepEqual(await canonicalSnapshot(sourceCanonicalRoot), sourceBefore);
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}
