import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileStandalone } from "./standalone-compiler.ts";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const outputDirectory = path.join(projectRoot, "dist");
const entrypoint = path.join(projectRoot, "src", "cli", "main.ts");

const targets = Object.freeze([
  Object.freeze({
    architecture: "arm64",
    file: "groma-darwin-arm64",
    platform: "darwin",
    target: "bun-darwin-arm64",
  }),
  Object.freeze({
    architecture: "x64",
    file: "groma-linux-x64",
    platform: "linux",
    target: "bun-linux-x64-baseline",
  }),
  Object.freeze({
    architecture: "arm64",
    file: "groma-windows-arm64.exe",
    platform: "win32",
    target: "bun-windows-arm64",
  }),
  Object.freeze({
    architecture: "x64",
    file: "groma-windows-x64.exe",
    platform: "win32",
    target: "bun-windows-x64-baseline",
  }),
] as const);

async function run(command: readonly string[]): Promise<void> {
  const child = Bun.spawn({
    cmd: [...command],
    cwd: projectRoot,
    stderr: "inherit",
    stdout: "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) throw new Error(`${command.join(" ")} exited with code ${exitCode}`);
}

async function sha256(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

const artifactNames = targets.map(({ file }) => file);
if (new Set(artifactNames).size !== targets.length) {
  throw new Error("Package targets must have unique artifact names");
}
if (artifactNames.join("\n") !== artifactNames.toSorted().join("\n")) {
  throw new Error("Package targets must stay sorted by artifact name");
}

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

let hostArtifact: string | undefined;
for (const target of targets) {
  const outputFile = path.join(outputDirectory, target.file);
  const exitCode = await compileStandalone({
    cwd: projectRoot,
    entrypoint,
    outputFile,
    target: target.target,
  });
  if (exitCode !== 0) process.exit(exitCode);

  const built = await stat(outputFile);
  if (!built.isFile() || built.size === 0) {
    throw new Error(`${target.target} did not produce an executable`);
  }
  await run([
    process.execPath,
    "run",
    "scripts/verify-binary.ts",
    `--executable=${path.relative(projectRoot, outputFile)}`,
    ...(process.platform === target.platform && process.arch === target.architecture
      ? []
      : ["--skip-run"]),
  ]);
  if (process.platform === target.platform && process.arch === target.architecture) {
    hostArtifact = outputFile;
  }
}

const checksumLines = await Promise.all(
  targets.map(async ({ file }) => `${await sha256(path.join(outputDirectory, file))}  ${file}`),
);
await writeFile(path.join(outputDirectory, "SHA256SUMS"), `${checksumLines.join("\n")}\n`);

if (hostArtifact !== undefined) {
  await run([
    process.execPath,
    "run",
    "tests/iteration-1a/verify.ts",
    `--executable=${path.relative(projectRoot, hostArtifact)}`,
    "--skip-crash",
  ]);
}

console.log(
  hostArtifact === undefined
    ? `Packaged ${targets.length} standalone targets; none matched ${process.platform}-${process.arch}.`
    : `Packaged ${targets.length} standalone targets and verified ${path.basename(hostArtifact)} through the compiled workflow.`,
);
