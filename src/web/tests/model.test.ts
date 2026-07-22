import { describe, expect, test } from "bun:test";

import type { ApiComponentPage, ApiComponentView } from "../client/api.ts";
import {
  buildBlueprintFlowGraph,
  LEVEL_COMPONENT_BUDGET,
  LEVEL_RELATIONSHIP_BUDGET,
  nextScaleLabel,
  projectionBranchIds,
} from "../client/graph.ts";
import { displayText, emptyModel, mergeChildrenPage, mergeRootsPage } from "../client/model.ts";

function view(id: string, extra: Record<string, unknown> = {}): ApiComponentView {
  const {
    cognitiveComplexity,
    evidenceBound = false,
    observedPaths,
    sourceLines,
    ...component
  } = extra as Record<string, unknown> & {
    readonly cognitiveComplexity?: ApiComponentView["cognitiveComplexity"];
    readonly evidenceBound?: boolean;
    readonly observedPaths?: ApiComponentView["observedPaths"];
    readonly sourceLines?: ApiComponentView["sourceLines"];
  };
  return {
    ...(cognitiveComplexity === undefined ? {} : { cognitiveComplexity }),
    component: { id, kind: "component", ...component },
    evidenceBound,
    ...(observedPaths === undefined ? {} : { observedPaths }),
    ...(sourceLines === undefined ? {} : { sourceLines }),
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
      expandedIds: ["ent_domain"],
      model: parts,
    });
    expect(focused.nodes.map((node) => node.id)).toEqual(["ent_system", "ent_domain", "ent_part"]);
    expect(focused.nodes.find((node) => node.id === "ent_domain")?.type).toBe("group");
    expect(focused.nodes.find((node) => node.id === "ent_part")?.data.purpose).toBe(
      "Keep sessions valid.",
    );
  });

  test("sizes expanded plates to their bounded child content", () => {
    const graphWithChildren = (count: number) => {
      const roots = mergeRootsPage(emptyModel(), page([view("ent_system")]));
      const children = Array.from({ length: count }, (_, index) =>
        view(`ent_child_${index}`, { name: `Child ${index}` }),
      );
      return buildBlueprintFlowGraph({
        dependencies: [],
        model: mergeChildrenPage(roots, "ent_system", page(children)),
      });
    };
    const widthOf = (graph: ReturnType<typeof graphWithChildren>, id: string) =>
      graph.nodes.find((node) => node.id === id)?.width;

    expect(widthOf(graphWithChildren(1), "ent_system")).toBe(296);
    expect(widthOf(graphWithChildren(2), "ent_system")).toBe(568);
    expect(widthOf(graphWithChildren(5), "ent_system")).toBe(1_384);

    const roots = mergeRootsPage(emptyModel(), page([view("ent_system")]));
    const domains = mergeChildrenPage(
      roots,
      "ent_system",
      page([view("ent_domain"), view("ent_sibling")]),
    );
    const nestedModel = mergeChildrenPage(
      domains,
      "ent_domain",
      page([view("ent_part_a"), view("ent_part_b")]),
    );
    const nested = buildBlueprintFlowGraph({
      dependencies: [],
      expandedIds: ["ent_domain"],
      model: nestedModel,
    });
    const nestedPlate = nested.nodes.find((node) => node.id === "ent_domain")!;
    expect(nestedPlate.width).toBe(568);
    expect(nestedPlate.position.x + Number(nestedPlate.width) + 28).toBe(
      Number(widthOf(nested, "ent_system")),
    );
  });

  test("offers focus from a known child count before children are loaded", () => {
    const roots = mergeRootsPage(
      emptyModel(),
      page([view("ent_system", { name: "Product", scale: "system" })]),
    );
    const model = mergeChildrenPage(
      roots,
      "ent_system",
      page([view("ent_domain", { name: "Application", scale: "domain" })]),
    );
    const graph = buildBlueprintFlowGraph({
      childCounts: new Map([["ent_domain", 7]]),
      dependencies: [],
      model,
    });
    expect(graph.nodes.find((node) => node.id === "ent_domain")?.data).toMatchObject({
      canOpen: true,
      childCount: 7,
    });
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
      expandedIds: ["ent_alpha"],
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

  test("expands multiple sibling components independently", () => {
    const roots = mergeRootsPage(
      emptyModel(),
      page([view("ent_system", { name: "Product", scale: "system" })]),
    );
    const domains = mergeChildrenPage(
      roots,
      "ent_system",
      page([
        view("ent_alpha", { name: "Alpha", scale: "domain" }),
        view("ent_beta", { name: "Beta", scale: "domain" }),
      ]),
    );
    const alpha = mergeChildrenPage(
      domains,
      "ent_alpha",
      page([view("ent_alpha_part", { name: "Alpha part", scale: "part" })]),
    );
    const model = mergeChildrenPage(
      alpha,
      "ent_beta",
      page([view("ent_beta_part", { name: "Beta part", scale: "part" })]),
    );
    const graph = buildBlueprintFlowGraph({
      dependencies: [],
      expandedIds: ["ent_alpha", "ent_beta"],
      model,
    });
    expect(graph.nodes.find((node) => node.id === "ent_alpha")?.type).toBe("group");
    expect(graph.nodes.find((node) => node.id === "ent_beta")?.type).toBe("group");
    expect(graph.nodes.some((node) => node.id === "ent_alpha_part")).toBeTrue();
    expect(graph.nodes.some((node) => node.id === "ent_beta_part")).toBeTrue();
    expect(graph.focusTargetId).toBe("ent_beta");
    expect(projectionBranchIds(graph.nodes, "ent_alpha")).toEqual(
      new Set(["ent_alpha", "ent_alpha_part"]),
    );
  });

  test("indexes an ungroupable over-budget level without omitting components", () => {
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
    expect(graph.visibleComponents).toBe(2);
    expect(graph.levelComponents).toBe(children.length);
    expect(graph.nodes).toHaveLength(3);
    expect(graph.omittedComponents).toBe(0);
    const indexes = graph.nodes.filter(
      (node) => node.type === "component" && node.data.projection === "observed-index",
    );
    expect(indexes.map((node) => node.data.childCount)).toEqual([20, 2]);
    expect(indexes.every((node) => node.data.canOpen)).toBeTrue();

    const expanded = buildBlueprintFlowGraph({
      dependencies: [],
      expandedIds: [indexes[0]!.id],
      model,
    });
    expect(expanded.nodes.find((node) => node.id === indexes[0]!.id)?.type).toBe("group");
    expect(
      expanded.nodes.filter(
        (node) => node.type === "component" && node.data.projection === undefined,
      ),
    ).toHaveLength(20);
    expect(model.nodes.has("ent_domain_9")).toBeTrue();
  });

  test("builds deterministic indexes regardless of canonical input order", () => {
    const children = Array.from({ length: 49 }, (_, index) =>
      view(`ent_item_${index.toString().padStart(2, "0")}`, {
        name: `Item ${index.toString().padStart(2, "0")}`,
      }),
    );
    const graphFor = (items: readonly ApiComponentView[]) => {
      const roots = mergeRootsPage(emptyModel(), page([view("ent_system")]));
      return buildBlueprintFlowGraph({
        dependencies: [],
        model: mergeChildrenPage(roots, "ent_system", page(items)),
      });
    };
    const projected = (items: readonly ApiComponentView[]) =>
      graphFor(items)
        .nodes.filter((node) => node.type === "component")
        .map((node) => ({
          childCount: node.data.childCount,
          id: node.id,
          label: node.data.label,
          projection: node.data.projection,
        }));

    expect(projected(children)).toEqual(projected(children.toReversed()));
  });

  test("recursively bounds very large presentation indexes", () => {
    const roots = mergeRootsPage(emptyModel(), page([view("ent_system")]));
    const children = Array.from({ length: 401 }, (_, index) =>
      view(`ent_item_${index.toString().padStart(3, "0")}`, {
        name: `Item ${index.toString().padStart(3, "0")}`,
      }),
    );
    const model = mergeChildrenPage(roots, "ent_system", page(children));
    const overview = buildBlueprintFlowGraph({ dependencies: [], model });
    const topIndexes = overview.nodes.filter(
      (node) => node.type === "component" && node.data.projection === "observed-index",
    );
    expect(topIndexes).toHaveLength(20);
    expect(topIndexes.every((node) => Number(node.data.childCount) <= 21)).toBeTrue();

    const top = topIndexes[0]!;
    const nested = buildBlueprintFlowGraph({
      dependencies: [],
      expandedIds: [top.id],
      model,
    });
    const nestedIndexes = nested.nodes.filter(
      (node) =>
        node.type === "component" &&
        node.parentId === top.id &&
        node.data.projection === "observed-index",
    );
    expect(nestedIndexes.map((node) => node.data.childCount)).toEqual([20, 1]);

    const leaf = nestedIndexes[0]!;
    const expanded = buildBlueprintFlowGraph({
      dependencies: [],
      expandedIds: [top.id, leaf.id],
      model,
    });
    expect(
      expanded.nodes.filter(
        (node) =>
          node.type === "component" &&
          node.parentId === leaf.id &&
          node.data.projection === undefined,
      ),
    ).toHaveLength(20);
  });

  test("indexes large levels without deriving visual groups from evidence paths", () => {
    const roots = mergeRootsPage(
      emptyModel(),
      page([view("ent_openclaw", { name: "openclaw", scale: "system" })]),
    );
    const areas = [
      { count: 49, name: "src" },
      { count: 33, name: "extensions" },
      { count: 2, name: "packages" },
      { count: 1, name: "ui" },
    ] as const;
    const candidates = areas.flatMap((area) =>
      Array.from({ length: area.count }, (_, index) =>
        view(`ent_${area.name}_${index.toString().padStart(2, "0")}`, {
          evidenceBound: true,
          name: `${area.name}-${index}`,
          observedPaths: [
            {
              projectId: "project.openclaw",
              resource: `${area.name}/member-${index}/package.json`,
              scanner: { id: "typescript-bun", instance: "default", version: "1.0.0" },
            },
          ],
          parent: "ent_openclaw",
          type: "package",
        }),
      ),
    );
    const model = mergeChildrenPage(roots, "ent_openclaw", page(candidates));
    const graph = buildBlueprintFlowGraph({
      childCounts: new Map([["ent_openclaw", 85]]),
      dependencies: [],
      model,
    });
    const visibleCards = graph.nodes.filter((node) => node.type === "component");
    expect(visibleCards).toHaveLength(5);
    expect(visibleCards.map((node) => node.data.childCount)).toEqual([20, 20, 20, 20, 5]);
    expect(visibleCards.every((node) => node.data.projection === "observed-index")).toBeTrue();
    expect(visibleCards.every((node) => node.data.type === "component index")).toBeTrue();
    expect(visibleCards.map((node) => node.data.label).join(" ")).not.toMatch(
      /Extensions|Packages|Source modules|User interface/,
    );
    expect(graph.visibleComponents).toBe(5);
    expect(graph.levelComponents).toBe(85);
    expect(graph.omittedComponents).toBe(0);

    const source = visibleCards[0]!;
    const focused = buildBlueprintFlowGraph({
      childCounts: new Map([["ent_openclaw", 85]]),
      dependencies: [],
      expandedIds: [source.id],
      model,
    });
    expect(focused.nodes.find((node) => node.id === source.id)?.type).toBe("group");
    const indexes = focused.nodes.filter(
      (node) => node.type === "component" && node.data.projection === "observed-index",
    );
    expect(indexes).toHaveLength(4);
    expect(focused.nodes.some((node) => node.data.label === "Structure not mapped")).toBeFalse();
    expect(
      focused.nodes.filter(
        (node) => node.type === "component" && node.data.projection === undefined,
      ),
    ).toHaveLength(20);
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
      expandedIds: ["ent_app"],
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

  test("orders disposable indexes deterministically without reading paths", () => {
    const roots = mergeRootsPage(emptyModel(), page([view("ent_system", { scale: "system" })]));
    const children = Array.from({ length: 24 }, (_, index) =>
      view(`ent_${index.toString().padStart(2, "0")}`, {
        name: `Part ${index}`,
        observedPaths: [
          {
            projectId: "project.local",
            resource: `areas/area-${index % 12}/part-${index}.ts`,
            scanner: { id: "typescript-bun", instance: "default", version: "1.0.0" },
          },
        ],
      }),
    );
    const graph = buildBlueprintFlowGraph({
      dependencies: [],
      model: mergeChildrenPage(roots, "ent_system", page(children)),
    });
    expect(
      graph.nodes.filter((node) => node.type === "component").map((node) => node.data.label),
    ).toEqual(["Part 0 – Part 5", "Part 6 – Part 9"]);
    expect(graph.visibleComponents).toBe(2);
    expect(graph.levelComponents).toBe(24);
    expect(graph.omittedComponents).toBe(0);
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
    expect(graph.edges[0]?.label).toBeUndefined();
    expect(graph.edges[0]?.markerEnd).toBeDefined();
    expect(graph.edges[0]?.sourceHandle).toBe("source-right");
    expect(graph.edges[0]?.targetHandle).toBe("target-left");
    expect(graph.omittedRelationships).toBeGreaterThanOrEqual(0);
  });

  test("does not restate containment as relationship lines", () => {
    const roots = mergeRootsPage(
      emptyModel(),
      page([view("ent_system", { name: "System", scale: "system" })]),
    );
    const model = mergeChildrenPage(
      roots,
      "ent_system",
      page([view("ent_domain", { name: "Domain", scale: "domain" })]),
    );
    const graph = buildBlueprintFlowGraph({
      dependencies: [{ source: "ent_system", target: "ent_domain", type: "source-boundary" }],
      model,
    });
    expect(graph.edges).toEqual([]);
  });

  test("routes relationships between card rows through the vertical gutter", () => {
    const roots = mergeRootsPage(emptyModel(), page([view("ent_system", { scale: "system" })]));
    const children = Array.from({ length: 8 }, (_, index) =>
      view(`ent_${index}`, { name: `Part ${index}`, scale: "domain", summary: `Own ${index}.` }),
    );
    const graph = buildBlueprintFlowGraph({
      dependencies: [{ source: "ent_4", target: "ent_0", type: "imports" }],
      model: mergeChildrenPage(roots, "ent_system", page(children)),
    });
    const top = graph.nodes.find((node) => node.id === "ent_0")!;
    const bottom = graph.nodes.find((node) => node.id === "ent_4")!;
    expect(bottom.position.y).toBeGreaterThan(top.position.y);
    expect(graph.edges[0]?.sourceHandle).toBe("source-top");
    expect(graph.edges[0]?.targetHandle).toBe("target-bottom");
  });

  test("leaves long relationships in detail instead of crossing another card", () => {
    const roots = mergeRootsPage(emptyModel(), page([view("ent_system", { scale: "system" })]));
    const model = mergeChildrenPage(
      roots,
      "ent_system",
      page([
        view("ent_a", { name: "A", scale: "domain" }),
        view("ent_b", { name: "B", scale: "domain" }),
        view("ent_c", { name: "C", scale: "domain" }),
      ]),
    );
    const graph = buildBlueprintFlowGraph({
      dependencies: [{ source: "ent_a", target: "ent_c", type: "imports" }],
      model,
    });
    expect(graph.edges).toEqual([]);
    expect(graph.omittedRelationships).toBe(1);
  });

  test("keeps per-function measurements as secondary comparable evidence", () => {
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
          sourceLines: [{ ...source, value: 7 }],
          name: "a",
          scale: "domain",
          summary: "Own a.",
        }),
        view("ent_b", {
          cognitiveComplexity: [{ ...source, value: 18 }],
          sourceLines: [{ ...source, value: 31 }],
          name: "b",
          scale: "domain",
          summary: "Own b.",
        }),
      ]),
    );
    const graph = buildBlueprintFlowGraph({ dependencies: [], model });
    expect(graph.nodes.find((node) => node.id === "ent_a")?.data.cognitiveComplexity).toBe(3);
    expect(graph.nodes.find((node) => node.id === "ent_b")?.data.cognitiveComplexity).toBe(18);
    expect(graph.nodes.find((node) => node.id === "ent_a")?.data.sourceLines).toBe(7);
    expect(graph.nodes.find((node) => node.id === "ent_b")?.data.sourceLines).toBe(31);
  });

  test("names the next semantic disclosure stratum", () => {
    expect(nextScaleLabel("system")).toBe("domains");
    expect(nextScaleLabel("domain")).toBe("parts");
    expect(nextScaleLabel("part")).toBe("elements");
    expect(nextScaleLabel("element")).toBe("nested elements");
    expect(nextScaleLabel(undefined)).toBe("children");
  });
});
