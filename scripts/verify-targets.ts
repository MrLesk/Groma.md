import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

interface Target {
  readonly architecture: "arm64" | "x64";
  readonly executable: "dist/groma" | "dist/groma.exe";
  readonly platform: "darwin" | "linux" | "win32";
  readonly target: string;
}

const targets: readonly Target[] = [
  {
    architecture: "arm64",
    executable: "dist/groma",
    platform: "darwin",
    target: "bun-darwin-arm64",
  },
  {
    architecture: "x64",
    executable: "dist/groma",
    platform: "linux",
    target: "bun-linux-x64-baseline",
  },
  {
    architecture: "x64",
    executable: "dist/groma.exe",
    platform: "win32",
    target: "bun-windows-x64-baseline",
  },
  {
    architecture: "arm64",
    executable: "dist/groma.exe",
    platform: "win32",
    target: "bun-windows-arm64",
  },
];

async function run(command: readonly string[]): Promise<void> {
  const child = Bun.spawn({
    cmd: [...command],
    cwd: projectRoot,
    stderr: "inherit",
    stdout: "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error(`${command.join(" ")} exited with code ${exitCode}`);
  }
}

for (const target of targets) {
  await run([process.execPath, "run", "scripts/build.ts", `--target=${target.target}`]);
  const isRunnable = process.platform === target.platform && process.arch === target.architecture;
  await run([
    process.execPath,
    "run",
    "scripts/verify-binary.ts",
    `--executable=${target.executable}`,
    ...(isRunnable ? [] : ["--skip-run"]),
  ]);
}

await run([process.execPath, "run", "scripts/build.ts"]);

console.log(
  `Verified ${targets.length} standalone executable targets and restored the native artifact.`,
);
