import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
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

async function readBoundedCommandOutput(
  stream: ReadableStream<Uint8Array>,
  maximumBytes = 1_048_576,
): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      total += item.value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new Error("Standalone verification command output exceeds its byte bound");
      }
      chunks.push(item.value.slice());
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function capturePackageCommand(
  executable: string,
  workspace: string,
  userHome: string,
  args: readonly string[],
): Promise<{ readonly exitCode: number; readonly stderr: string; readonly stdout: string }> {
  const process = Bun.spawn({
    cmd: [executable, "--format", "json", ...args],
    cwd: workspace,
    env: { ...Bun.env, HOME: userHome, USERPROFILE: userHome },
    stderr: "pipe",
    stdout: "pipe",
  });
  const exited = process.exited;
  const stderr = readBoundedCommandOutput(process.stderr);
  const stdout = readBoundedCommandOutput(process.stdout);
  try {
    const [exitCode, capturedStderr, capturedStdout] = await Promise.all([exited, stderr, stdout]);
    return { exitCode, stderr: capturedStderr, stdout: capturedStdout };
  } catch (error) {
    try {
      process.kill();
    } catch {
      // The child may already have exited after closing its output streams.
    }
    await Promise.allSettled([exited, stderr, stdout]);
    throw error;
  }
}

async function requireMissing(candidate: string, message: string): Promise<void> {
  try {
    await lstat(candidate);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error(message);
}

async function verifyRuntimePluginImport(executable: string): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), "groma-binary-plugin-"));
  try {
    const workspace = path.join(root, "workspace");
    const packageRoot = path.join(workspace, "local-package");
    const userHome = path.join(root, "home");
    await mkdir(path.join(packageRoot, "plugins"), { recursive: true });
    await mkdir(userHome);
    await runPackageCommand(executable, workspace, userHome, [
      "package",
      "scaffold",
      "./scaffolded",
      "--name",
      "binary-scaffolded",
      "--plugin",
      "binary.scaffolded",
      "--provides",
      "binary.scaffolded/v1",
    ]);
    const scaffoldRoot = path.join(workspace, "scaffolded");
    await Promise.all(
      [
        "groma.package.json",
        "package.json",
        path.join("plugins", "plugin.ts"),
        path.join("tests", "conformance.test.ts"),
      ].map((file) => lstat(path.join(scaffoldRoot, file))),
    );
    const scaffoldSources = await Promise.all([
      readFile(path.join(scaffoldRoot, "plugins", "plugin.ts"), "utf8"),
      readFile(path.join(scaffoldRoot, "tests", "conformance.test.ts"), "utf8"),
    ]);
    if (
      scaffoldSources.some(
        (source) =>
          source.includes("/src/") ||
          /\.\.\/.*(?:core|host|application|persistence|standard-model)/.test(source),
      )
    ) {
      throw new Error("Compiled scaffold output imported a private Groma module");
    }
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
    const evaluationFile = path.join(packageRoot, "evaluations.txt");
    const entrySource = `import { appendFileSync } from "node:fs";
const evaluation: string = "evaluated\\n";
appendFileSync(${JSON.stringify(evaluationFile)}, evaluation);
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
});\n`;
    const entryBytes = Buffer.from(entrySource);
    if (process.platform === "win32") {
      await writeFile(path.join(packageRoot, "plugins", "smoke.js"), entryBytes);
    } else {
      const maximumEntryBytes = 4 * 1_024 * 1_024;
      if (entryBytes.byteLength > maximumEntryBytes) {
        throw new Error("Binary smoke plugin exceeds the supported entry bound");
      }
      await writeFile(
        path.join(packageRoot, "plugins", "smoke.js"),
        Buffer.concat([entryBytes, Buffer.alloc(maximumEntryBytes - entryBytes.byteLength, " ")]),
      );
    }
    await runPackageCommand(executable, workspace, userHome, ["init"]);
    await runPackageCommand(executable, workspace, userHome, ["package", "add", "./scaffolded"]);
    if (process.platform === "win32") {
      await runPackageCommand(executable, workspace, userHome, [
        "package",
        "inspect",
        "binary-scaffolded",
      ]);
      await runPackageCommand(executable, workspace, userHome, [
        "package",
        "remove",
        "binary-scaffolded",
      ]);
    } else {
      await runPackageCommand(executable, workspace, userHome, [
        "package",
        "enable",
        "binary-scaffolded",
        "./plugins/plugin.ts",
        "--trust-full-user-permissions",
      ]);
      await runPackageCommand(executable, workspace, userHome, [
        "component",
        "roots",
        "--limit",
        "1",
      ]);
      await runPackageCommand(executable, workspace, userHome, [
        "package",
        "disable",
        "binary-scaffolded",
        "./plugins/plugin.ts",
      ]);
      await runPackageCommand(executable, workspace, userHome, [
        "package",
        "remove",
        "binary-scaffolded",
      ]);
    }
    await runPackageCommand(executable, workspace, userHome, ["package", "add", "./local-package"]);
    if (process.platform === "win32") {
      await runPackageCommand(executable, workspace, userHome, [
        "package",
        "inspect",
        "binary-smoke",
      ]);
      const rejected = await capturePackageCommand(executable, workspace, userHome, [
        "package",
        "enable",
        "binary-smoke",
        "./plugins/smoke.js",
        "--trust-full-user-permissions",
      ]);
      if (rejected.exitCode !== 3 || rejected.stderr !== "") {
        throw new Error("Windows package enable did not fail with the bounded workspace contract");
      }
      let envelope: unknown;
      try {
        envelope = JSON.parse(rejected.stdout);
      } catch {
        throw new Error("Windows package enable did not return bounded JSON");
      }
      const expected = JSON.stringify({
        command: "package enable",
        exitCode: 3,
        ok: false,
        result: {
          diagnostics: [
            {
              code: "plugin-package-trust-root-unattested",
              message:
                "Local plugin trust is unavailable because this Windows Host cannot attest exclusive control of its user-data root",
            },
          ],
          ok: false,
        },
      });
      if (JSON.stringify(envelope) !== expected) {
        throw new Error("Windows package enable returned an unexpected trust diagnostic");
      }
      await requireMissing(
        evaluationFile,
        "Windows package enable evaluated an unattested plugin entry",
      );
      await requireMissing(
        path.join(userHome, ".groma"),
        "Windows package enable created an unattested user-data root",
      );
      await runPackageCommand(executable, workspace, userHome, [
        "package",
        "remove",
        "binary-smoke",
      ]);
      return;
    }
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
