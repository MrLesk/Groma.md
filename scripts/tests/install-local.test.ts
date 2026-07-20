import { describe, expect, test } from "bun:test";
import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { installGroma } from "../install-local.ts";

const posixOnly = process.platform === "win32";

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
