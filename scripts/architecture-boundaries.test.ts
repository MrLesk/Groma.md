import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { checkArchitectureBoundaries } from "./architecture-boundaries.ts";

const temporaryDirectories: string[] = [];

async function createSourceFixture(files: Readonly<Record<string, string>>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "groma-boundaries-"));
  temporaryDirectories.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const file = path.join(root, relativePath);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, contents);
  }

  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("architecture boundary checker", () => {
  test("accepts the declared dependency direction and Bun test imports", async () => {
    const sourceRoot = await createSourceFixture({
      "application/index.ts": 'import type { Entity } from "../core/index.ts";',
      "cli/main.test.ts": 'import { test } from "bun:test"; import "../host/index.ts";',
      "core/index.ts": "export interface Entity { readonly id: string }",
      "host/index.ts": 'import "../persistence/index.ts"; import "../application/index.ts";',
      "persistence/index.ts": 'import type { Entity } from "../core/index.ts";',
      "standard-model/index.ts": 'export type { Entity } from "../core/index.ts";',
    });

    expect(await checkArchitectureBoundaries(sourceRoot)).toEqual([]);
  });

  test("rejects every prohibited Core dependency family", async () => {
    const sourceRoot = await createSourceFixture({
      "cli/index.ts": "export {};",
      "core/index.ts": [
        'import "../host/index.ts";',
        'import "../cli/index.ts";',
        'import "bun";',
        'import "node:fs";',
        'import "marked";',
        'import "node:http";',
        'import "react";',
      ].join("\n"),
      "host/index.ts": "export {};",
    });

    const violations = await checkArchitectureBoundaries(sourceRoot);

    expect(violations).toHaveLength(7);
    expect(violations.map((violation) => violation.specifier)).toEqual([
      "../cli/index.ts",
      "../host/index.ts",
      "bun",
      "marked",
      "node:fs",
      "node:http",
      "react",
    ]);
  });

  test("checks exports, dynamic imports, import types, and require calls", async () => {
    const sourceRoot = await createSourceFixture({
      "core/index.ts": [
        'export * from "../host/index.ts";',
        'const dynamicHost = import("../host/index.ts");',
        'type Host = import("../host/index.ts").Host;',
        'const requiredHost = require("../host/index.ts");',
        "void dynamicHost; void requiredHost;",
      ].join("\n"),
      "host/index.ts": "export interface Host {}",
    });

    expect(await checkArchitectureBoundaries(sourceRoot)).toHaveLength(4);
  });

  test("rejects unresolved relative imports and source outside a boundary", async () => {
    const sourceRoot = await createSourceFixture({
      "core/index.ts": 'import "./missing.ts";',
      "orphan.ts": "export {};",
    });

    expect(await checkArchitectureBoundaries(sourceRoot)).toEqual([
      {
        file: "core/index.ts",
        reason: "Relative import does not resolve to a TypeScript source file",
        specifier: "./missing.ts",
      },
      {
        file: "orphan.ts",
        reason: "TypeScript source must live in a declared architectural boundary",
      },
    ]);
  });
});
