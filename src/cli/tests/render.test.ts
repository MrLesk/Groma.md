import { describe, expect, test } from "bun:test";

import { CLI_MAX_RENDERED_BYTES, type CliCommandResult } from "../contracts.ts";
import { renderCommandResult } from "../render.ts";

describe("CLI rendering", () => {
  test("canonicalizes JSON with the command exit class", () => {
    const value: CliCommandResult = {
      command: "component get",
      exitCode: 4,
      ok: false,
      result: { z: 1, diagnostics: [{ message: "No", code: "missing" }], a: true },
    };

    expect(renderCommandResult(value, "json")).toEqual({
      ok: true,
      text: '{"command":"component get","exitCode":4,"ok":false,"result":{"a":true,"diagnostics":[{"code":"missing","message":"No"}],"z":1}}\n',
    });
  });

  test("quotes terminal-controlled component text and emits no ANSI", () => {
    const rendered = renderCommandResult(
      {
        command: "overview",
        exitCode: 0,
        ok: true,
        result: {
          generation: 1,
          kind: "hierarchy",
          nodes: [
            {
              depth: 0,
              displayText: "\u001b[32mdisplay",
              id: "ent_01\nforged",
              name: "\u001b[31mred",
              revision: "rev_01",
            },
          ],
          truncations: [],
        },
      },
      "plain",
    );

    expect(rendered).toMatchObject({ ok: true });
    if (rendered.ok) {
      expect(rendered.text).toContain('id="ent_01\\nforged"');
      expect(rendered.text).toContain('display="\\u001b[32mdisplay"');
      expect(rendered.text).toContain('name="\\u001b[31mred"');
      expect(rendered.text).not.toContain("\u001b");
    }
  });

  test("renders bare-command failures as diagnostics instead of hierarchy data", () => {
    expect(
      renderCommandResult(
        {
          command: "overview",
          exitCode: 3,
          ok: false,
          result: {
            diagnostics: [{ code: "workspace-configuration-conflict", message: "Conflict" }],
            ok: false,
          },
        },
        "plain",
      ),
    ).toEqual({
      ok: true,
      text: 'command: overview\nexit-code: 3\nok: false\nresult: {"diagnostics":[{"code":"workspace-configuration-conflict","message":"Conflict"}],"ok":false}\n',
    });
  });

  test("fails closed when output exceeds the byte bound", () => {
    expect(
      renderCommandResult(
        {
          command: "component get",
          exitCode: 0,
          ok: true,
          result: { value: "x".repeat(CLI_MAX_RENDERED_BYTES) },
        },
        "json",
      ),
    ).toEqual({ ok: false });
  });

  test("renders blueprint page-bound guidance identically in plain and JSON results", () => {
    for (const [command, code, noun, bound, maximum] of [
      [
        "blueprint export",
        "blueprint-export-page-bound-exceeded",
        "export item",
        "utf8-bytes",
        8_323_072,
      ],
      [
        "blueprint search",
        "blueprint-search-page-bound-exceeded",
        "component",
        "utf8-bytes",
        8_323_072,
      ],
      [
        "blueprint traverse",
        "blueprint-traverse-page-bound-exceeded",
        "traversal hit",
        "utf8-bytes",
        8_323_072,
      ],
      ["blueprint search", "blueprint-search-page-bound-exceeded", "component", "depth", 28],
    ] as const) {
      const result: CliCommandResult = {
        command,
        exitCode: 4,
        ok: false,
        result: {
          diagnostics: [
            {
              code,
              details: { bound, maximum },
              message: `The page is too large; retry with a smaller --limit. If --limit 1 fails, one ${noun} is too large`,
            },
          ],
          ok: false,
        },
      };

      const json = renderCommandResult(result, "json");
      const plain = renderCommandResult(result, "plain");
      expect(json).toMatchObject({ ok: true });
      expect(plain).toMatchObject({ ok: true });
      if (json.ok && plain.ok) {
        const jsonResult = (JSON.parse(json.text) as { readonly result: unknown }).result;
        const plainResult = JSON.parse(plain.text.slice(plain.text.indexOf("result: ") + 8));
        expect(plainResult).toEqual(jsonResult);
        expect(plain.text).toContain("smaller --limit");
        expect(plain.text).toContain(code);
        expect(plain.text).not.toContain("cli-output-bound-exceeded");
      }
    }
  });

  test("rejects arrays with extra own properties instead of dropping data", () => {
    const items: unknown[] = ["visible"];
    Object.defineProperty(items, "secret", { enumerable: true, value: "must-not-disappear" });

    expect(
      renderCommandResult(
        {
          command: "component list",
          exitCode: 0,
          ok: true,
          result: { items },
        },
        "json",
      ),
    ).toEqual({ ok: false });
  });
});
