import { describe, expect, test } from "bun:test";

import type { ApiComponentPage, ApiComponentView } from "../client/api.ts";
import { buildBlueprintFlowGraph, nextScaleLabel } from "../client/graph.ts";
import { displayText, emptyModel, mergeChildrenPage, mergeRootsPage } from "../client/model.ts";

function view(id: string, extra: Record<string, unknown> = {}): ApiComponentView {
  return {
    component: { id, kind: "component", ...extra },
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
    expect(displayText({ id: "ent_1", kind: "component", label: "The Core", name: "Core" })).toBe(
      "The Core",
    );
  });

  test("merges bounded root pages with explicit continuation", () => {
    const first = mergeRootsPage(emptyModel(), page([view("ent_a"), view("ent_b")], true, "c1"));
    expect(first.generation).toBe(9);
    expect(first.rootIds).toEqual(["ent_a", "ent_b"]);
    expect(first.hasMoreRoots).toBeTrue();
    expect(first.rootsCursor).toBe("c1");
    const second = mergeRootsPage(first, page([view("ent_b"), view("ent_c")]));
    expect(second.rootIds).toEqual(["ent_a", "ent_b", "ent_c"]);
    expect(second.hasMoreRoots).toBeFalse();
    expect(second.rootsCursor).toBeUndefined();
  });

  test("merges bounded children pages under their parent only", () => {
    const roots = mergeRootsPage(emptyModel(), page([view("ent_a")]));
    const withChildren = mergeChildrenPage(
      roots,
      "ent_a",
      page([view("ent_a1"), view("ent_a2")], true, "child-cursor"),
    );
    const parent = withChildren.nodes.get("ent_a");
    expect(parent?.childIds).toEqual(["ent_a1", "ent_a2"]);
    expect(parent?.hasMoreChildren).toBeTrue();
    expect(parent?.childrenCursor).toBe("child-cursor");
    expect(withChildren.nodes.get("ent_a1")?.childIds).toBeUndefined();
    const complete = mergeChildrenPage(withChildren, "ent_a", page([view("ent_a2")]));
    expect(complete.nodes.get("ent_a")?.childIds).toEqual(["ent_a1", "ent_a2"]);
    expect(complete.nodes.get("ent_a")?.hasMoreChildren).toBeFalse();
    expect(complete.nodes.get("ent_a")?.childrenCursor).toBeUndefined();
  });

  test("children pages for unknown parents change no hierarchy", () => {
    const roots = mergeRootsPage(emptyModel(), page([view("ent_a")]));
    const unchanged = mergeChildrenPage(roots, "ent_missing", page([view("ent_x")]));
    expect(unchanged.rootIds).toEqual(["ent_a"]);
    expect(unchanged.nodes.get("ent_x")?.view.component.id).toBe("ent_x");
  });

  test("projects only loaded bounded containment into deterministic dagre positions", () => {
    const roots = mergeRootsPage(
      emptyModel(),
      page([view("ent_system", { name: "Platform", scale: "system" })], true, "roots-2"),
    );
    const domains = mergeChildrenPage(
      roots,
      "ent_system",
      page([view("ent_domain", { name: "Identity", scale: "domain" })], true, "domains-2"),
    );
    const parts = mergeChildrenPage(
      domains,
      "ent_domain",
      page([view("ent_part", { name: "Sessions", scale: "part" })]),
    );
    const graph = buildBlueprintFlowGraph(parts, new Set());
    expect(graph).toEqual(buildBlueprintFlowGraph(parts, new Set()));
    expect(graph.nodes.map((node) => node.id)).toEqual(["ent_system", "ent_domain", "ent_part"]);
    expect(graph.edges.map((edge) => edge.id)).toEqual([
      "contains:ent_system:ent_domain",
      "contains:ent_domain:ent_part",
    ]);
    expect(graph.nodes.map((node) => node.width)).toEqual([340, 300, 260]);
    expect(graph.nodes[0]?.data.hasMoreChildren).toBeTrue();
    expect(graph.nodes.every((node) => Number.isInteger(node.position.x))).toBeTrue();
    expect(graph.nodes.every((node) => Number.isInteger(node.position.y))).toBeTrue();
  });

  test("folding removes descendants from layout without discarding loaded model state", () => {
    const roots = mergeRootsPage(emptyModel(), page([view("ent_domain", { scale: "domain" })]));
    const children = mergeChildrenPage(
      roots,
      "ent_domain",
      page([view("ent_part", { scale: "part" })]),
    );
    const graph = buildBlueprintFlowGraph(children, new Set(["ent_domain"]));
    expect(graph.nodes.map((node) => node.id)).toEqual(["ent_domain"]);
    expect(graph.nodes[0]?.data.childState).toBe("collapsed");
    expect(children.nodes.has("ent_part")).toBeTrue();
  });

  test("gives every canonical scale and the unscaled state distinct notation geometry", () => {
    const model = mergeRootsPage(
      emptyModel(),
      page([
        view("ent_system", { scale: "system" }),
        view("ent_domain", { scale: "domain" }),
        view("ent_part", { scale: "part" }),
        view("ent_element", { scale: "element" }),
        view("ent_unscaled"),
      ]),
    );
    const graph = buildBlueprintFlowGraph(model, new Set());
    expect(graph.nodes.map((node) => node.data.notation)).toEqual([
      "system",
      "domain",
      "part",
      "element",
      "unscaled",
    ]);
    expect(graph.nodes.map((node) => [node.width, node.height])).toEqual([
      [340, 132],
      [300, 112],
      [260, 92],
      [220, 76],
      [244, 88],
    ]);
  });

  test("names the next semantic disclosure stratum", () => {
    expect(nextScaleLabel("system")).toBe("domains");
    expect(nextScaleLabel("domain")).toBe("parts");
    expect(nextScaleLabel("part")).toBe("elements");
    expect(nextScaleLabel("element")).toBe("nested elements");
    expect(nextScaleLabel(undefined)).toBe("children");
  });
});
