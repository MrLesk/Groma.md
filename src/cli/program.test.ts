import { describe, expect, test } from "bun:test";

import { GROMA_VERSION, HELP_TEXT, runProgram, type ProgramOutput } from "./program.ts";

function captureOutput(): ProgramOutput & { errors: string[]; output: string[] } {
  const errors: string[] = [];
  const output: string[] = [];

  return {
    errors,
    output,
    writeError: (message) => errors.push(message),
    writeOutput: (message) => output.push(message),
  };
}

describe("bootstrap CLI", () => {
  for (const args of [[], ["--help"], ["-h"]] as const) {
    test(`renders help for ${JSON.stringify(args)}`, () => {
      const captured = captureOutput();

      expect(runProgram(args, captured)).toBe(0);
      expect(captured.output).toEqual([HELP_TEXT]);
      expect(captured.errors).toEqual([]);
    });
  }

  for (const args of [["--version"], ["-V"]] as const) {
    test(`renders the version for ${JSON.stringify(args)}`, () => {
      const captured = captureOutput();

      expect(runProgram(args, captured)).toBe(0);
      expect(captured.output).toEqual([`${GROMA_VERSION}\n`]);
      expect(captured.errors).toEqual([]);
    });
  }

  test("rejects unknown arguments", () => {
    const captured = captureOutput();

    expect(runProgram(["scan"], captured)).toBe(2);
    expect(captured.output).toEqual([]);
    expect(captured.errors).toEqual(["Unknown arguments: scan\nRun groma --help for usage.\n"]);
  });
});
