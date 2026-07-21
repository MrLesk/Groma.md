import { describe, expect, test } from "bun:test";

import {
  observedSummaryFromDocumentation,
  OBSERVED_SUMMARY_MAX_CHARACTERS,
} from "../observed-documentation.ts";

describe("observed documentation", () => {
  test("carries the leading sentences of a directory readme, whole", () => {
    const summary = observedSummaryFromDocumentation(
      "# Persistence\n\nPersistence implements Groma's local adapters. It owns nothing else.\n",
      "markdown",
      "persistence",
    );
    expect(summary).toBe("Persistence implements Groma's local adapters. It owns nothing else.");
  });

  test("adds later sentences only while they fit whole within the budget", () => {
    const first = "Host is the composition root.";
    const long = ` It ${"connects and ".repeat(30)}wires everything.`;
    const summary = observedSummaryFromDocumentation(`${first}${long}`, "markdown", "host")!;
    // The overflowing second sentence is dropped whole rather than cut mid-word,
    // so the result never trails off in the middle of a thought.
    expect(summary).toBe(first);
    expect(summary.endsWith("…")).toBe(false);
  });

  test("walks past markup and badges to the first line of actual prose", () => {
    const summary = observedSummaryFromDocumentation(
      '<picture>\n  <img src="brand/lockup.svg" alt="groma.md" width="300">\n</picture>\n\n' +
        "# Groma\n\n" +
        "![build](https://example.invalid/badge.svg)\n\n" +
        "Groma keeps a living map of your system's architecture inside your repo.\n",
      "markdown",
      "groma",
    );
    expect(summary).toBe(
      "Groma keeps a living map of your system's architecture inside your repo.",
    );
  });

  test("stays silent when a document only names the thing it documents", () => {
    expect(observedSummaryFromDocumentation("# Core\n", "markdown", "core")).toBeUndefined();
    expect(observedSummaryFromDocumentation("", "markdown", "core")).toBeUndefined();
    expect(observedSummaryFromDocumentation("- one\n- two\n", "markdown")).toBeUndefined();
  });

  test("rejects a description that only restates the component name", () => {
    expect(
      observedSummaryFromDocumentation(
        "The standard blueprint model layer\n",
        "markdown",
        "the-standard-blueprint-model-layer",
      ),
    ).toBeUndefined();
  });

  test("keeps a clause that introduces a list rather than cutting it mid-thought", () => {
    expect(
      observedSummaryFromDocumentation(
        "# Core\n\nCore owns Groma's technology-neutral contracts:\n\n- identities;\n- transactions.\n",
        "markdown",
        "core",
      ),
    ).toBe("Core owns Groma's technology-neutral contracts");
  });

  test("strips comment syntax from a documentation block", () => {
    expect(
      observedSummaryFromDocumentation(
        "/**\n * Canonicalizes the data-bearing parts of a scanner request.\n * Second line.\n */",
        "text",
      ),
    ).toBe("Canonicalizes the data-bearing parts of a scanner request. Second line.");
  });

  test("reduces inline markdown to the words it decorates", () => {
    expect(
      observedSummaryFromDocumentation(
        "The **CLI** is a bounded adapter over [shared operations](./ops.md) and `stdin`.",
        "markdown",
        "cli",
      ),
    ).toBe("The CLI is a bounded adapter over shared operations and stdin.");
  });

  test("bounds a long description on a word boundary", () => {
    const summary = observedSummaryFromDocumentation(`${"alpha ".repeat(90)}beta`, "markdown");
    expect(summary!.length).toBeLessThanOrEqual(OBSERVED_SUMMARY_MAX_CHARACTERS + 1);
    expect(summary!.endsWith("…")).toBe(true);
    expect(summary).not.toContain("alph…");
  });
});

describe("observed documentation refuses program text", () => {
  test("never presents source code as a description", () => {
    expect(
      observedSummaryFromDocumentation(
        'import { join } from "node:path";\nimport { board } from "./board.ts";\n',
        "markdown",
        "src",
      ),
    ).toBeUndefined();
  });

  test("refuses an indented code block", () => {
    expect(
      observedSummaryFromDocumentation("    const value = compute(input, options);\n", "markdown"),
    ).toBeUndefined();
  });

  test("refuses declarations in other languages", () => {
    expect(observedSummaryFromDocumentation("package main\n", "markdown")).toBeUndefined();
    expect(
      observedSummaryFromDocumentation("func Handle(w http.ResponseWriter) error {\n", "markdown"),
    ).toBeUndefined();
    expect(
      observedSummaryFromDocumentation("public class Widget extends Thing {\n", "markdown"),
    ).toBeUndefined();
  });

  test("still accepts prose that merely mentions code-ish words", () => {
    expect(
      observedSummaryFromDocumentation(
        "The exporter writes a board file that other tools can import later.\n",
        "markdown",
      ),
    ).toBe("The exporter writes a board file that other tools can import later.");
  });
});
