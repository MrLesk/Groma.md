import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { checkArchitectureBoundaries } from "../architecture-boundaries.ts";

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

  test("rejects unverifiable dynamic dependencies without matching unrelated calls", async () => {
    const sourceRoot = await createSourceFixture({
      "core/index.ts": [
        'const moduleName = "../host/index.ts";',
        "void import(moduleName);",
        "void require(moduleName);",
        "void require?.(moduleName);",
        "void load(moduleName);",
        "void loader.require(moduleName);",
        "void require.resolve(moduleName);",
      ].join("\n"),
    });

    expect(await checkArchitectureBoundaries(sourceRoot)).toEqual([
      {
        file: "core/index.ts",
        reason:
          "Dynamic import dependency must use a string literal so its architectural boundary can be verified",
      },
      {
        file: "core/index.ts",
        reason:
          "Require dependency must use a string literal so its architectural boundary can be verified",
      },
      {
        file: "core/index.ts",
        reason:
          "Require dependency must use a string literal so its architectural boundary can be verified",
      },
    ]);
  });

  test("rejects direct ambient require with literal and non-literal dependencies", async () => {
    const sourceRoot = await createSourceFixture({
      "core/index.ts": [
        'const moduleName = "node:fs";',
        'void require("node:fs");',
        "void require(moduleName);",
      ].join("\n"),
    });

    expect(await checkArchitectureBoundaries(sourceRoot)).toEqual([
      {
        file: "core/index.ts",
        reason:
          "Require dependency must use a string literal so its architectural boundary can be verified",
      },
      {
        file: "core/index.ts",
        reason: "core production code cannot import external modules",
        specifier: "node:fs",
      },
    ]);
  });

  test("rejects ambient require aliases and other escaping references", async () => {
    const sourceRoot = await createSourceFixture({
      "core/index.ts": ["const load = require;", "consume(require);", 'void load("node:fs");'].join(
        "\n",
      ),
    });

    const violations = await checkArchitectureBoundaries(sourceRoot);
    expect(violations).toHaveLength(2);
    expect(violations.map((violation) => violation.reason)).toEqual([
      "Ambient require cannot be aliased or used as a value because its dependencies cannot be verified",
      "Ambient require cannot be aliased or used as a value because its dependencies cannot be verified",
    ]);
  });

  test("does not treat a lexically shadowed local require as a module dependency", async () => {
    const sourceRoot = await createSourceFixture({
      "core/index.ts": [
        "function useLocalRequire(): void {",
        "  function require(value: string): string { return value; }",
        '  require("node:fs");',
        "  const load = require;",
        '  load("node:http");',
        "}",
        "void useLocalRequire;",
      ].join("\n"),
    });

    expect(await checkArchitectureBoundaries(sourceRoot)).toEqual([]);
  });

  test("ignores non-computed member require access and unrelated calls", async () => {
    const sourceRoot = await createSourceFixture({
      "core/index.ts": [
        'const moduleName = "node:fs";',
        "void load(moduleName);",
        "void loader.require(moduleName);",
        "void require.resolve(moduleName);",
      ].join("\n"),
    });

    expect(await checkArchitectureBoundaries(sourceRoot)).toEqual([]);
  });

  test("does not treat type-only imports as runtime require bindings", async () => {
    const sourceRoot = await createSourceFixture({
      "core/declaration-type.ts": [
        'import type { X as require } from "./types.ts";',
        'void require("node:fs");',
      ].join("\n"),
      "core/import-equals-type.ts": [
        'import type require = require("./types.ts");',
        'void require("node:fs");',
      ].join("\n"),
      "core/runtime.ts": [
        'import { X as require } from "./types.ts";',
        'void require("node:http");',
      ].join("\n"),
      "core/specifier-type.ts": [
        'import { type X as require } from "./types.ts";',
        'void require("node:fs");',
      ].join("\n"),
      "core/types.ts": "export const X = (value: string): string => value;",
    });

    expect(await checkArchitectureBoundaries(sourceRoot)).toEqual([
      {
        file: "core/declaration-type.ts",
        reason: "core production code cannot import external modules",
        specifier: "node:fs",
      },
      {
        file: "core/import-equals-type.ts",
        reason: "core production code cannot import external modules",
        specifier: "node:fs",
      },
      {
        file: "core/specifier-type.ts",
        reason: "core production code cannot import external modules",
        specifier: "node:fs",
      },
    ]);
  });

  test("distinguishes runtime namespaces from ambient namespace declarations", async () => {
    const sourceRoot = await createSourceFixture({
      "core/ambient.ts": [
        "declare namespace require { const value: number; }",
        'void require("node:fs");',
      ].join("\n"),
      "core/runtime.ts": [
        "namespace require { export const value = 1; }",
        'void require("node:http");',
      ].join("\n"),
    });

    expect(await checkArchitectureBoundaries(sourceRoot)).toEqual([
      {
        file: "core/ambient.ts",
        reason: "core production code cannot import external modules",
        specifier: "node:fs",
      },
    ]);
  });

  test("keeps inner runtime and ambient namespace require declarations namespace-local", async () => {
    const sourceRoot = await createSourceFixture({
      "core/ambient-inner.ts": [
        "declare namespace holder { var require: (value: string) => string; }",
        'void require("node:http");',
      ].join("\n"),
      "core/runtime-inner.ts": [
        "namespace holder { export var require = (value: string): string => value; }",
        'void require("node:fs");',
      ].join("\n"),
    });

    expect(await checkArchitectureBoundaries(sourceRoot)).toEqual([
      {
        file: "core/ambient-inner.ts",
        reason: "core production code cannot import external modules",
        specifier: "node:http",
      },
      {
        file: "core/runtime-inner.ts",
        reason: "core production code cannot import external modules",
        specifier: "node:fs",
      },
    ]);
  });

  test("treats computed ambient require member keys as value escapes", async () => {
    const sourceRoot = await createSourceFixture({
      "core/index.ts": [
        "void registry[require];",
        "void loader.require;",
        'void require.resolve("node:fs");',
      ].join("\n"),
    });

    expect(await checkArchitectureBoundaries(sourceRoot)).toEqual([
      {
        file: "core/index.ts",
        reason:
          "Ambient require cannot be aliased or used as a value because its dependencies cannot be verified",
      },
    ]);
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
