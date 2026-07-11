import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const outputDirectory = path.join(projectRoot, "dist");
const entrypoint = path.join(projectRoot, "src", "cli", "main.ts");

function parseTarget(args: readonly string[]): string | undefined {
  if (args.length === 0) {
    return undefined;
  }

  if (args.length !== 1 || !args[0]?.startsWith("--target=")) {
    throw new Error("Usage: bun run build [--target=<bun-compile-target>]");
  }

  const target = args[0].slice("--target=".length);
  if (target.length === 0) {
    throw new Error("Build target must not be empty");
  }

  return target;
}

const target = parseTarget(Bun.argv.slice(2));
const isWindows =
  target === undefined ? process.platform === "win32" : target.startsWith("bun-windows-");
const outputFile = path.join(outputDirectory, isWindows ? "groma.exe" : "groma");

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

const command = [
  process.execPath,
  "build",
  "--compile",
  "--minify",
  "--reject-unresolved",
  "--no-compile-autoload-dotenv",
  "--no-compile-autoload-bunfig",
  "--no-compile-autoload-tsconfig",
  "--no-compile-autoload-package-json",
  ...(target === undefined ? [] : [`--target=${target}`]),
  `--outfile=${outputFile}`,
  entrypoint,
];

const build = Bun.spawn({
  cmd: command,
  cwd: projectRoot,
  stderr: "inherit",
  stdout: "inherit",
});

const exitCode = await build.exited;
if (exitCode !== 0) {
  process.exit(exitCode);
}

console.log(`Compiled ${target ?? "native"} executable: ${outputFile}`);
