import { open } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const iterationOneAVerification = "tests/iteration-1a/verify.ts";
const foundationVerification = "tests/iteration-1b/verify-foundation.ts";
const selfBlueprintVerification = "tests/iteration-1b/verify-self-blueprint.ts";

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

function hasPrefix(bytes: Uint8Array, expected: readonly number[]): boolean {
  return expected.every((value, index) => bytes[index] === value);
}

async function verifyExecutableHeader(target: Target): Promise<void> {
  const executable = path.join(projectRoot, target.executable);
  const handle = await open(executable, "r");
  try {
    const bytes = new Uint8Array(65_536);
    const { bytesRead } = await handle.read(bytes, 0, bytes.byteLength, 0);
    const header = bytes.subarray(0, bytesRead);
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    if (target.platform === "darwin") {
      if (
        header.byteLength < 8 ||
        !hasPrefix(header, [0xcf, 0xfa, 0xed, 0xfe]) ||
        view.getUint32(4, true) !== 0x0100000c
      ) {
        throw new Error(`${target.target} is not a Mach-O arm64 executable`);
      }
      return;
    }
    if (target.platform === "linux") {
      if (
        header.byteLength < 20 ||
        !hasPrefix(header, [0x7f, 0x45, 0x4c, 0x46]) ||
        header[4] !== 2 ||
        header[5] !== 1 ||
        view.getUint16(18, true) !== 0x003e
      ) {
        throw new Error(`${target.target} is not an ELF x86-64 executable`);
      }
      return;
    }
    if (header.byteLength < 64 || !hasPrefix(header, [0x4d, 0x5a])) {
      throw new Error(`${target.target} is not a PE executable`);
    }
    const peOffset = view.getUint32(0x3c, true);
    if (
      peOffset > header.byteLength - 6 ||
      !hasPrefix(header.subarray(peOffset), [0x50, 0x45, 0x00, 0x00])
    ) {
      throw new Error(`${target.target} has a malformed PE header`);
    }
    const expectedMachine = target.architecture === "arm64" ? 0xaa64 : 0x8664;
    if (view.getUint16(peOffset + 4, true) !== expectedMachine) {
      throw new Error(`${target.target} has the wrong PE machine architecture`);
    }
  } finally {
    await handle.close();
  }
}

let hostWorkflowRan = false;
try {
  for (const target of targets) {
    await run([process.execPath, "run", "scripts/build.ts", `--target=${target.target}`]);
    await verifyExecutableHeader(target);
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
        iterationOneAVerification,
        `--executable=${target.executable}`,
        "--skip-crash",
      ]);
      await run([
        process.execPath,
        "run",
        foundationVerification,
        `--executable=${target.executable}`,
      ]);
      await run([
        process.execPath,
        "run",
        selfBlueprintVerification,
        `--executable=${target.executable}`,
      ]);
      hostWorkflowRan = true;
    }
  }
} finally {
  await run([process.execPath, "run", "scripts/build.ts"]);
}

console.log(
  hostWorkflowRan
    ? `Verified ${targets.length} standalone executable headers, the complete host-compatible Iteration 1B workflow, and restored the native artifact.`
    : `Verified ${targets.length} standalone executable headers by cross-compilation only; no baseline target matches ${process.platform}-${process.arch}, and the native artifact was restored.`,
);
