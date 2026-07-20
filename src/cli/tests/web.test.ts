import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
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
      workspaceRoot: root,
    });
    expect(exitCode).toBe(3);
    expect(collected.text()).toContain("web-workspace-missing");
    expect(collected.text()).toContain("groma init");
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
