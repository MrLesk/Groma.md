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

  test("draws the branded technical sheet with byte-exact canonical brand marks", async () => {
    const rendered = renderBlueprintHtml(fixture);
    expect(rendered.ok).toBeTrue();
    if (!rendered.ok) return;
    const canonicalMark = (
      await readFile(new URL("../../../brand/mark-frontal.svg", import.meta.url), "utf8")
    ).trim();
    expect(rendered.html).toContain(
      `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(canonicalMark)}">`,
    );
    expect(rendered.html).toContain("ARCHITECTURAL BLUEPRINT");
    expect(rendered.html).toContain("<th>DIAGRAM</th><td>CURRENT BLUEPRINT</td>");
    expect(rendered.html).toContain("<th>GENERATION</th><td>7</td>");
    expect(rendered.html).toContain("<th>NODES</th><td>2</td>");
    expect(rendered.html).toContain("<span>01</span>");
    expect(rendered.html).toContain("<span>12</span>");
    expect(rendered.html).toContain("<span>A</span>");
    expect(rendered.html).toContain("<span>H</span>");
    expect(rendered.html).toContain('class="reg reg-tl"');
    expect(rendered.html).toContain('class="reg reg-br"');
    expect(rendered.html).toContain("<th>CONVENTION</th><td>GROMA ARCHITECTURE BLUEPRINT</td>");
    expect(rendered.html).toContain("<th>SCALE</th><td>LOGICAL</td>");
    expect(rendered.html).toContain("<th>UNITS</th><td>LOGICAL</td>");
    expect(rendered.html).toContain("surveyed root point");
  });
});
