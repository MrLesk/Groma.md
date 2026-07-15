import { describe, expect, test } from "bun:test";
import path from "node:path";

import { isPathWithin } from "../path-containment.ts";

describe("path containment", () => {
  test("rejects Windows cross-volume and sibling paths", () => {
    expect(isPathWithin("C:\\repo", "C:\\repo\\plugins\\example", path.win32)).toBe(true);
    expect(isPathWithin("C:\\repo", "C:\\repository", path.win32)).toBe(false);
    expect(isPathWithin("C:\\repo", "D:\\repo\\plugins\\example", path.win32)).toBe(false);
  });
});
