import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { compileStandalone } from "./standalone-compiler.ts";

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

const exitCode = await compileStandalone({
  cwd: projectRoot,
  entrypoint,
  outputFile,
  ...(target === undefined ? {} : { target }),
});
if (exitCode !== 0) {
  process.exit(exitCode);
}

console.log(`Compiled ${target ?? "native"} executable: ${outputFile}`);
