import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

const targets = Object.freeze([
  Object.freeze({
    architecture: "arm64",
    executable: "dist/groma",
    platform: "darwin",
    target: "bun-darwin-arm64",
  }),
  Object.freeze({
    architecture: "x64",
    executable: "dist/groma",
    platform: "linux",
    target: "bun-linux-x64-baseline",
  }),
  Object.freeze({
    architecture: "x64",
    executable: "dist/groma.exe",
    platform: "win32",
    target: "bun-windows-x64-baseline",
  }),
  Object.freeze({
    architecture: "arm64",
    executable: "dist/groma.exe",
    platform: "win32",
    target: "bun-windows-arm64",
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

let hostWorkflowRan = false;
try {
  for (const target of targets) {
    await run([process.execPath, "run", "scripts/build.ts", `--target=${target.target}`]);
    const executable = path.join(projectRoot, target.executable);
    const built = await stat(executable);
    if (!built.isFile() || built.size === 0)
      throw new Error(`${target.target} did not produce an executable`);
    const isRunnable = process.platform === target.platform && process.arch === target.architecture;
    await run([
      process.execPath,
      "run",
      "scripts/verify-binary.ts",
      `--executable=${target.executable}`,
      ...(isRunnable ? [] : ["--skip-run"]),
    ]);
    if (isRunnable) {
      await run([
        process.execPath,
        "run",
        "tests/iteration-1a/verify.ts",
        `--executable=${target.executable}`,
        "--skip-crash",
      ]);
      hostWorkflowRan = true;
    }
  }
} finally {
  await run([process.execPath, "run", "scripts/build.ts"]);
}

console.log(
  hostWorkflowRan
    ? `Cross-compiled ${targets.length} targets, ran the host-compatible workflow, and restored the native artifact.`
    : `Cross-compiled ${targets.length} targets and restored the native artifact; none matched ${process.platform}-${process.arch}.`,
);
