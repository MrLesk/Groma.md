import { describe, expect, test } from "bun:test";

import type { ApiComponentPage, ApiComponentView } from "../client/api.ts";
import {
  buildBlueprintFlowGraph,
  LEVEL_COMPONENT_BUDGET,
  LEVEL_RELATIONSHIP_BUDGET,
  nextScaleLabel,
} from "../client/graph.ts";
import { displayText, emptyModel, mergeChildrenPage, mergeRootsPage } from "../client/model.ts";

function view(id: string, extra: Record<string, unknown> = {}): ApiComponentView {
  const {
    cognitiveComplexity,
    evidenceBound = false,
    ...component
  } = extra as Record<string, unknown> & {
    readonly cognitiveComplexity?: ApiComponentView["cognitiveComplexity"];
    readonly evidenceBound?: boolean;
  };
  return {
    ...(cognitiveComplexity === undefined ? {} : { cognitiveComplexity }),
    component: { id, kind: "component", ...component },
    evidenceBound,
    revision: `sha256:${id}`,
  } as ApiComponentView;
}

function page(
  items: readonly ApiComponentView[],
  hasMore = false,
  nextCursor?: string,
): ApiComponentPage {
  return {
    generation: 9,
    hasMore,
    items,
    ...(nextCursor === undefined ? {} : { nextCursor }),
  };
}

