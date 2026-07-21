import { describe, expect, test } from "bun:test";

import type { StaticBlueprintSnapshot } from "../client/api.ts";
import { assembleStaticBlueprintHtml } from "../export.ts";

describe("static blueprint bundle", () => {
  test("inlines the client and safely bakes canonical snapshot JSON", () => {
    const replacementTokens = "$& $` $'";
    const clientScript =
      'var load = ($, value) => () => ($ && (value = $(value)), value); globalThis.tokens = "$& $` $\'";';
    const stylesheet = `body::after { content: "${replacementTokens}"; }`;
    const snapshot: StaticBlueprintSnapshot = {
      format: "groma-read-only-blueprint-v1",
      generation: 4,
      items: [
        {
          component: {
            id: "ent_1",
            kind: "component",
            name: `</script><script>bad()</script> ${replacementTokens}`,
          },
          relationships: [],
        },
      ],
    };
    const first = assembleStaticBlueprintHtml(
      {
        document:
          '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src self"><link rel="stylesheet" href="client.css"></head><body><div id="root"></div><script type="module" src="client.js"></script></body></html>',
        scripts: [clientScript],
        stylesheets: [stylesheet],
      },
      snapshot,
    );
    const second = assembleStaticBlueprintHtml(
      {
        document:
          '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src self"><link rel="stylesheet" href="client.css"></head><body><div id="root"></div><script type="module" src="client.js"></script></body></html>',
        scripts: [clientScript],
        stylesheets: [stylesheet],
      },
      snapshot,
    );
    expect(first).toBe(second);
    expect(first).toContain(`<style>${stylesheet}</style>`);
    expect(first).toContain(`<script type="module">${clientScript}</script>`);
    expect(first).toContain("\\u003c/script>");
    expect(first).toContain(`bad()\\u003c/script> ${replacementTokens}`);
    expect(first).toContain("connect-src 'none'");
    expect(first).not.toContain("<script>bad()");
    expect(first).not.toContain("client.css");
    expect(first).not.toContain("client.js");
  });
});
