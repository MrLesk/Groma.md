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

  test("nests loaded containment inside container plates instead of a flat grid", () => {
    const roots = mergeRootsPage(
      emptyModel(),
      page([view("ent_system", { name: "Product", scale: "system" })]),
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
    const options = {
      dependencies: [],
      folded: new Set<string>(),
      model: parts,
      visibleScale: undefined,
    };
    const graph = buildBlueprintFlowGraph(options);
    expect(graph).toEqual(buildBlueprintFlowGraph(options));
    // Every container becomes a plate its contents are nested inside.
    expect(graph.nodes.map((node) => node.id)).toEqual([
      "group:ent_system",
      "group:ent_domain",
      "ent_part",
    ]);
    expect(graph.nodes.find((node) => node.id === "group:ent_domain")?.parentId).toBe(
      "group:ent_system",
    );
    expect(graph.nodes.find((node) => node.id === "ent_part")?.parentId).toBe("group:ent_domain");
    // Nesting carries containment, so no containment edges are drawn.
    expect(graph.edges).toHaveLength(0);
    expect(graph.notations).toEqual(["system", "domain", "part"]);
    expect(graph.nodes.every((node) => Number.isInteger(node.position.x))).toBeTrue();
    expect(graph.nodes.every((node) => Number.isInteger(node.position.y))).toBeTrue();
  });

  test("draws observed dependencies and keeps externals in their own band", () => {
    const model = mergeRootsPage(
      emptyModel(),
      page([
        view("ent_owned", { name: "Core", scale: "domain" }),
        view("ent_lib", { name: "yaml", shared: true, type: "external" }),
      ]),
    );
    const graph = buildBlueprintFlowGraph({
      dependencies: [{ source: "ent_owned", target: "ent_lib", type: "imports" }],
      folded: new Set<string>(),
      model,
      visibleScale: undefined,
    });
    const band = graph.nodes.find((node) => node.id === "band:external");
    expect(band?.data.label).toBe("Depends on 1 external");
    expect(graph.nodes.find((node) => node.id === "ent_lib")?.parentId).toBe("band:external");
    expect(graph.nodes.find((node) => node.id === "ent_owned")?.parentId).toBeUndefined();
    const edge = graph.edges[0];
    expect(edge?.id).toBe("depends:ent_owned:ent_lib");
    expect(edge?.className).toContain("groma-edge--external");
    // Direction is kept on both endpoints: the component that reaches out and the
    // one reached for are opposite kinds of thing, and one total would hide that.
    // Borrowed code is counted apart from the system's own parts, so a card's
    // "uses" can always be reconciled against the siblings drawn beside it.
    const owned = graph.nodes.find((node) => node.id === "ent_owned");
    expect(owned?.data).toMatchObject({
      borrows: 1,
      dependents: 0,
      dependsOn: 0,
      external: false,
      shared: false,
    });
    expect(graph.nodes.find((node) => node.id === "ent_lib")?.data).toMatchObject({
      dependents: 1,
      dependsOn: 0,
      external: true,
      shared: true,
    });
  });

  test("the visible scale bounds how deep the sheet draws without unloading the model", () => {
    const roots = mergeRootsPage(emptyModel(), page([view("ent_system", { scale: "system" })]));
    const domains = mergeChildrenPage(
      roots,
      "ent_system",
      page([view("ent_domain", { scale: "domain" })]),
    );
    const model = mergeChildrenPage(
      domains,
      "ent_domain",
      page([view("ent_part", { scale: "part" })]),
    );
    const shallow = buildBlueprintFlowGraph({
      dependencies: [],
      folded: new Set<string>(),
      model,
      visibleScale: "domain",
    });
    expect(shallow.nodes.map((node) => node.id)).toEqual(["group:ent_system", "ent_domain"]);
    expect(shallow.notations).toEqual(["system", "domain"]);
    // The finer rung is only hidden, never discarded.
    expect(model.nodes.has("ent_part")).toBeTrue();
  });

  test("folding removes descendants from layout without discarding loaded model state", () => {
    const roots = mergeRootsPage(emptyModel(), page([view("ent_domain", { scale: "domain" })]));
    const children = mergeChildrenPage(
      roots,
      "ent_domain",
      page([view("ent_part", { scale: "part" })]),
    );
    const graph = buildBlueprintFlowGraph({
      dependencies: [],
      folded: new Set(["ent_domain"]),
      model: children,
      visibleScale: undefined,
    });
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
    const graph = buildBlueprintFlowGraph({
      dependencies: [],
      folded: new Set<string>(),
      model,
      visibleScale: undefined,
    });
    expect(graph.nodes.map((node) => node.data.notation)).toEqual([
      "system",
      "domain",
      "part",
      "element",
      "unscaled",
    ]);
    expect(new Set(graph.nodes.map((node) => node.width)).size).toBe(5);
    // Only a scan-derived scale is provisional; an unscaled component is not.
    expect(graph.nodes.find((node) => node.id === "ent_unscaled")?.data.provisional).toBeTrue();
  });

  test("names the next semantic disclosure stratum", () => {
    expect(nextScaleLabel("system")).toBe("domains");
    expect(nextScaleLabel("domain")).toBe("parts");
    expect(nextScaleLabel("part")).toBe("elements");
    expect(nextScaleLabel("element")).toBe("nested elements");
    expect(nextScaleLabel(undefined)).toBe("children");
  });
});
