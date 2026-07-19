import { describe, expect, test } from "bun:test";

import {
  CLI_MAX_ARGUMENTS,
  CLI_MAX_CURSOR_CHARACTERS,
  CLI_MAX_SEARCH_CHARACTERS,
  CLI_MAX_TRAVERSAL_DEPTH,
} from "../contracts.ts";
import { parseInvocation } from "../parser.ts";

describe("CLI provisional grammar", () => {
  test("parses every operation and both structured input forms", () => {
    const projectId = "project_11111111111111111111111111111111";
    const projectRevision = `sha256:${"a".repeat(64)}`;
    const cases = [
      [[], { kind: "overview" }],
      [["init"], { kind: "init" }],
      [["blueprint", "export", "--limit", "5"], { kind: "blueprint-export", limit: 5 }],
      [
        ["blueprint", "search", "order lifecycle", "--limit", "5"],
        { kind: "blueprint-search", limit: 5, text: "order lifecycle" },
      ],
      [
        ["blueprint", "search", "--legacy", "--limit", "1"],
        { kind: "blueprint-search", limit: 1, text: "--legacy" },
      ],
      [
        [
          "blueprint",
          "traverse",
          "ent_01",
          "--limit",
          "5",
          "--relation-type",
          "depends-on",
          "--depth",
          "3",
          "--direction",
          "both",
        ],
        {
          depth: 3,
          direction: "both",
          id: "ent_01",
          kind: "blueprint-traverse",
          limit: 5,
          relationType: "depends-on",
        },
      ],
      [["project", "add", "--input", "project.json"], { kind: "project-add" }],
      [["project", "add", "--stdin"], { kind: "project-add" }],
      [["project", "get", projectId], { id: projectId, kind: "project-get" }],
      [["project", "list"], { kind: "project-list" }],
      [
        ["project", "update", projectId, "--revision", projectRevision, "--input", "project.json"],
        { expectedRevision: projectRevision, id: projectId, kind: "project-update" },
      ],
      [
        ["project", "remove", projectId, "--revision", projectRevision],
        { expectedRevision: projectRevision, id: projectId, kind: "project-remove" },
      ],
      [["component", "create", "--input", "request.json"], { kind: "component-create" }],
      [["component", "create", "--stdin"], { kind: "component-create" }],
      [
        ["component", "get", "ent_01", "--relationships-limit", "5"],
        { id: "ent_01", kind: "component-get", relationships: { limit: 5 } },
      ],
      [["component", "list", "--limit", "5"], { kind: "component-list", limit: 5 }],
      [["component", "roots", "--limit", "5"], { kind: "component-roots", limit: 5 }],
      [
        ["component", "children", "ent_01", "--limit", "5"],
        { kind: "component-children", limit: 5, parent: "ent_01" },
      ],
      [["component", "update", "--input", "-"], { kind: "component-update" }],
      [
        ["component", "merge", "ent_01", "--into", "ent_02", "--revision", "rev_01"],
        {
          expectedRevision: "rev_01",
          kind: "component-merge",
          obsolete: "ent_01",
          survivor: "ent_02",
        },
      ],
      [
        ["component", "reparent", "ent_01", "--revision", "rev_01", "--parent", "ent_02"],
        { expectedRevision: "rev_01", id: "ent_01", kind: "component-reparent", parent: "ent_02" },
      ],
      [
        ["component", "reparent", "ent_01", "--root", "--revision", "rev_01"],
        { expectedRevision: "rev_01", id: "ent_01", kind: "component-reparent", parent: null },
      ],
      [
        ["component", "remove", "ent_01", "--revision", "rev_01"],
        { expectedRevision: "rev_01", id: "ent_01", kind: "component-remove" },
      ],
    ] as const;

    for (const [args, command] of cases) {
      const parsed = parseInvocation(args);
      expect(parsed.ok).toBeTrue();
      if (parsed.ok) expect(parsed.invocation.command as unknown).toMatchObject(command);
    }
  });

  test("rejects ambiguous or malformed project identity and revision channels", () => {
    const id = "project_11111111111111111111111111111111";
    const revision = `sha256:${"a".repeat(64)}`;
    for (const args of [
      ["project", "get", "project_bad"],
      ["project", "list", "extra"],
      ["project", "update", id, "--revision", "bad", "--stdin"],
      ["project", "update", id, "--revision", revision, "--revision", revision, "--stdin"],
      ["project", "update", id, "--revision", revision, "--stdin", "--input", "other.json"],
      ["project", "remove", id, "--revision", "sha256:ABC"],
    ]) {
      expect(parseInvocation(args)).toMatchObject({
        diagnostic: { code: "cli-invalid-invocation" },
        ok: false,
      });
    }
  });

  test("accepts a leading global format and explicit cursors", () => {
    expect(
      parseInvocation([
        "--format=json",
        "component",
        "get",
        "ent_01",
        "--relationships-cursor",
        "cursor",
        "--relationships-limit",
        "10",
      ]),
    ).toMatchObject({
      invocation: {
        command: { relationships: { cursor: "cursor", limit: 10 } },
        format: "json",
      },
      ok: true,
    });
    const maximumCursor = "c".repeat(CLI_MAX_CURSOR_CHARACTERS);
    expect(
      parseInvocation([
        "blueprint",
        "traverse",
        "ent_01",
        "--direction",
        "incoming",
        "--depth",
        "1",
        "--limit",
        "1",
        "--cursor",
        maximumCursor,
      ]),
    ).toMatchObject({
      invocation: { command: { cursor: maximumCursor, kind: "blueprint-traverse" } },
      ok: true,
    });
  });

  test("bounds fixed blueprint search text while preserving a leading option marker", () => {
    const maximumSearch = `--${"x".repeat(CLI_MAX_SEARCH_CHARACTERS - 2)}`;
    expect(maximumSearch.length).toBe(CLI_MAX_SEARCH_CHARACTERS);
    expect(parseInvocation(["blueprint", "search", maximumSearch, "--limit", "1"])).toMatchObject({
      invocation: {
        command: { kind: "blueprint-search", limit: 1, text: maximumSearch },
      },
      ok: true,
    });
    expect(
      parseInvocation(["blueprint", "search", `${maximumSearch}x`, "--limit", "1"]),
    ).toMatchObject({ diagnostic: { code: "cli-invalid-invocation" }, ok: false });
  });

  test("bounds the official traversal depth without changing option grammar", () => {
    const invocation = (depth: number) =>
      parseInvocation([
        "blueprint",
        "traverse",
        "ent_01",
        "--limit",
        "1",
        "--depth",
        String(depth),
        "--direction",
        "both",
      ]);
    expect(invocation(CLI_MAX_TRAVERSAL_DEPTH)).toMatchObject({
      invocation: {
        command: {
          depth: CLI_MAX_TRAVERSAL_DEPTH,
          direction: "both",
          kind: "blueprint-traverse",
          limit: 1,
        },
      },
      ok: true,
    });
    expect(invocation(CLI_MAX_TRAVERSAL_DEPTH + 1)).toMatchObject({
      diagnostic: { code: "cli-invalid-invocation" },
      ok: false,
    });
  });

  test("requires finite explicit pages and exact option sets", () => {
    for (const args of [
      ["blueprint", "export"],
      ["blueprint", "export", "--limit", "0"],
      ["blueprint", "search", "orders"],
      ["blueprint", "search", "--limit", "1"],
      [
        "blueprint",
        "traverse",
        "ent_01",
        "--direction",
        "sideways",
        "--depth",
        "1",
        "--limit",
        "1",
      ],
      ["blueprint", "traverse", "ent_01", "--direction", "both", "--limit", "1"],
      ["blueprint", "traverse", "ent_01", "--direction", "both", "--depth", "0", "--limit", "1"],
      [
        "blueprint",
        "export",
        "--limit",
        "1",
        "--cursor",
        "c".repeat(CLI_MAX_CURSOR_CHARACTERS + 1),
      ],
      ["component", "list"],
      ["component", "list", "--limit", "0"],
      ["component", "list", "--limit", "101"],
      ["component", "list", "--limit", "1", "--limit", "1"],
      ["component", "get", "ent_01", "--relationships-limit", "1", "extra"],
      ["component", "create", "--stdin", "--input", "request.json"],
      ["component", "reparent", "ent_01", "--revision", "rev_01"],
      ["component", "merge", "ent_01", "--into", "ent_02"],
      ["component", "merge", "ent_01", "--revision", "rev_01"],
      ["component", "reparent", "ent_01", "--revision", "rev_01", "--root", "--parent", "ent_02"],
      [
        "package",
        "enable",
        "example",
        "./panel.js",
        "--trust-full-user-permissions",
        "--trust-full-user-permissions",
      ],
      ["package", "disable", "example", "./panel.js", "--trust-full-user-permissions"],
      ["package", "add", "./example", "--personal", "--personal"],
      ["package", "add", "--personal"],
      ["package", "inspect", "--personal"],
      ["package", "enable", "example", "--personal"],
      ["package", "disable", "example", "--personal"],
      ["package", "remove", "--personal"],
      ["package", "scaffold", "./example"],
      ["package", "scaffold", "./example", "--name", "example", "--plugin", "example.plugin"],
      [
        "package",
        "scaffold",
        "./example",
        "--name",
        "example",
        "--name",
        "again",
        "--plugin",
        "example.plugin",
        "--provides",
        "example.capability/v1",
      ],
      [
        "package",
        "scaffold",
        "./example",
        "--name",
        "example",
        "--plugin",
        "example.plugin",
        "--unknown",
        "example.capability/v1",
      ],
      ["--format", "yaml", "init"],
    ]) {
      expect(parseInvocation(args)).toMatchObject({ ok: false });
    }
  });

  test("bounds argument count and total characters", () => {
    expect(parseInvocation(Array.from({ length: CLI_MAX_ARGUMENTS + 1 }, () => "x"))).toMatchObject(
      {
        ok: false,
      },
    );
    expect(parseInvocation(["x".repeat(65_537)])).toMatchObject({ ok: false });
    expect(
      parseInvocation([
        "--format",
        "json",
        ...Array.from({ length: CLI_MAX_ARGUMENTS }, () => "x"),
      ]),
    ).toMatchObject({ format: "json", ok: false });
  });
});
