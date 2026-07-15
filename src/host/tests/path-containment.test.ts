import { describe, expect, test } from "bun:test";
import path from "node:path";

import { isPathWithin } from "../path-containment.ts";

describe("path containment", () => {
  test("rejects Windows cross-volume and sibling paths", () => {
    expect(isPathWithin("C:\\repo", "C:\\repo\\plugins\\example", path.win32)).toBe(true);
    expect(isPathWithin("C:\\repo", "C:\\repository", path.win32)).toBe(false);
    expect(isPathWithin("C:\\repo", "D:\\repo\\plugins\\example", path.win32)).toBe(false);
    expect(isPathWithin("C:\\repo\\plugins", "C:\\repo", path.win32)).toBe(false);
  });

  test("rejects the exact parent path with the native implementation", () => {
    expect(isPathWithin("/repo/plugins", "/repo")).toBe(false);
  });

  test("fails closed across different Windows canonical path spellings", () => {
    expect(
      isPathWithin(
        "C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\workspace",
        "C:\\Users\\runneradmin\\AppData\\Local\\Temp\\workspace\\local-package",
        path.win32,
      ),
    ).toBe(false);
    expect(
      isPathWithin(
        "C:\\Users\\runneradmin\\AppData\\Local\\Temp\\workspace",
        "C:\\Users\\runneradmin\\AppData\\Local\\Temp\\workspace\\local-package",
        path.win32,
      ),
    ).toBe(true);
    expect(isPathWithin("D:\\repo", "\\\\?\\D:\\repo\\plugins\\example", path.win32)).toBe(false);
    expect(isPathWithin("\\\\?\\D:\\repo", "D:\\repo\\plugins\\example", path.win32)).toBe(false);
  });
});
