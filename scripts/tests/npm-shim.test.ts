import { describe, expect, test } from "bun:test";

import {
  SUPPORTED_TARGETS,
  getBinaryFileName,
  getPackageName,
  resolveBinaryPath,
} from "../npm/resolveBinary.cjs";

describe("groma.md npm binary resolver", () => {
  test("maps every supported target to its platform package and binary name", () => {
    expect(getPackageName("darwin", "arm64")).toBe("groma.md-darwin-arm64");
    expect(getPackageName("linux", "x64")).toBe("groma.md-linux-x64");
    expect(getPackageName("win32", "x64")).toBe("groma.md-windows-x64");
    expect(getPackageName("win32", "arm64")).toBe("groma.md-windows-arm64");
    expect(getBinaryFileName("win32")).toBe("groma.exe");
    expect(getBinaryFileName("darwin")).toBe("groma");
    expect(getBinaryFileName("linux")).toBe("groma");
    expect(SUPPORTED_TARGETS).toEqual([
      "darwin-arm64",
      "linux-x64",
      "windows-arm64",
      "windows-x64",
    ]);
  });

  test("fails to resolve targets that are not installed", () => {
    expect(() => resolveBinaryPath("linux", "arm64")).toThrow();
  });
});
