import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import type { CliOverviewResult } from "../contracts.ts";
import { renderBlueprintHtml } from "../blueprint-html.ts";

const fixture: Extract<CliOverviewResult, { readonly kind: "hierarchy" }> = Object.freeze({
  generation: 7,
  kind: "hierarchy",
  nodes: Object.freeze([
    Object.freeze({
      depth: 0,
      displayText: "Core",
      id: "ent_00000000000000000000000000000001",
      revision: "sha256:a",
      type: "domain",
    }),
    Object.freeze({
      depth: 1,
      displayText: "Transactions",
      id: "ent_00000000000000000000000000000002",
      name: "Transactions",
      revision: "sha256:b",
      type: "module",
    }),
  ]),
  truncations: Object.freeze([
    Object.freeze({ parent: "ent_00000000000000000000000000000002", reason: "depth" as const }),
  ]),
});

describe("local blueprint HTML", () => {
  test("renders deterministic self-contained architectural-sheet markup", async () => {
    const first = renderBlueprintHtml(fixture);
    const second = renderBlueprintHtml(fixture);
    expect(first).toEqual(second);
    expect(first.ok).toBeTrue();
    if (!first.ok) return;
    const canonicalLockup = (
      await readFile(new URL("../../../brand/lockup.svg", import.meta.url), "utf8")
    ).trim();
    expect(first.html).toContain(canonicalLockup);
    expect(first.html).toContain("#1D9E75");
    expect(first.html).toContain("Transactions");
    expect(first.html).toContain("Canonical name");
    expect(first.html).toContain("Bounded view stops here: depth limit.");
    expect(first.html).toContain(".node.selected>summary");
    expect(first.html).toContain("aria-current");
    expect(first.html).not.toContain("reachable through bounded focus");
    expect(first.html).not.toContain("https://");
    expect(first.html).not.toContain("linear-gradient");
  });

  test("presents the sheet inside a pannable zoomable canvas with disposable view state", () => {
    const rendered = renderBlueprintHtml(fixture);
    expect(rendered.ok).toBeTrue();
    if (!rendered.ok) return;
    expect(rendered.html).toContain('class="viewport" id="viewport"');
    expect(rendered.html).toContain('class="stage" id="stage"');
    expect(rendered.html).toContain('id="fit"');
    expect(rendered.html).toContain('aria-label="Zoom in"');
    expect(rendered.html).toContain('aria-label="Zoom out"');
    expect(rendered.html).toContain("overflow:hidden");
    expect(rendered.html).toContain("The view is never saved.");
    expect(rendered.html).not.toContain("localStorage");
    expect(rendered.html).not.toContain("sessionStorage");
    expect(rendered.html).not.toContain("indexedDB");
    expect(rendered.html).not.toContain("document.cookie");
    expect(rendered.html).not.toContain("fetch(");
  });
});
