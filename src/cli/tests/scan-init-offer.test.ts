import { describe, expect, test } from "bun:test";
import { access, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { runProgram } from "../program.ts";

function collectOutput() {
  const chunks: string[] = [];
  return {
    output: {
      writeError: (message: string) => chunks.push(message),
      writeOutput: (message: string) => chunks.push(message),
    },
    text: () => chunks.join(""),
  };
}

async function fixtureWorkspace(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  await Bun.write(path.join(root, "package.json"), JSON.stringify({ name: "offer-fixture" }));
  await Bun.write(
    path.join(root, "src", "index.ts"),
    "export function offerFixture() { return 'ready'; }\n",
  );
  return root;
}

async function workspaceExists(root: string): Promise<boolean> {
  try {
    await access(path.join(root, "groma", "groma.yaml"));
    return true;
  } catch {
    return false;
  }
}

const interactive = { stdin: true, stdout: true };

describe("scan offers initialization", () => {
  test("accepting the offer initializes and completes the same scan", async () => {
    const root = await fixtureWorkspace("groma-offer-accept-");
    const collected = collectOutput();
    const questions: string[] = [];
    const exitCode = await runProgram(["scan"], collected.output, {
      confirm: async (question) => {
        questions.push(question);
        return true;
      },
      terminal: interactive,
      workspaceRoot: root,
    });
    expect(questions).toEqual([
      "No groma workspace exists here. Create it with groma init and continue the scan? [y/N] ",
    ]);
    expect(exitCode).toBe(0);
    expect(collected.text()).toContain('"status":"completed"');
    expect(await workspaceExists(root)).toBeTrue();
  });

  test("declining keeps the diagnostic and creates nothing", async () => {
    const root = await fixtureWorkspace("groma-offer-decline-");
    const collected = collectOutput();
    const exitCode = await runProgram(["scan"], collected.output, {
      confirm: async () => false,
      terminal: interactive,
      workspaceRoot: root,
    });
    expect(exitCode).toBe(3);
    expect(collected.text()).toContain("no-workspace");
    expect(await workspaceExists(root)).toBeFalse();
  });

  test("json format never prompts", async () => {
    const root = await fixtureWorkspace("groma-offer-json-");
    const collected = collectOutput();
    let asked = 0;
    const exitCode = await runProgram(["--format=json", "scan"], collected.output, {
      confirm: async () => {
        asked += 1;
        return true;
      },
      terminal: interactive,
      workspaceRoot: root,
    });
    expect(asked).toBe(0);
    expect(exitCode).toBe(3);
    expect(collected.text()).toContain('"code":"no-workspace"');
    expect(await workspaceExists(root)).toBeFalse();
  });

  test("non-interactive terminals never prompt", async () => {
    const root = await fixtureWorkspace("groma-offer-noninteractive-");
    const collected = collectOutput();
    let asked = 0;
    const exitCode = await runProgram(["scan"], collected.output, {
      confirm: async () => {
        asked += 1;
        return true;
      },
      terminal: { stdin: false, stdout: false },
      workspaceRoot: root,
    });
    expect(asked).toBe(0);
    expect(exitCode).toBe(3);
    expect(await workspaceExists(root)).toBeFalse();
  });
});
