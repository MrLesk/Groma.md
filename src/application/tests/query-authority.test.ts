import { describe, expect, test } from "bun:test";

const fixture = `${import.meta.dir}/fixtures/query-authority-child.ts`;

describe("application query authority loading", () => {
  test("Core capture survives prototype poisoning before application import", async () => {
    const child = Bun.spawn({
      cmd: [process.execPath, "run", fixture],
      cwd: `${import.meta.dir}/../../..`,
      stderr: "pipe",
      stdout: "pipe",
    });
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(exitCode, stderr).toBe(0);
    expect(stdout).toContain("query-authority-ok");
    expect(`${stdout}${stderr}`).not.toContain("/private/preload-query-cursor");
  });
});
