import { describe, expect, test } from "bun:test";

import { parseWorkspaceResourceLocator, workspaceResourceLocator } from "../contracts.ts";

describe("workspace resource locators", () => {
  test("accepts a canonical root and portable Unicode segments", () => {
    const root = parseWorkspaceResourceLocator(".");
    const unicode = workspaceResourceLocator("設計", "café.md");
    if (!root.ok || !unicode.ok) throw new Error("expected valid locators");
    expect(String(root.value)).toBe(".");
    expect(String(unicode.value)).toBe("設計/café.md");
  });

  test("rejects traversal, absolute paths, and separator injection", () => {
    for (const value of [
      "",
      "../outside",
      "inside/../outside",
      "./inside",
      "/absolute",
      "C:/absolute",
      "C:\\absolute",
      "\\\\server\\share",
      "double//segment",
    ]) {
      expect(parseWorkspaceResourceLocator(value)).toMatchObject({
        diagnostics: [{ code: "invalid-resource-locator" }],
        ok: false,
      });
    }
    expect(workspaceResourceLocator("nested/file").ok).toBeFalse();
    expect(workspaceResourceLocator(".").ok).toBeFalse();
  });

  test("rejects Windows ADS, reserved names, trailing aliases, and non-portable characters", () => {
    for (const value of [
      "report.md:stream",
      "CON",
      "con.txt",
      "aux.json",
      "COM1",
      "COM¹.log",
      "CONIN$",
      "CONOUT$.txt",
      "lpt9.log",
      "trailing.",
      "trailing ",
      "question?.md",
      "back\\slash",
      `control${String.fromCharCode(1)}`,
      `surrogate${String.fromCharCode(0xd800)}`,
    ]) {
      expect(parseWorkspaceResourceLocator(value).ok).toBeFalse();
    }
  });

  test("rejects malformed runtime values and bounded segment overflows", () => {
    expect(parseWorkspaceResourceLocator({ toString: () => "safe" }).ok).toBeFalse();
    expect(workspaceResourceLocator("a".repeat(256)).ok).toBeFalse();
    expect(
      workspaceResourceLocator(...Array.from({ length: 300 }, () => "valid-segment")),
    ).toMatchObject({
      diagnostics: [{ code: "invalid-resource-locator" }],
      ok: false,
    });
  });

  test("reserves the provider-owned stage namespace in every segment and casing", () => {
    for (const value of [
      ".groma-stage-deadbeef",
      ".GROMA-STAGE-deadbeef",
      "groma/.groma-stage-deadbeef/state.md",
    ]) {
      expect(parseWorkspaceResourceLocator(value).ok).toBeFalse();
    }
    expect(workspaceResourceLocator(".GrOmA-StAgE-deadbeef").ok).toBeFalse();
  });
});
