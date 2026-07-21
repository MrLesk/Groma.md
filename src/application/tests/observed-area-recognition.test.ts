import { describe, expect, test } from "bun:test";

import { recognizeObservedArea } from "../observed-area-recognition.ts";

describe("observed area recognition", () => {
  test("recognizes conventional source roots without hiding their evidence path", () => {
    expect(recognizeObservedArea(["src"], 49)).toEqual({
      evidencePath: "src/",
      label: "Source modules",
      summary: "49 observed components share src/.",
    });
  });

  test("keeps already-recognizable observed roles factual", () => {
    expect(recognizeObservedArea(["extensions"], 33).label).toBe("Extensions");
    expect(recognizeObservedArea(["packages"], 2).label).toBe("Packages");
  });

  test("normalizes common acronyms in compound evidence names", () => {
    expect(recognizeObservedArea(["graphql-api"], 7)).toEqual({
      evidencePath: "graphql-api/",
      label: "GraphQL API",
      summary: "7 observed components share graphql-api/.",
    });
    expect(recognizeObservedArea(["ui"], 1)).toEqual({
      evidencePath: "ui/",
      label: "User interface",
      summary: "1 observed component shares ui/.",
    });
  });

  test("fails closed to a humanized area while preserving unknown path evidence", () => {
    expect(recognizeObservedArea(["systems", "x9_adapter"], 3)).toEqual({
      evidencePath: "systems/x9_adapter/",
      label: "X9 adapter area",
      summary: "3 observed components share systems/x9_adapter/.",
    });
  });
});