describe("interactive map view-model", () => {
  test("display text prefers label, then name, then stable identity", () => {
    expect(displayText({ id: "ent_1", kind: "component" })).toBe("ent_1");
    expect(displayText({ id: "ent_1", kind: "component", name: "Core" })).toBe("Core");
    expect(displayText({ id: "ent_1", kind: "component", label: "The Core" })).toBe("The Core");
  });

  test("merges bounded root and child pages with explicit continuation", () => {
    const first = mergeRootsPage(emptyModel(), page([view("ent_a"), view("ent_b")], true, "c1"));
    expect(first.rootIds).toEqual(["ent_a", "ent_b"]);
    expect(first.rootsCursor).toBe("c1");
    const roots = mergeRootsPage(first, page([view("ent_c")]));
    const children = mergeChildrenPage(
      roots,
      "ent_a",
      page([view("ent_a1"), view("ent_a2")], true, "children-2"),
    );
    expect(children.nodes.get("ent_a")?.childIds).toEqual(["ent_a1", "ent_a2"]);
    expect(children.nodes.get("ent_a")?.hasMoreChildren).toBeTrue();
    expect(children.nodes.get("ent_a")?.childrenCursor).toBe("children-2");
  });

  test("keeps nearby context mounted while focus expands inside a component", () => {
    const roots = mergeRootsPage(
      emptyModel(),
      page([view("ent_system", { name: "Product", scale: "system" })]),
    );
    const domains = mergeChildrenPage(
      roots,
      "ent_system",
      page([view("ent_domain", { name: "Identity", scale: "domain", summary: "Own access." })]),
    );
    const parts = mergeChildrenPage(
      domains,
      "ent_domain",
      page([view("ent_part", { intent: "Keep sessions valid.", name: "Sessions", scale: "part" })]),
    );
    const top = buildBlueprintFlowGraph({ dependencies: [], model: parts });
    expect(top.nodes.map((node) => node.id)).toEqual(["ent_system", "ent_domain"]);
    const focused = buildBlueprintFlowGraph({
      dependencies: [],
      focusPath: ["ent_domain"],
      model: parts,
    });
    expect(focused.nodes.map((node) => node.id)).toEqual(["ent_system", "ent_domain", "ent_part"]);
    expect(focused.nodes.find((node) => node.id === "ent_domain")?.type).toBe("group");
    expect(focused.nodes.find((node) => node.id === "ent_part")?.data.purpose).toBe(
      "Keep sessions valid.",
    );
  });

  test("expands a focused root without discarding its root siblings", () => {
    const roots = mergeRootsPage(
      emptyModel(),
      page([
        view("ent_alpha", { intent: "Own alpha.", name: "Alpha" }),
        view("ent_beta", { intent: "Own beta.", name: "Beta" }),
      ]),
    );
    const model = mergeChildrenPage(
      roots,
      "ent_alpha",
      page([view("ent_alpha_part", { intent: "Do alpha work.", name: "Alpha part" })]),
    );
    const focused = buildBlueprintFlowGraph({
      dependencies: [],
      focusPath: ["ent_alpha"],
      model,
    });
    expect(focused.nodes.map((node) => node.id)).toEqual([
      "ent_alpha",
      "ent_alpha_part",
      "ent_beta",
    ]);
    expect(focused.nodes.find((node) => node.id === "ent_alpha")?.type).toBe("group");
    expect(focused.nodes.find((node) => node.id === "ent_beta")?.type).toBe("component");
    expect(focused.visibleComponents).toBe(1);
    expect(focused.levelComponents).toBe(1);
  });

  test("enforces the visual budget without shrinking or discarding loaded components", () => {
    const roots = mergeRootsPage(emptyModel(), page([view("ent_system", { scale: "system" })]));
    const children = Array.from({ length: LEVEL_COMPONENT_BUDGET + 2 }, (_, index) =>
      view(`ent_domain_${index}`, {
        name: `Domain ${index}`,
        scale: "domain",
        summary: `Responsibility ${index}.`,
      }),
    );
    const model = mergeChildrenPage(roots, "ent_system", page(children, true, "more"));
    const graph = buildBlueprintFlowGraph({
      childCounts: new Map([["ent_system", children.length]]),
      dependencies: [],
      model,
    });
    expect(graph.visibleComponents).toBe(LEVEL_COMPONENT_BUDGET);
    expect(graph.nodes).toHaveLength(LEVEL_COMPONENT_BUDGET + 1);
    expect(graph.omittedComponents).toBe(2);
    expect(model.nodes.has("ent_domain_9")).toBeTrue();
  });

  test("normalizes an OpenClaw-sized observed root to twenty ranked candidates", () => {
    const roots = mergeRootsPage(
      emptyModel(),
      page([view("ent_openclaw", { name: "openclaw", scale: "system" })]),
    );
    const candidates = Array.from({ length: 85 }, (_, index) =>
      view(`ent_candidate_${index.toString().padStart(2, "0")}`, {
        evidenceBound: true,
        name: index < 36 ? `@openclaw/plugin-${index}` : `area-${index}`,
        parent: "ent_openclaw",
        ...(index < 36 ? { summary: `OpenClaw plugin ${index}.`, type: "package" } : {}),
      }),
    );
    const model = mergeChildrenPage(roots, "ent_openclaw", page(candidates));
    const graph = buildBlueprintFlowGraph({
      childCounts: new Map([
        ["ent_openclaw", 85],
        ["ent_candidate_07", 5],
        ["ent_candidate_61", 2],
      ]),
      dependencies: [],
      model,
    });
    const visibleCards = graph.nodes.filter((node) => node.type === "component");
    expect(visibleCards).toHaveLength(20);
    expect(graph.visibleComponents).toBe(20);
    expect(graph.levelComponents).toBe(85);
    expect(graph.omittedComponents).toBe(65);
    expect(visibleCards.map((node) => node.id)).toContain("ent_candidate_61");
    expect(visibleCards.every((node) => node.data.notation === "unscaled")).toBeTrue();
  });

  test("keeps meaning-empty observed candidates visible with automatic notation", () => {
    const roots = mergeRootsPage(emptyModel(), page([view("ent_system", { scale: "system" })]));
    const domains = mergeChildrenPage(
      roots,
      "ent_system",
      page([view("ent_app", { name: "Application", scale: "domain", summary: "Own use cases." })]),
    );
    const evidence = Array.from({ length: 7 }, (_, index) =>
      view(`ent_observed_${index}`, {
        evidenceBound: true,
        name: `observed-${index}`,
        parent: "ent_app",
        summary: "Scanner-reported file candidate.",
        type: "file",
      }),
    );
    const model = mergeChildrenPage(
      domains,
      "ent_app",
      page([
        view("ent_policy", {
          evidenceBound: true,
          intent: "Coordinate policy decisions.",
          name: "Policy",
          parent: "ent_app",
          scale: "part",
        }),
        ...evidence,
      ]),
    );
    const graph = buildBlueprintFlowGraph({
      childCounts: new Map([["ent_app", evidence.length + 1]]),
      dependencies: [],
      focusPath: ["ent_app"],
      model,
    });
    expect(graph.nodes.map((node) => node.id)).toEqual([
      "ent_system",
      "ent_app",
      "ent_policy",
      ...evidence.map((item) => item.component.id),
    ]);
    expect(graph.nodes.find((node) => node.id === "ent_observed_0")?.data.notation).toBe(
      "unscaled",
    );
    expect(graph.omittedComponents).toBe(0);
  });

  test("renders an evidence-supported curated scale as canonical notation", () => {
    const roots = mergeRootsPage(emptyModel(), page([view("ent_system", { scale: "system" })]));
    const model = mergeChildrenPage(
      roots,
      "ent_system",
      page([
        view("ent_curated_scale", {
          evidenceBound: true,
          name: "Curated scale",
          parent: "ent_system",
          scale: "domain",
        }),
      ]),
    );
    const graph = buildBlueprintFlowGraph({ dependencies: [], model });
    expect(graph.nodes.find((node) => node.id === "ent_curated_scale")?.data.notation).toBe(
      "domain",
    );
  });

  test("uses code-unit ordering at the visual cutoff", () => {
    const roots = mergeRootsPage(emptyModel(), page([view("ent_system", { scale: "system" })]));
    const names = ["I", "i", "İ", "ı", ...Array.from({ length: 18 }, (_, index) => `z${index}`)];
    const children = names.map((name, index) =>
      view(`ent_${index.toString().padStart(2, "0")}`, { intent: name, name }),
    );
    const graph = buildBlueprintFlowGraph({
      dependencies: [],
      model: mergeChildrenPage(roots, "ent_system", page(children)),
    });
    expect(
      graph.nodes.filter((node) => node.type === "component").map((node) => node.data.label),
    ).toEqual(names.toSorted().slice(0, 20));
  });

  test("draws a bounded directional relationship set with plain labels", () => {
    const roots = mergeRootsPage(emptyModel(), page([view("ent_system", { scale: "system" })]));
    const children = Array.from({ length: 8 }, (_, index) =>
      view(`ent_${index}`, { name: `Part ${index}`, scale: "domain", summary: `Own ${index}.` }),
    );
    const model = mergeChildrenPage(roots, "ent_system", page(children));
    const dependencies = Array.from({ length: LEVEL_RELATIONSHIP_BUDGET + 3 }, (_, index) => ({
      source: `ent_${index % 8}`,
      target: `ent_${(index * 3 + 1) % 8}`,
      type: "imports",
    }));
    const graph = buildBlueprintFlowGraph({ dependencies, model });
    expect(graph.edges.length).toBeLessThanOrEqual(LEVEL_RELATIONSHIP_BUDGET);
    expect(graph.edges[0]?.label).toBe("needs");
    expect(graph.edges[0]?.markerEnd).toBeDefined();
    expect(graph.omittedRelationships).toBeGreaterThanOrEqual(0);
  });

  test("keeps cognitive complexity as secondary comparable evidence", () => {
    const source = {
      projectId: "prj_local",
      scanner: { id: "typescript-bun", instance: "default", version: "1.0.0" },
    };
    const roots = mergeRootsPage(emptyModel(), page([view("ent_system", { scale: "system" })]));
    const model = mergeChildrenPage(
      roots,
      "ent_system",
      page([
        view("ent_a", {
          cognitiveComplexity: [{ ...source, value: 3 }],
          name: "a",
          scale: "domain",
          summary: "Own a.",
        }),
        view("ent_b", {
          cognitiveComplexity: [{ ...source, value: 18 }],
          name: "b",
          scale: "domain",
          summary: "Own b.",
        }),
      ]),
    );
    const graph = buildBlueprintFlowGraph({ dependencies: [], model });
    expect(graph.nodes.find((node) => node.id === "ent_a")?.data.cognitiveComplexity).toBe(3);
    expect(graph.nodes.find((node) => node.id === "ent_b")?.data.cognitiveComplexity).toBe(18);
  });

  test("names the next semantic disclosure stratum", () => {
    expect(nextScaleLabel("system")).toBe("domains");
    expect(nextScaleLabel("domain")).toBe("parts");
    expect(nextScaleLabel("part")).toBe("elements");
    expect(nextScaleLabel("element")).toBe("nested elements");
    expect(nextScaleLabel(undefined)).toBe("children");
  });
});
