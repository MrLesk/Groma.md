import { describe, expect, test } from "bun:test";

import { CLI_MAX_INPUT_BYTES, CLI_MAX_JSON_DEPTH } from "../contracts.ts";
import { decodeStructuredInput } from "../input.ts";

describe("structured CLI input", () => {
  test("accepts one object with an optional UTF-8 BOM", () => {
    expect(decodeStructuredInput('\ufeff{"component":{"name":"Cart"}}')).toEqual({
      ok: true,
      value: { component: { name: "Cart" } },
    });
  });

  test("rejects invalid JSON, scalars, excessive depth, and excessive bytes", () => {
    let nested = "0";
    for (let index = 0; index < CLI_MAX_JSON_DEPTH + 2; index += 1) nested = `{"x":${nested}}`;
    for (const input of ["{}{}", '"value"', nested, `{"x":"${"a".repeat(CLI_MAX_INPUT_BYTES)}"}`]) {
      expect(decodeStructuredInput(input)).toMatchObject({
        diagnostic: { code: "cli-invalid-input" },
        ok: false,
      });
    }
  });
});
