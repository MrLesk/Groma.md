import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

describe("CLI dependency boundary", () => {
  test("uses the host and application API without persistence or resource internals", async () => {
    const root = path.resolve(import.meta.dir, "..");
    const files = (await readdir(root)).filter((file) => file.endsWith(".ts")).sort();
    const sources = await Promise.all(files.map((file) => readFile(path.join(root, file), "utf8")));
    const production = sources.join("\n");

    expect(production).not.toMatch(/\.\.\/persistence|markdown-intent|local-resource/i);
    expect(production).toContain("../application/index.ts");
    expect(production).toContain("../host/index.ts");
  });
});
