import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { INSTRUCTION_GUIDES, instructionGuide } from "../instructions/index.ts";
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

describe("groma instructions", () => {
  test("parses the index and guide invocations", () => {
    const index = parseInvocation(["instructions"]);
    expect(index.ok).toBeTrue();
    if (index.ok) expect(index.invocation.command).toEqual({ kind: "instructions" });
    const guide = parseInvocation(["--format", "json", "instructions", "overview"]);
    expect(guide.ok).toBeTrue();
    if (guide.ok) {
      expect(guide.invocation.command).toEqual({ guide: "overview", kind: "instructions" });
    }
    expect(parseInvocation(["instructions", "--list"]).ok).toBeFalse();
    expect(parseInvocation(["instructions", "overview", "extra"]).ok).toBeFalse();
  });

  test("ships the four bounded guides with glossary vocabulary", () => {
    expect(INSTRUCTION_GUIDES.map((guide) => guide.key)).toEqual([
      "overview",
      "scanning",
      "curation",
      "reading",
    ]);
    const overview = instructionGuide("overview");
    expect(overview?.markdown).toContain("Intent");
    expect(overview?.markdown).toContain("Evidence");
    expect(overview?.markdown).toContain("groma init");
    expect(instructionGuide("scanning")?.markdown).toContain("never sees the existing map");
    expect(instructionGuide("curation")?.markdown).toContain("exact current revision");
    expect(instructionGuide("reading")?.markdown).toContain("bounded page");
    expect(instructionGuide("missing")).toBeUndefined();
  });

  test("prints the index and guides without any workspace", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "groma-instructions-"));
    const index = collectOutput();
    expect(await runProgram(["instructions"], index.output, { workspaceRoot: root })).toBe(0);
    expect(index.text()).toContain("Groma instructions");
    expect(index.text()).toContain("groma instructions overview");
    expect(index.text()).toContain("groma instructions reading");
    const guide = collectOutput();
    expect(
      await runProgram(["instructions", "curation"], guide.output, { workspaceRoot: root }),
    ).toBe(0);
    expect(guide.text()).toContain("# Curation");
    expect(guide.text()).toContain("merge");
  });

  test("returns structured json and rejects unknown guides", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "groma-instructions-json-"));
    const indexJson = collectOutput();
    expect(
      await runProgram(["--format=json", "instructions"], indexJson.output, {
        workspaceRoot: root,
      }),
    ).toBe(0);
    const index = JSON.parse(indexJson.text()) as {
      readonly result?: { readonly guides?: readonly { readonly key?: string }[] };
    };
    expect(index.result?.guides?.map((guide) => guide.key)).toEqual([
      "overview",
      "scanning",
      "curation",
      "reading",
    ]);
    const guideJson = collectOutput();
    expect(
      await runProgram(["--format=json", "instructions", "reading"], guideJson.output, {
        workspaceRoot: root,
      }),
    ).toBe(0);
    const guide = JSON.parse(guideJson.text()) as {
      readonly result?: { readonly guide?: { readonly markdown?: string } };
    };
    expect(guide.result?.guide?.markdown).toContain("bounded page");
    const unknown = collectOutput();
    expect(
      await runProgram(["instructions", "bogus"], unknown.output, { workspaceRoot: root }),
    ).toBe(2);
    expect(unknown.text()).toContain("cli-unknown-instruction-guide");
    expect(unknown.text()).toContain("overview, scanning, curation, reading");
  });
});
