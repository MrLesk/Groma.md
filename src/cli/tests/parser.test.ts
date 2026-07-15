import { describe, expect, test } from "bun:test";

import { CLI_MAX_ARGUMENTS } from "../contracts.ts";
import { parseInvocation } from "../parser.ts";

describe("CLI provisional grammar", () => {
  test("parses every operation and both structured input forms", () => {
    const cases = [
      [[], { kind: "overview" }],
      [["init"], { kind: "init" }],
      [["package", "add", "./plugins/example"], { kind: "package-add", scope: "blueprint" }],
      [
        ["package", "inspect", "example", "--personal"],
        { kind: "package-inspect", scope: "personal" },
      ],
      [
        [
          "package",
          "enable",
          "example",
          "./plugins/panel.js",
          "--trust-full-user-permissions",
          "--personal",
        ],
        { kind: "package-enable", scope: "personal", trustFullUserPermissions: true },
      ],
      [["package", "disable", "example", "./plugins/panel.js"], { kind: "package-disable" }],
      [["package", "remove", "example"], { kind: "package-remove" }],
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
  });

  test("requires finite explicit pages and exact option sets", () => {
    for (const args of [
      ["component", "list"],
      ["component", "list", "--limit", "0"],
      ["component", "list", "--limit", "101"],
      ["component", "list", "--limit", "1", "--limit", "1"],
      ["component", "get", "ent_01", "--relationships-limit", "1", "extra"],
      ["component", "create", "--stdin", "--input", "request.json"],
      ["component", "reparent", "ent_01", "--revision", "rev_01"],
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
