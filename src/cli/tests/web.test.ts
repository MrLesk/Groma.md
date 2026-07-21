import { describe, expect, test } from "bun:test";
import { access, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { HostSignal, HostSignalSource } from "../../host/index.ts";
import { parseInvocation } from "../parser.ts";
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

function manualSignalSource(): {
  readonly fire: (signal: HostSignal) => void;
  readonly source: HostSignalSource;
} {
  let listener: ((signal: HostSignal) => void) | undefined;
  return {
    fire: (signal) => listener?.(signal),
    source: {
      subscribe(subscriber) {
        listener = subscriber;
        return () => {
          listener = undefined;
        };
      },
    },
  };
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

describe("groma web command", () => {
  test("parses the default and explicit ports", () => {
    const bare = parseInvocation(["web"]);
    expect(bare.ok).toBeTrue();
    if (bare.ok) expect(bare.invocation.command).toEqual({ kind: "web", port: 4766 });
    const ephemeral = parseInvocation(["--format", "json", "web", "--port", "0"]);
    expect(ephemeral.ok).toBeTrue();
    if (ephemeral.ok) expect(ephemeral.invocation.command).toEqual({ kind: "web", port: 0 });
    expect(parseInvocation(["web", "--port", "65536"]).ok).toBeFalse();
    expect(parseInvocation(["web", "--port", "007"]).ok).toBeFalse();
    expect(parseInvocation(["web", "--port"]).ok).toBeFalse();
    expect(parseInvocation(["web", "--bogus"]).ok).toBeFalse();
  });

  test("requires an initialized workspace before serving", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "groma-web-missing-"));
    const collected = collectOutput();
    const exitCode = await runProgram(["--format=json", "web", "--port", "0"], collected.output, {
      presentWebUrl: () => {
        throw new Error("The web server must not start without a workspace");
      },
      confirm: async () => {
        throw new Error("JSON output must not prompt");
      },
      terminal: interactive,
      workspaceRoot: root,
    });
    expect(exitCode).toBe(3);
    expect(collected.text()).toContain("web-workspace-missing");
    expect(collected.text()).toContain("groma init");
    expect(await workspaceExists(root)).toBeFalse();
  });

  test("declining the interactive offer keeps the diagnostic and creates nothing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "groma-web-offer-decline-"));
    const collected = collectOutput();
    const exitCode = await runProgram(["web", "--port", "0"], collected.output, {
      confirm: async () => false,
      presentWebUrl: () => {
        throw new Error("The web server must not start after a declined offer");
      },
      terminal: interactive,
      workspaceRoot: root,
    });
    expect(exitCode).toBe(3);
    expect(collected.text()).toContain("web-workspace-missing");
    expect(await workspaceExists(root)).toBeFalse();
  });

  test("non-interactive terminals never offer initialization", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "groma-web-offer-noninteractive-"));
    const collected = collectOutput();
    let asked = 0;
    const exitCode = await runProgram(["web", "--port", "0"], collected.output, {
      confirm: async () => {
        asked += 1;
        return true;
      },
      terminal: { stdin: false, stdout: false },
      workspaceRoot: root,
    });
    expect(asked).toBe(0);
    expect(exitCode).toBe(3);
    expect(collected.text()).toContain("web-workspace-missing");
    expect(await workspaceExists(root)).toBeFalse();
  });

  test("accepting initializes and starts the same web invocation", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "groma-web-offer-accept-"));
    const collected = collectOutput();
    const signals = manualSignalSource();
    const questions: string[] = [];
    let presented = false;
    const exitCode = await runProgram(["web", "--port", "0"], collected.output, {
      confirm: async (question) => {
        questions.push(question);
        return true;
      },
      presentWebUrl: () => {
        presented = true;
        signals.fire("SIGINT");
      },
      signalSource: signals.source,
      terminal: interactive,
      workspaceRoot: root,
    });
    expect(exitCode).toBe(0);
    expect(presented).toBeTrue();
    expect(questions).toEqual([
      "No Groma workspace exists here. Create it with groma init and start the web interface? [y/N] ",
    ]);
    expect(await workspaceExists(root)).toBeTrue();
  });

  test("accepting continues when another process initializes before this invocation", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "groma-web-offer-race-"));
    const collected = collectOutput();
    const signals = manualSignalSource();
    let presented = false;
    const exitCode = await runProgram(["web", "--port", "0"], collected.output, {
      confirm: async () => {
        expect(
          await runProgram(["--format=json", "init"], collectOutput().output, {
            workspaceRoot: root,
          }),
        ).toBe(0);
        return true;
      },
      presentWebUrl: () => {
        presented = true;
        signals.fire("SIGINT");
      },
      signalSource: signals.source,
      terminal: interactive,
      workspaceRoot: root,
    });
    expect(exitCode).toBe(0);
    expect(presented).toBeTrue();
  });

  test("serves the embedded shell and bounded reads until a stop signal", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "groma-web-serve-"));
    const collected = collectOutput();
    const signals = manualSignalSource();
    const initExit = await runProgram(["--format=json", "init"], collectOutput().output, {
      workspaceRoot: root,
    });
    expect(initExit).toBe(0);
    let served: { document: string; roots: { readonly ok?: unknown } } | undefined;
    const exitCode = await runProgram(["--format=json", "web", "--port", "0"], collected.output, {
      presentWebUrl: (url) => {
        void (async () => {
          try {
            const document = await (await fetch(url)).text();
            const roots = (await (await fetch(`${url}api/roots?limit=5`)).json()) as {
              readonly ok?: unknown;
            };
            served = { document, roots };
          } finally {
            signals.fire("SIGINT");
          }
        })();
      },
      signalSource: signals.source,
      workspaceRoot: root,
    });
    expect(exitCode).toBe(0);
    expect(served).toBeDefined();
    expect(served?.document).toContain('<div id="root">');
    expect(served?.roots.ok).toBeTrue();
    const result = JSON.parse(collected.text()) as {
      readonly command?: unknown;
      readonly ok?: unknown;
      readonly result?: { readonly status?: unknown; readonly url?: unknown };
    };
    expect(result.command).toBe("web");
    expect(result.ok).toBeTrue();
    expect(result.result?.status).toBe("served");
    expect(String(result.result?.url)).toStartWith("http://127.0.0.1:");
  });
});
