import { mkdtemp, mkdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

interface VerificationOptions {
  readonly executable: string;
  readonly skipRun: boolean;
}

function parseOptions(args: readonly string[]): VerificationOptions {
  let executable: string | undefined;
  let skipRun = false;
  for (const argument of args) {
    if (argument === "--skip-run") skipRun = true;
    else if (argument.startsWith("--executable=")) executable = argument.slice(13);
    else throw new Error("Usage: verify-binary [--executable=<path>] [--skip-run]");
  }
  return {
    executable: path.resolve(
      projectRoot,
      executable ?? path.join("dist", process.platform === "win32" ? "groma.exe" : "groma"),
    ),
    skipRun,
  };
}

async function run(executable: string, args: readonly string[], cwd = projectRoot): Promise<void> {
  const child = Bun.spawn({
    cmd: [executable, ...args],
    cwd,
    stderr: "inherit",
    stdout: "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) throw new Error(`${path.basename(executable)} ${args.join(" ")} failed`);
}

async function runJson(
  executable: string,
  args: readonly string[],
  cwd: string,
): Promise<Record<string, unknown>> {
  const child = Bun.spawn({
    cmd: [executable, "--format=json", ...args],
    cwd,
    stderr: "inherit",
    stdout: "pipe",
  });
  const output = await new Response(child.stdout).text();
  const exitCode = await child.exited;
  if (exitCode !== 0) throw new Error(`${path.basename(executable)} ${args.join(" ")} failed`);
  const parsed = JSON.parse(output);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${path.basename(executable)} ${args.join(" ")} returned invalid JSON`);
  }
  return parsed as Record<string, unknown>;
}

async function runInteractiveJson(
  executable: string,
  cwd: string,
): Promise<Record<string, unknown>> {
  const chunks: Uint8Array[] = [];
  const terminal = new Bun.Terminal({
    cols: 4_096,
    data: (_terminal, data) => chunks.push(data.slice()),
    rows: 40,
  });
  try {
    const child = Bun.spawn({
      cmd: [executable, "--format=json"],
      cwd,
      terminal,
    });
    const timeout = setTimeout(() => child.kill(), 15_000);
    try {
      const exitCode = await child.exited;
      if (exitCode !== 0) throw new Error(`${path.basename(executable)} overview failed`);
    } finally {
      clearTimeout(timeout);
    }
  } finally {
    terminal.close();
  }
  const output = stripVTControlCharacters(new TextDecoder().decode(Buffer.concat(chunks)))
    .replaceAll("\r", "")
    .trim();
  const parsed = JSON.parse(output);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${path.basename(executable)} overview returned invalid JSON`);
  }
  return parsed as Record<string, unknown>;
}

const options = parseOptions(Bun.argv.slice(2));
const artifact = await stat(options.executable);
if (!artifact.isFile() || artifact.size === 0) throw new Error("Executable artifact is empty");

if (!options.skipRun) {
  await run(options.executable, ["--version"]);
  await run(options.executable, ["--help"]);
  const root = await mkdtemp(path.join(tmpdir(), "groma-smoke-"));
  const workspace = path.join(root, "workspace");
  await mkdir(path.join(workspace, "src"), { recursive: true });
  await writeFile(path.join(workspace, "package.json"), JSON.stringify({ name: "groma-smoke" }));
  await writeFile(
    path.join(workspace, "src", "index.ts"),
    "export function inspectArchitecture() { return 'ready'; }\n",
  );
  await runJson(options.executable, ["init"], workspace);
  const scan = await runJson(options.executable, ["scan"], workspace);
  const scanResult = scan.result as Record<string, unknown> | undefined;
  if (scan.ok !== true || scanResult?.status !== "completed") {
    throw new Error("Compiled scan workflow did not complete");
  }
  const components = await runJson(
    options.executable,
    ["component", "list", "--limit", "10"],
    workspace,
  );
  const componentResult = components.result as
    { readonly ok?: unknown; readonly value?: { readonly items?: unknown[] } } | undefined;
  if (
    components.ok !== true ||
    componentResult?.ok !== true ||
    !Array.isArray(componentResult.value?.items) ||
    componentResult.value.items.length === 0
  ) {
    throw new Error("Compiled scan workflow did not produce a blueprint component");
  }
  const overview = await runInteractiveJson(options.executable, workspace);
  const overviewResult = overview.result as
    | { readonly kind?: unknown; readonly nodes?: readonly { readonly displayText?: unknown }[] }
    | undefined;
  if (
    overview.ok !== true ||
    overviewResult?.kind !== "hierarchy" ||
    !Array.isArray(overviewResult.nodes) ||
    overviewResult.nodes.length === 0 ||
    overviewResult.nodes.length > 256 ||
    !overviewResult.nodes.some((node) => node.displayText === "groma-smoke")
  ) {
    throw new Error("Compiled visual overview was not bounded or evidence-grounded");
  }
}
