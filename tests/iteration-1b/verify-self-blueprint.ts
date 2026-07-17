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
const expectedDigests = Object.freeze({
  declarations: "3f3146e2577205dee18fecd97d098602e964822cb3649ecfa3fb2778890b87a5",
  edges: "eff6c85eea18f19b89299b05c00e180e5d84c2df465eedf97d116d8f9eee2981",
  embeddedItems: "76551c8739a13767d01eef6459cae01a49f5ddc8e02d0bc37a40b50fdd1053bc",
  export: "e1106839b6897eec3c0cdc013b891a778c56ed503bc2bd62d41959a956804d54",
  parents: "196e03f6931485dfd821e56352c97bae249d6adce41754b99a98066af0d8e532",
  roots: "4d67f79c129d2b67be1284d4e46eae94d1c74f6ce94f9537059f479bb82d232a",
  seeds: "9a6b8c55f6f9147d94be1b16d86d58946b6fbd940f1652b507b68571f4f45e14",
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
  readonly status: "ambiguous" | "constraint" | "edge";
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

function executableFrom(args: readonly string[]): string {
  if (args.length === 0) return defaultExecutable;
  if (args.length === 1 && args[0]?.startsWith("--executable=")) {
    const value = args[0].slice("--executable=".length);
    assert.notEqual(value, "", "--executable requires a path");
    return path.resolve(projectRoot, value);
  }
  throw new Error(
    "Usage: bun run tests/iteration-1b/verify-self-blueprint.ts [--executable=<path>]",
  );
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
    stdout: "pipe",
  });
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

async function exportAll(executable: string, workspace: string): Promise<readonly ExportItem[]> {
  const items: ExportItem[] = [];
  let cursor: string | undefined;
  let generation: number | undefined;
  do {
    const envelope = await command(executable, workspace, [
      "blueprint",
      "export",
      "--limit",
      "7",
      ...(cursor === undefined ? [] : ["--cursor", cursor]),
    ]);
    const value = resultValue<{
      readonly generation: number;
      readonly hasMore: boolean;
      readonly items: readonly ExportItem[];
      readonly nextCursor?: string;
    }>(envelope);
    generation ??= value.generation;
    assert.equal(value.generation, generation, "paged export changed generation");
    items.push(...value.items);
    cursor = value.nextCursor;
    assert.equal(value.hasMore, cursor !== undefined, "paged export cursor contract diverged");
  } while (cursor !== undefined);
  return items;
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

function exactAudit(items: readonly ExportItem[]): void {
  const ordered = [...items].sort((left, right) =>
    compareText(left.component.id, right.component.id),
  );
  const components = ordered.map((item) => item.component);
  assert.equal(components.length, 43);
  assert.equal(new Set(components.map((component) => component.id)).size, 43);

  const seeds = components.map((component) => ({
    id: component.id,
    seed: component.extensions["groma.md/seed-key"],
  }));
  assert.equal(
    seeds.every((entry) => typeof entry.seed === "string"),
    true,
  );
  assert.equal(new Set(seeds.map((entry) => entry.seed)).size, 43);

  const roots = components
    .filter((component) => component.parent === undefined)
    .map((component) => ({
      id: component.id,
      seed: component.extensions["groma.md/seed-key"],
      type: component.type,
    }));
  assert.equal(roots.length, 9);
  assert.equal(
    roots.every((root) => root.type === "domain"),
    true,
  );
  const parents = components
    .filter((component) => component.parent !== undefined)
    .map((component) => ({ id: component.id, parent: component.parent }));
  assert.equal(parents.length, 34);
  const componentIds = new Set(components.map((component) => component.id));
  assert.equal(
    parents.every((entry) => componentIds.has(entry.parent!)),
    true,
  );
  assert.equal(
    roots.every((root) => {
      const component = components.find((candidate) => candidate.id === root.id)!;
      return component.extensions["groma.md/first-delivery"] === undefined;
    }),
    true,
  );
  assert.equal(
    components.filter(
      (component) => typeof component.extensions["groma.md/first-delivery"] === "string",
    ).length,
    34,
  );

  for (const component of components) {
    assert.equal(component.kind, "component");
    assert.equal(component.label, undefined);
    assert.equal(component.summary, undefined);
    assert.equal(component.iconDomain, undefined);
    assert.equal(component.lifecycle, undefined);
    assert.equal(component.desired, undefined);
  }

  const embeddedItems = components
    .flatMap((component) =>
      (["inputs", "outputs", "actions"] as const).flatMap((category) =>
        (component[category] ?? []).map((item) => ({ category, component: component.id, item })),
      ),
    )
    .sort((left, right) => compareText(left.item.id, right.item.id));
  assert.equal(
    components.reduce((total, component) => total + (component.inputs?.length ?? 0), 0),
    129,
  );
  assert.equal(
    components.reduce((total, component) => total + (component.outputs?.length ?? 0), 0),
    111,
  );
  assert.equal(
    components.reduce((total, component) => total + (component.actions?.length ?? 0), 0),
    158,
  );
  assert.equal(embeddedItems.length, 398);
  assert.equal(new Set(embeddedItems.map((entry) => entry.item.id)).size, 398);

  const declarations = components
    .flatMap((component) =>
      (component.extensions["groma.md/relationship-declarations"] ?? []).map((declaration) => ({
        component: component.id,
        declaration,
      })),
    )
    .sort((left, right) => compareText(left.declaration.key, right.declaration.key));
  assert.equal(declarations.length, 87);
  assert.deepEqual(
    Object.fromEntries(
      ["edge", "constraint", "ambiguous"].map((status) => [
        status,
        declarations.filter((entry) => entry.declaration.status === status).length,
      ]),
    ),
    { ambiguous: 17, constraint: 17, edge: 53 },
  );
  assert.equal(new Set(declarations.map((entry) => entry.declaration.key)).size, 87);

  const edges = ordered
    .flatMap((item) => item.relationships)
    .sort((left, right) => compareText(left.id, right.id));
  assert.equal(edges.length, 85);
  assert.equal(new Set(edges.map((edge) => edge.id)).size, 85);
  assert.equal(
    edges.every((edge) => edge.type === "relates-to"),
    true,
  );
  assert.equal(
    edges.every((edge) => componentIds.has(edge.source) && componentIds.has(edge.target)),
    true,
  );
  const edgesById = new Map(edges.map((edge) => [edge.id, edge]));
  const declaredEdgeIds: string[] = [];
  for (const { component, declaration } of declarations) {
    if (declaration.status !== "edge") {
      assert.equal(declaration.edgeIds, undefined);
      continue;
    }
    assert.ok(Array.isArray(declaration.edgeIds) && declaration.edgeIds.length > 0);
    for (const edgeId of declaration.edgeIds) {
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

  assert.deepEqual(
    {
      declarations: digest(declarations),
      edges: digest(edges),
      embeddedItems: digest(embeddedItems),
      export: digest(ordered),
      parents: digest(parents),
      roots: digest(roots),
      seeds: digest(seeds),
    },
    expectedDigests,
  );
}

const executable = executableFrom(Bun.argv.slice(2));
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "groma-self-blueprint-verify-"));
try {
  const workspace = path.join(temporaryRoot, "workspace");
  const canonicalRoot = path.join(workspace, "groma");
  const cacheRoot = path.join(workspace, ".groma-cache");
  await mkdir(path.join(temporaryRoot, "home"));
  await cp(path.join(projectRoot, "groma"), canonicalRoot, { recursive: true });
  const before = await canonicalSnapshot(canonicalRoot);
  await requireMissing(cacheRoot);

  const first = await exportAll(executable, workspace);
  exactAudit(first);
  await lstat(path.join(cacheRoot, "projection-index.json"));

  const rootEnvelope = await command(executable, workspace, [
    "component",
    "roots",
    "--limit",
    "100",
  ]);
  const rootItems = resultValue<{
    readonly hasMore: boolean;
    readonly items: readonly { readonly component: Component }[];
  }>(rootEnvelope);
  assert.equal(rootItems.hasMore, false);
  assert.deepEqual(
    rootItems.items.map((item) => item.component.id).sort(compareText),
    first
      .filter((item) => item.component.parent === undefined)
      .map((item) => item.component.id)
      .sort(compareText),
  );

  await rm(cacheRoot, { force: true, recursive: true });
  await requireMissing(cacheRoot);
  const rebuilt = await exportAll(executable, workspace);
  assert.equal(canonicalJson(rebuilt), canonicalJson(first));
  exactAudit(rebuilt);
  await lstat(path.join(cacheRoot, "projection-index.json"));
  assert.deepEqual(await canonicalSnapshot(canonicalRoot), before);

  console.log(
    "Self-blueprint verified: 43 components, 9 roots, 398 embedded items, 87 declarations, 85 edges.",
  );
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}
