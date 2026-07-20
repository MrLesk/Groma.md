import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
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
    npmName: "groma.md-darwin-arm64",
    npmBinary: "groma",
    platform: "darwin",
    target: "bun-darwin-arm64",
  }),
  Object.freeze({
    architecture: "x64",
    file: "groma-linux-x64",
    npmName: "groma.md-linux-x64",
    npmBinary: "groma",
    platform: "linux",
    target: "bun-linux-x64-baseline",
  }),
  Object.freeze({
    architecture: "arm64",
    file: "groma-windows-arm64.exe",
    npmName: "groma.md-windows-arm64",
    npmBinary: "groma.exe",
    platform: "win32",
    target: "bun-windows-arm64",
  }),
  Object.freeze({
    architecture: "x64",
    file: "groma-windows-x64.exe",
    npmName: "groma.md-windows-x64",
    npmBinary: "groma.exe",
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

/**
 * Assemble the groma.md npm distribution the way backlog.md ships: a main package
 * whose Node shim resolves one os/cpu-constrained platform package carrying the
 * compiled binary. Packages are generated and packed under dist/npm; publishing
 * them to the registry is a separate explicit step.
 */
const packageVersion = (
  (await Bun.file(path.join(projectRoot, "package.json")).json()) as {
    readonly version: string;
  }
).version;
const npmDirectory = path.join(outputDirectory, "npm");
await mkdir(npmDirectory, { recursive: true });

async function packTarball(packageDirectory: string): Promise<string> {
  const npm = Bun.which("npm");
  if (npm === null) throw new Error("npm is required to pack the distribution");
  const pack = Bun.spawn({
    cmd: [npm, "pack", "--pack-destination", npmDirectory],
    cwd: packageDirectory,
    stderr: "inherit",
    stdout: "pipe",
  });
  const output = (await new Response(pack.stdout).text()).trim();
  if ((await pack.exited) !== 0) throw new Error(`npm pack failed for ${packageDirectory}`);
  const tarball = output.split("\n").at(-1);
  if (tarball === undefined || tarball.length === 0) {
    throw new Error(`npm pack reported no tarball for ${packageDirectory}`);
  }
  return path.join(npmDirectory, tarball);
}

let hostTarball: string | undefined;
for (const target of targets) {
  const packageDirectory = path.join(npmDirectory, target.npmName);
  await mkdir(packageDirectory, { recursive: true });
  await copyFile(
    path.join(outputDirectory, target.file),
    path.join(packageDirectory, target.npmBinary),
  );
  await writeFile(
    path.join(packageDirectory, "package.json"),
    `${JSON.stringify(
      {
        name: target.npmName,
        version: packageVersion,
        description: `groma.md compiled executable for ${target.platform}-${target.architecture}`,
        os: [target.platform],
        cpu: [target.architecture],
        files: [target.npmBinary, "package.json"],
      },
      null,
      2,
    )}\n`,
  );
  const tarball = await packTarball(packageDirectory);
  if (process.platform === target.platform && process.arch === target.architecture) {
    hostTarball = tarball;
  }
}

const mainPackageDirectory = path.join(npmDirectory, "groma.md");
await mkdir(mainPackageDirectory, { recursive: true });
await copyFile(
  path.join(projectRoot, "scripts", "npm", "cli.cjs"),
  path.join(mainPackageDirectory, "cli.js"),
);
await copyFile(
  path.join(projectRoot, "scripts", "npm", "resolveBinary.cjs"),
  path.join(mainPackageDirectory, "resolveBinary.cjs"),
);
await copyFile(path.join(projectRoot, "README.md"), path.join(mainPackageDirectory, "README.md"));
await writeFile(
  path.join(mainPackageDirectory, "package.json"),
  `${JSON.stringify(
    {
      name: "groma.md",
      version: packageVersion,
      description:
        "Groma keeps a living map of your system's architecture inside your repo, as plain Markdown you can read and review.",
      bin: { groma: "cli.js" },
      files: ["cli.js", "resolveBinary.cjs", "package.json", "README.md"],
      optionalDependencies: Object.fromEntries(
        targets.map((target) => [target.npmName, packageVersion]),
      ),
    },
    null,
    2,
  )}\n`,
);
const mainTarball = await packTarball(mainPackageDirectory);

if (hostTarball === undefined || Bun.which("npm") === null) {
  console.log(
    "Skipped the global-install verification: no host-matching platform tarball or npm available.",
  );
} else {
  const prefix = await mkdtemp(path.join(tmpdir(), "groma-npm-verify-"));
  await run([
    Bun.which("npm")!,
    "install",
    "--global",
    "--prefix",
    prefix,
    "--no-audit",
    "--no-fund",
    "--loglevel=error",
    mainTarball,
    hostTarball,
  ]);
  const installedBin =
    process.platform === "win32"
      ? path.join(prefix, "groma.cmd")
      : path.join(prefix, "bin", "groma");
  const probeDirectory = await mkdtemp(path.join(tmpdir(), "groma-npm-run-"));
  const version = Bun.spawn({
    cmd: [installedBin, "--version"],
    cwd: probeDirectory,
    stderr: "inherit",
    stdout: "pipe",
  });
  const reportedVersion = (await new Response(version.stdout).text()).trim();
  if ((await version.exited) !== 0 || reportedVersion !== packageVersion) {
    throw new Error(
      `The globally installed groma reported "${reportedVersion}" instead of ${packageVersion}`,
    );
  }
  const guide = Bun.spawn({
    cmd: [installedBin, "instructions", "overview"],
    cwd: probeDirectory,
    stderr: "inherit",
    stdout: "pipe",
  });
  const guideText = await new Response(guide.stdout).text();
  if ((await guide.exited) !== 0 || !guideText.includes("Intent")) {
    throw new Error("The globally installed groma did not print the overview guide");
  }
  console.log(`Verified the packed groma.md global install end to end (${reportedVersion}).`);
}

const tarballs = (await readdir(npmDirectory)).filter((entry) => entry.endsWith(".tgz")).toSorted();
console.log(`Packed npm distribution: ${tarballs.join(", ")}`);

console.log(
  hostArtifact === undefined
    ? `Packaged ${targets.length} standalone targets; none matched ${process.platform}-${process.arch}.`
    : `Packaged ${targets.length} standalone targets and verified ${path.basename(hostArtifact)} through the compiled workflow.`,
);
