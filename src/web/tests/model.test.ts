import { describe, expect, test } from "bun:test";

import { shouldContinueOwnedRootDiscovery } from "../client/root-discovery.ts";
import type { ApiComponentPage, ApiComponentView } from "../client/api.ts";
import {
  buildBlueprintFlowGraph,
  LEVEL_COMPONENT_BUDGET,
  LEVEL_EVIDENCE_BUDGET,
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

  test("continues only a small root budget until it reaches owned code", () => {
    const borrowed = mergeRootsPage(
      emptyModel(),
      page([view("ext_a", { type: "external" })], true, "after-borrowed"),
    );
    expect(shouldContinueOwnedRootDiscovery(borrowed, 1)).toBeTrue();
    expect(shouldContinueOwnedRootDiscovery(borrowed, 5)).toBeFalse();
    const owned = mergeRootsPage(
      borrowed,
      page([view("ent_system", { scale: "system" })], true, "after-system"),
    );
    expect(shouldContinueOwnedRootDiscovery(owned, 2)).toBeFalse();
  });

  test("shows one bounded level and drills deeper only through focus", () => {
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
    expect(top.nodes.map((node) => node.id)).toEqual(["group:ent_system", "ent_domain"]);
    const focused = buildBlueprintFlowGraph({
      dependencies: [],
      focusId: "ent_domain",
      model: parts,
    });
    expect(focused.nodes.map((node) => node.id)).toEqual(["group:ent_domain", "ent_part"]);
    expect(focused.nodes.find((node) => node.id === "ent_part")?.data.purpose).toBe(
      "Keep sessions valid.",
    );
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

  test("keeps meaning-empty observed candidates in a bounded evidence register", () => {
    const roots = mergeRootsPage(emptyModel(), page([view("ent_system", { scale: "system" })]));
    const domains = mergeChildrenPage(
      roots,
      "ent_system",
      page([view("ent_app", { name: "Application", scale: "domain", summary: "Own use cases." })]),
    );
    const evidence = Array.from({ length: LEVEL_EVIDENCE_BUDGET + 2 }, (_, index) =>
      view(`ent_observed_${index}`, {
        evidenceBound: true,
        name: `observed-${index}`,
        parent: "ent_app",
        scale: "part",
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
      focusId: "ent_app",
      model,
    });
    expect(graph.nodes.map((node) => node.id)).toEqual(["group:ent_app", "ent_policy"]);
    expect(graph.evidence).toHaveLength(LEVEL_EVIDENCE_BUDGET);
    expect(graph.evidence[0]?.label).toBe("observed-0");
    expect(graph.omittedComponents).toBe(2);
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
