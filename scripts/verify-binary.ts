import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
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

async function runPackageCommand(
  executable: string,
  workspace: string,
  userHome: string,
  args: readonly string[],
): Promise<void> {
  const process = Bun.spawn({
    cmd: [executable, "--format", "json", ...args],
    cwd: workspace,
    env: { ...Bun.env, HOME: userHome, USERPROFILE: userHome },
    stderr: "inherit",
    stdout: "inherit",
  });
  const exitCode = await process.exited;
  if (exitCode !== 0) {
    throw new Error(`${path.basename(executable)} ${args.join(" ")} exited with code ${exitCode}`);
  }
}

async function verifyRuntimePluginImport(executable: string): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), "groma-binary-plugin-"));
  try {
    const workspace = path.join(root, "workspace");
    const packageRoot = path.join(workspace, "local-package");
    const userHome = path.join(root, "home");
    await mkdir(path.join(packageRoot, "plugins"), { recursive: true });
    await mkdir(userHome);
    await writeFile(
      path.join(packageRoot, "groma.package.json"),
      `${JSON.stringify({
        apiVersion: "groma.package/v1",
        name: "binary-smoke",
        plugins: ["./plugins/smoke.js"],
        runtimeApiVersion: "groma.plugin/v1",
        sdkApiVersion: "groma.sdk/v1",
        version: "1.0.0",
      })}\n`,
    );
    await writeFile(
      path.join(packageRoot, "plugins", "smoke.js"),
      `import { appendFileSync } from "node:fs";
appendFileSync(new URL("../evaluations.txt", import.meta.url), "evaluated\\n");
export const plugin = Object.freeze({
  manifest: Object.freeze({
    apiVersion: "groma.plugin/v1",
    id: "binary.smoke",
    phase: 1,
    provides: Object.freeze([]),
    requires: Object.freeze([]),
    version: "1.0.0"
  }),
  start: () => Object.freeze({ capabilities: Object.freeze([]) })
});\n`,
    );
    await runPackageCommand(executable, workspace, userHome, ["init"]);
    await runPackageCommand(executable, workspace, userHome, ["package", "add", "./local-package"]);
    await runPackageCommand(executable, workspace, userHome, [
      "package",
      "enable",
      "binary-smoke",
      "./plugins/smoke.js",
      "--trust-full-user-permissions",
    ]);
    // A fresh process must verify the exact lock and persisted trust before importing again.
    await runPackageCommand(executable, workspace, userHome, [
      "package",
      "inspect",
      "binary-smoke",
    ]);
    const evaluations = await readFile(path.join(packageRoot, "evaluations.txt"), "utf8");
    if (evaluations !== "evaluated\n") {
      throw new Error("Package inspect evaluated an enabled plugin entry");
    }
    await runPackageCommand(executable, workspace, userHome, [
      "component",
      "roots",
      "--limit",
      "1",
    ]);
    const startedEvaluations = await readFile(path.join(packageRoot, "evaluations.txt"), "utf8");
    if (startedEvaluations !== "evaluated\nevaluated\n") {
      throw new Error("Ordinary startup did not load the exact enabled plugin entry");
    }
  } finally {
    await rm(root, { force: true, recursive: true });
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
  await verifyRuntimePluginImport(options.executable);
}
console.log(
  `${options.skipRun ? "Verified cross-compiled" : "Verified runnable"} standalone executable: ${options.executable}`,
);
