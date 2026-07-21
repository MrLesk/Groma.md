import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
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

describe("groma export command", () => {
  test("requires a workspace", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "groma-export-missing-"));
    const collected = collectOutput();
    const exitCode = await runProgram(["--format=json", "export"], collected.output, {
      exportWriter: async () => {
        throw new Error("A missing workspace must not write an export");
      },
      workspaceRoot: root,
    });
    expect(exitCode).toBe(3);
    expect(collected.text()).toContain("web-export-workspace-missing");
  });

  test("writes the same offline embedded client for identical blueprint state", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "groma-export-ready-"));
    expect(
      await runProgram(["--format=json", "init"], collectOutput().output, { workspaceRoot: root }),
    ).toBe(0);
    const writes: { readonly html: string; readonly output: string }[] = [];
    const exportWriter = async (output: string, html: string) => {
      writes.push({ html, output });
      return path.join(root, output);
    };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const collected = collectOutput();
      const exitCode = await runProgram(
        ["--format=json", "export", "--output", "team-blueprint.html"],
        collected.output,
        { exportWriter, workspaceRoot: root },
      );
      expect(exitCode).toBe(0);
      expect(JSON.parse(collected.text())).toMatchObject({
        command: "export",
        ok: true,
        result: { artifact: path.join(root, "team-blueprint.html"), status: "written" },
      });
    }
    expect(writes).toHaveLength(2);
    expect(writes[0]?.output).toBe("team-blueprint.html");
    expect(writes[0]?.html).toBe(writes[1]?.html);
    const html = writes[0]!.html;
    expect(html).toContain('data-groma-export="read-only"');
    expect(html).toContain("groma-read-only-blueprint-v1");
    expect(html).toContain("globalThis.__GROMA_BLUEPRINT_SNAPSHOT__=");
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("react-flow-dagre");
    expect(html).not.toMatch(/<script\b[^>]*\bsrc=/i);
    expect(html).not.toMatch(/<link\b[^>]*\brel=["']stylesheet["']/i);
  });
});
