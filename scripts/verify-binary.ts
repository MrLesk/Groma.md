import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const outputDirectory = path.join(projectRoot, "dist");

interface VerificationOptions {
  readonly executable: string;
  readonly skipRun: boolean;
}

function parseOptions(args: readonly string[]): VerificationOptions {
  let executable: string | undefined;
  let skipRun = false;

  for (const argument of args) {
    if (argument === "--skip-run") {
      skipRun = true;
    } else if (argument.startsWith("--executable=")) {
      executable = argument.slice("--executable=".length);
      if (executable.length === 0) {
        throw new Error("Executable path must not be empty");
      }
    } else {
      throw new Error("Usage: bun run scripts/verify-binary.ts [--executable=<path>] [--skip-run]");
    }
  }

  return {
    executable: path.resolve(
      projectRoot,
      executable ?? path.join("dist", process.platform === "win32" ? "groma.exe" : "groma"),
    ),
    skipRun,
  };
}

async function run(executable: string, argument: "--help" | "--version"): Promise<void> {
  const process = Bun.spawn({
    cmd: [executable, argument],
    cwd: projectRoot,
    stderr: "inherit",
    stdout: "inherit",
  });
  const exitCode = await process.exited;
  if (exitCode !== 0) {
    throw new Error(`${path.basename(executable)} ${argument} exited with code ${exitCode}`);
  }
}

const options = parseOptions(Bun.argv.slice(2));
const outputFiles = (await readdir(outputDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => path.join(outputDirectory, entry.name));

if (outputFiles.length !== 1 || outputFiles[0] !== options.executable) {
  throw new Error(
    `Expected exactly ${options.executable}; found ${outputFiles.length === 0 ? "no files" : outputFiles.join(", ")}`,
  );
}

if (!options.skipRun) {
  await run(options.executable, "--version");
  await run(options.executable, "--help");
}
console.log(
  `${options.skipRun ? "Verified cross-compiled" : "Verified runnable"} standalone executable: ${options.executable}`,
);
