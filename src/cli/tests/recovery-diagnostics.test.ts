import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { runProgram } from "../program.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function workspace(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "groma-cli-recovery-"));
  roots.push(root);
  const initialized = await runProgram(
    ["init"],
    { writeError: () => {}, writeOutput: () => {} },
    { terminal: { stdin: false, stdout: false }, workspaceRoot: root },
  );
  expect(initialized).toBe(0);
  await mkdir(path.join(root, "groma", "components"), { recursive: true });
  return root;
}

describe("workspace recovery diagnostics", () => {
  test("names an unexpected canonical-layout file while preserving fail-closed startup", async () => {
    const root = await workspace();
    await writeFile(path.join(root, "groma", "components", "readme.json"), "{}\n");
    const chunks: string[] = [];

    const exitCode = await runProgram(
      ["--format", "json", "component", "roots", "--limit", "10"],
      {
        writeError: (message) => chunks.push(message),
        writeOutput: (message) => chunks.push(message),
      },
      { terminal: { stdin: false, stdout: false }, workspaceRoot: root },
    );

    expect(exitCode).toBe(5);
    expect(JSON.parse(chunks.join(""))).toMatchObject({
      ok: false,
      result: {
        diagnostics: [
          {
            code: "unexpected-intent-resource",
            details: { kind: "file", locator: "groma/components/readme.json" },
          },
        ],
        status: "startup-failure",
      },
    });
  });
});
