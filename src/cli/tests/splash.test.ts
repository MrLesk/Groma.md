import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { renderCommandResult } from "../render.ts";
import { formatSplash } from "../splash.ts";
import { runProgram } from "../program.ts";

const ESC = "\u001B";

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

describe("bare groma splash", () => {
  test("guides a directory without a workspace through the loop", () => {
    const splash = formatSplash({ color: false, workspace: "missing" });
    expect(splash).toContain("groma.md v");
    expect(splash).toContain("living map of your system's architecture");
    expect(splash).toContain("No groma workspace exists in this directory yet.");
    const order = ["groma init", "groma scan", "groma web", "groma blueprint export --limit 20"];
    let position = -1;
    for (const command of order) {
      const next = splash.indexOf(command);
      expect(next).toBeGreaterThan(position);
      position = next;
    }
    expect(splash).toContain("groma instructions overview");
    expect(splash).toContain("groma --help");
    expect(splash).not.toContain(ESC);
  });

  test("shows common commands when a workspace exists", () => {
    const splash = formatSplash({ color: false, workspace: "ready" });
    expect(splash).toContain("Run bare groma in an interactive terminal");
    expect(splash).toContain("groma scan");
    expect(splash).toContain("groma web");
    expect(splash).toContain("groma blueprint export --limit 20");
    expect(splash).toContain("groma --format json");
    expect(splash).not.toContain("groma init");
    expect(splash).not.toContain(ESC);
  });

  test("colors only the wordmark accent and section titles when asked", () => {
    const colored = formatSplash({ color: true, workspace: "missing" });
    expect(colored).toContain(`${ESC}[38;2;29;158;117m.md${ESC}[0m`);
    expect(colored).toContain(`${ESC}[1mgroma${ESC}[0m`);
    expect(colored).toContain(`${ESC}[1mGet started:${ESC}[0m`);
    const plain = formatSplash({ color: false, workspace: "missing" });
    expect(colored.replaceAll(/\u001B\[[0-9;]*m/g, "")).toBe(plain);
  });

  test("renders the overview fallbacks through the splash and keeps json structured", () => {
    const missing = renderCommandResult(
      Object.freeze({
        command: "overview",
        exitCode: 0,
        ok: true,
        result: Object.freeze({ kind: "workspace-missing" as const }),
      }),
      "plain",
    );
    expect(missing.ok).toBeTrue();
    if (missing.ok) expect(missing.text).toContain("Get started:");
    const ready = renderCommandResult(
      Object.freeze({
        command: "overview",
        exitCode: 0,
        ok: true,
        result: Object.freeze({ kind: "help" as const }),
      }),
      "plain",
      { color: true },
    );
    expect(ready.ok).toBeTrue();
    if (ready.ok) expect(ready.text).toContain(`${ESC}[1mCommon commands:${ESC}[0m`);
    const json = renderCommandResult(
      Object.freeze({
        command: "overview",
        exitCode: 0,
        ok: true,
        result: Object.freeze({ kind: "workspace-missing" as const }),
      }),
      "json",
      { color: true },
    );
    expect(json.ok).toBeTrue();
    if (json.ok) {
      expect(json.text).toContain('"kind":"workspace-missing"');
      expect(json.text).not.toContain(ESC);
    }
  });

  test("bare groma without a workspace prints the splash end to end", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "groma-splash-"));
    const collected = collectOutput();
    const exitCode = await runProgram([], collected.output, { workspaceRoot: root });
    expect(exitCode).toBe(0);
    expect(collected.text()).toContain("No groma workspace exists in this directory yet.");
    expect(collected.text()).toContain("groma init");
    expect(collected.text()).not.toContain(ESC);
  });
});
