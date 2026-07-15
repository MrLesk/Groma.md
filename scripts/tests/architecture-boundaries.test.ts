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
      "host/index.ts": [
        'import "../persistence/index.ts";',
        'import "../application/index.ts";',
        'import "groma/plugin-sdk";',
        'import "groma/plugin-sdk/conformance";',
      ].join("\n"),
      "persistence/index.ts": 'import type { Entity } from "../core/index.ts";',
      "plugin-sdk/index.ts": 'export type { Entity } from "../core/index.ts";',
      "standard-model/index.ts": 'export type { Entity } from "../core/index.ts";',
    });

    expect(await checkArchitectureBoundaries(sourceRoot)).toEqual([]);
  });

  test("keeps the public plugin SDK as a one-way facade over Core", async () => {
    const sourceRoot = await createSourceFixture({
      "core/index.ts": 'import "../plugin-sdk/index.ts";',
      "host/index.ts": "export interface Host {}",
      "plugin-sdk/index.ts": 'export type { Host } from "../host/index.ts";',
    });

    expect(await checkArchitectureBoundaries(sourceRoot)).toEqual([
      {
        file: "core/index.ts",
        reason: "core cannot depend on plugin-sdk",
        specifier: "../plugin-sdk/index.ts",
      },
      {
        file: "plugin-sdk/index.ts",
        reason: "plugin-sdk cannot depend on host",
        specifier: "../host/index.ts",
      },
    ]);
  });

  test("maps relative and package self-reference imports through the plugin SDK layer", async () => {
    const sourceRoot = await createSourceFixture({
      "cli/conformance.ts": 'import "groma/plugin-sdk/conformance";',
      "persistence/authoring.ts": 'import "groma/plugin-sdk";',
      "persistence/relative.ts": 'import "../plugin-sdk/index.ts";',
      "plugin-sdk/index.ts": "export {};",
    });

    expect(await checkArchitectureBoundaries(sourceRoot)).toEqual([
      {
        file: "cli/conformance.ts",
        reason: "cli cannot depend on plugin-sdk",
        specifier: "groma/plugin-sdk/conformance",
      },
      {
        file: "persistence/authoring.ts",
        reason: "persistence cannot depend on plugin-sdk",
        specifier: "groma/plugin-sdk",
      },
      {
        file: "persistence/relative.ts",
        reason: "persistence cannot depend on plugin-sdk",
        specifier: "../plugin-sdk/index.ts",
      },
    ]);
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

  test("checks every literal module form while preserving other-layer require analysis", async () => {
    const sourceRoot = await createSourceFixture({
      "cli/index.ts": "export {};",
      "core/index.ts": [
        'export * from "../host/index.ts";',
        'const dynamicHost = import("../host/index.ts");',
        'type Host = import("../host/index.ts").Host;',
        "void dynamicHost;",
      ].join("\n"),
      "host/index.ts": "export interface Host {}",
      "persistence/index.ts": 'void require("../cli/index.ts");',
    });

    const violations = await checkArchitectureBoundaries(sourceRoot);
    expect(violations).toHaveLength(4);
    expect(violations.map((violation) => violation.specifier)).toEqual([
      "../host/index.ts",
      "../host/index.ts",
      "../host/index.ts",
      "../cli/index.ts",
    ]);
  });

  test("keeps dynamic imports fail closed and reserves constrained require calls", async () => {
    const sourceRoot = await createSourceFixture({
      "core/index.ts": [
        'const moduleName = "../host/index.ts";',
        "void import(moduleName);",
        "void require(moduleName);",
        "void loader.require(moduleName);",
        "void load(moduleName);",
      ].join("\n"),
      "host/index.ts": ['const moduleName = "node:fs";', "void require(moduleName);"].join("\n"),
    });

    expect(await checkArchitectureBoundaries(sourceRoot)).toEqual([
      {
        file: "core/index.ts",
        reason:
          "core production code reserves bare require identifiers; use ESM imports or an injected capability",
      },
      {
        file: "core/index.ts",
        reason:
          "Dynamic import dependency must use a string literal so its architectural boundary can be verified",
      },
      {
        file: "host/index.ts",
        reason:
          "Require dependency must use a string literal so its architectural boundary can be verified",
      },
    ]);
  });

  test("allows exactly one nonliteral import only at the audited local plugin loader boundary", async () => {
    const allowed = await createSourceFixture({
      "host/plugin-module-loader.ts": "export const load = (url: string) => import(url);",
    });
    expect(await checkArchitectureBoundaries(allowed)).toEqual([]);

    const expanded = await createSourceFixture({
      "host/plugin-module-loader.ts": [
        "export const load = (url: string) => import(url);",
        "export const loadAgain = (url: string) => import(url);",
      ].join("\n"),
    });
    expect(await checkArchitectureBoundaries(expanded)).toEqual([
      {
        file: "host/plugin-module-loader.ts",
        reason:
          "Dynamic import dependency must use a string literal so its architectural boundary can be verified",
      },
      {
        file: "host/plugin-module-loader.ts",
        reason:
          "Dynamic import dependency must use a string literal so its architectural boundary can be verified",
      },
    ]);
  });

  test("reserves every bare require syntax in constrained production layers", async () => {
    const sourceRoot = await createSourceFixture({
      "application/type-only.ts": 'import type { X as require } from "./types.ts";',
      "application/types.ts": "export interface X {}",
      "core/alias.ts": "const load = require; void load;",
      "core/ambient-namespace.ts": "declare namespace require { const value: number; }",
      "core/computed-key.ts": "void registry[require];",
      "core/default-parameter.ts": [
        "function run(value = require): void {",
        "  var require = value;",
        "  void require;",
        "}",
        "void run;",
      ].join("\n"),
      "core/direct-literal.ts": 'void require("node:fs");',
      "core/direct-nonliteral.ts": "void require(moduleName);",
      "core/member-object.ts": 'void require.resolve("node:fs");',
      "core/runtime-namespace.ts": "namespace require { export const value = 1; }",
      "core/static-block.ts": "class Holder { static { var require = 1; void require; } }",
      "standard-model/local-function.ts": [
        "function require(value: string): string { return value; }",
        'void require("local");',
      ].join("\n"),
    });

    const violations = await checkArchitectureBoundaries(sourceRoot);
    expect(violations.map((violation) => violation.file)).toEqual([
      "application/type-only.ts",
      "core/alias.ts",
      "core/ambient-namespace.ts",
      "core/computed-key.ts",
      "core/default-parameter.ts",
      "core/direct-literal.ts",
      "core/direct-nonliteral.ts",
      "core/member-object.ts",
      "core/runtime-namespace.ts",
      "core/static-block.ts",
      "standard-model/local-function.ts",
    ]);
    expect(violations.every((violation) => violation.specifier === undefined)).toBeTrue();
    expect(
      violations.every((violation) =>
        violation.reason.endsWith(
          "production code reserves bare require identifiers; use ESM imports or an injected capability",
        ),
      ),
    ).toBeTrue();
  });

  test("allows require property tokens, unrelated calls, and compatible-layer literals", async () => {
    const sourceRoot = await createSourceFixture({
      "core/index.ts": [
        "interface Loader { require(value: string): string; }",
        "const loader = { require: (value: string): string => value };",
        "const { require: load } = loader;",
        'void loader.require("value");',
        'void load("value");',
        'void unrelated("value");',
      ].join("\n"),
      "host/index.ts": 'void require("node:http");',
      "persistence/index.ts": 'void require("node:fs");',
    });

    expect(await checkArchitectureBoundaries(sourceRoot)).toEqual([]);
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
