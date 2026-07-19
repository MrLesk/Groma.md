import { mkdtemp, mkdir, stat } from "node:fs/promises";
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

const options = parseOptions(Bun.argv.slice(2));
const artifact = await stat(options.executable);
if (!artifact.isFile() || artifact.size === 0) throw new Error("Executable artifact is empty");

if (!options.skipRun) {
  await run(options.executable, ["--version"]);
  await run(options.executable, ["--help"]);
  const root = await mkdtemp(path.join(tmpdir(), "groma-smoke-"));
  const workspace = path.join(root, "workspace");
  await mkdir(workspace);
  await run(options.executable, ["--format", "json", "init"], workspace);
}
