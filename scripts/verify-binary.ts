import { mkdtemp, mkdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

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
}
