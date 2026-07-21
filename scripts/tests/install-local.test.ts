import { describe, expect, test } from "bun:test";
import { lstat, mkdir, mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { installGroma } from "../install-local.ts";

const posixOnly = process.platform === "win32";
const packageJson = (await Bun.file(new URL("../../package.json", import.meta.url)).json()) as {
  bin?: Record<string, string>;
};

describe.skipIf(posixOnly)("local install", () => {
  test("copies the executable, marks it runnable, and probes its version", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "groma-install-"));
    const source = path.join(root, "fake-groma");
    await writeFile(source, "#!/bin/sh\necho 9.9.9-test\n", { mode: 0o755 });
    const destination = path.join(root, "bin");
    const outcome = await installGroma({ destination, skipBuild: true, source });
    expect(outcome.installedPath).toBe(path.join(destination, "groma"));
    expect(outcome.version).toBe("9.9.9-test");
    const installed = await stat(outcome.installedPath);
    expect(installed.isFile()).toBeTrue();
    expect(installed.mode & 0o111).toBeGreaterThan(0);
  });

  test("fails clearly when no built executable exists", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "groma-install-missing-"));
    await expect(
      installGroma({
        destination: path.join(root, "bin"),
        skipBuild: true,
        source: path.join(root, "absent"),
      }),
    ).rejects.toThrow("run bun run build first");
  });
});

test.skipIf(process.platform === "win32")(
  "the Bun-linked command resolves to the native build output",
  async () => {
    expect(packageJson.bin).toEqual({ groma: "dist/groma" });
  },
);

describe.skipIf(posixOnly)("Bun link", () => {
  test("keeps the command attached to a replaced build output", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "groma-bun-link-"));
    const installRoot = path.join(root, "bun-install");
    const packageRoot = path.join(root, "package");
    const outputDirectory = path.join(packageRoot, "dist");
    const output = path.join(outputDirectory, "groma");
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(
      path.join(packageRoot, "package.json"),
      JSON.stringify({
        bin: packageJson.bin,
        name: "groma-link-fixture",
        version: "0.0.0",
      }),
    );
    await writeFile(output, "#!/bin/sh\necho first-build\n", { mode: 0o755 });

    const link = Bun.spawn({
      cmd: [process.execPath, "link"],
      cwd: packageRoot,
      env: { ...process.env, BUN_INSTALL: installRoot },
      stderr: "pipe",
      stdout: "pipe",
    });
    const linkError = await new Response(link.stderr).text();
    expect(await link.exited, linkError).toBe(0);

    const command = path.join(installRoot, "bin", "groma");
    expect((await lstat(command)).isSymbolicLink()).toBeTrue();
    const firstProbe = Bun.spawn({ cmd: [command], stderr: "pipe", stdout: "pipe" });
    expect((await new Response(firstProbe.stdout).text()).trim()).toBe("first-build");
    expect(await firstProbe.exited).toBe(0);

    await writeFile(output, "#!/bin/sh\necho rebuilt\n", { mode: 0o755 });
    const rebuiltProbe = Bun.spawn({ cmd: [command], stderr: "pipe", stdout: "pipe" });
    expect((await new Response(rebuiltProbe.stdout).text()).trim()).toBe("rebuilt");
    expect(await rebuiltProbe.exited).toBe(0);
  });
});
