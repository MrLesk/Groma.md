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

  test("shows one level inside a frame and drills deeper by focus", () => {
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
    const childCounts = new Map([
      ["ent_system", 1],
      ["ent_domain", 1],
    ]);
    const top = buildBlueprintFlowGraph({
      childCounts,
      dependencies: [],
      model: parts,
    });
    // The single system is the frame; its domain shows as a card inside it, and
    // the domain's own part stays out of view until the domain is entered.
    expect(top.nodes.map((node) => node.id)).toEqual(["group:ent_system", "ent_domain"]);
    expect(top.nodes.find((node) => node.id === "ent_domain")?.parentId).toBe("group:ent_system");
    expect(top.nodes.find((node) => node.id === "ent_domain")?.data.canOpen).toBe(true);

    // Focusing the domain re-roots the sheet onto it: it becomes the frame and
    // its part is now the card in view.
    const drilled = buildBlueprintFlowGraph({
      childCounts,
      dependencies: [],
      focusId: "ent_domain",
      model: parts,
    });
    expect(drilled.nodes.map((node) => node.id)).toEqual(["group:ent_domain", "ent_part"]);
    expect(drilled.nodes.find((node) => node.id === "ent_part")?.parentId).toBe("group:ent_domain");
    expect(drilled.nodes.every((node) => Number.isInteger(node.position.x))).toBeTrue();
  });

  test("draws observed dependencies and wires externals to the parts that use them", () => {
    const model = mergeRootsPage(
      emptyModel(),
      page([
        view("ent_owned", { name: "Core", scale: "domain" }),
        view("ent_lib", { name: "yaml", shared: true, type: "external" }),
      ]),
    );
    const graph = buildBlueprintFlowGraph({
      dependencies: [{ source: "ent_owned", target: "ent_lib", type: "imports" }],
      model,
    });
    // No band: borrowed code is a first-class node wired to its consumer, placed
    // to the right of the parts that use it rather than in a detached tray.
    expect(graph.nodes.some((node) => node.id === "band:external")).toBe(false);
    const external = graph.nodes.find((node) => node.id === "ent_lib");
    const owned = graph.nodes.find((node) => node.id === "ent_owned");
    expect(external?.parentId).toBeUndefined();
    expect(owned?.parentId).toBeUndefined();
    expect(external!.position.x).toBeGreaterThan(owned!.position.x);
    const edge = graph.edges[0];
    expect(edge?.id).toBe("depends:ent_owned:ent_lib");
    expect(edge?.className).toContain("groma-edge--external");
    // Direction is kept on both endpoints: the component that reaches out and the
    // one reached for are opposite kinds of thing, and one total would hide that.
    // Borrowed code is counted apart from the system's own parts, so a card's
    // "uses" can always be reconciled against the siblings drawn beside it.
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

  test("counts only what the sheet actually draws, so every figure can be checked by eye", () => {
    const roots = mergeRootsPage(emptyModel(), page([view("ent_system", { scale: "system" })]));
    const model = mergeChildrenPage(
      roots,
      "ent_system",
      page([
        view("ent_a", { name: "a", scale: "domain" }),
        view("ent_b", { name: "b", scale: "domain" }),
      ]),
    );
    const graph = buildBlueprintFlowGraph({
      dependencies: [
        { source: "ent_a", target: "ent_b", type: "imports" },
        // An endpoint at a finer rung than the reader asked to see, and one that
        // was never loaded at all. Counting either would print a figure with no
        // arrow beside it.
        { source: "ent_a", target: "ent_unloaded_element", type: "imports" },
        { source: "ent_unloaded_element", target: "ent_b", type: "imports" },
        // The container is drawn as a plate, not a card, so it is not an endpoint.
        { source: "ent_a", target: "ent_system", type: "imports" },
        // Repeated observations of one pair are one dependency.
        { source: "ent_a", target: "ent_b", type: "imports" },
      ],
      model,
    });
    expect(graph.edges).toHaveLength(1);
    const a = graph.nodes.find((node) => node.id === "ent_a");
    const b = graph.nodes.find((node) => node.id === "ent_b");
    expect(a?.data).toMatchObject({ borrows: 0, dependents: 0, dependsOn: 1 });
    expect(b?.data).toMatchObject({ borrows: 0, dependents: 1, dependsOn: 0 });
    // The sheet's checkable promise: outgoing counts total exactly the lines drawn.
    const drawnFrom = graph.nodes
      .filter((node) => node.type === "component")
      .reduce((total, node) => total + (node.data as { dependsOn?: number }).dependsOn!, 0);
    expect(drawnFrom).toBe(graph.edges.length);
  });

  test("reports only the vocabulary the sheet actually draws", () => {
    const model = mergeRootsPage(
      emptyModel(),
      page([
        view("ent_owned", { name: "Core", scale: "domain", shared: true }),
        view("ent_plain", { name: "Cli", scale: "domain" }),
        view("ent_lib", { name: "yaml", type: "external" }),
      ]),
    );
    const graph = buildBlueprintFlowGraph({
      dependencies: [{ source: "ent_owned", target: "ent_lib", type: "imports" }],
      model,
    });
    // shared is present, external and borrowed are present; entry and quoted are not,
    // so the key must not offer to define words the reader cannot see.
    expect(graph.terms).toContain("shared");
    expect(graph.terms).toContain("external");
    expect(graph.terms).toContain("borrowed");
    expect(graph.terms).not.toContain("entry");
    expect(graph.terms).not.toContain("quoted");
  });

  test("measures what stands out at a level, as figures a reader can count", () => {
    const roots = mergeRootsPage(emptyModel(), page([view("ent_system", { scale: "system" })]));
    const model = mergeChildrenPage(
      roots,
      "ent_system",
      page([
        view("ent_a", { name: "a", scale: "domain" }),
        view("ent_b", { name: "b", scale: "domain" }),
        view("ent_c", { name: "c", scale: "domain" }),
        view("ent_d", { name: "d", scale: "domain" }),
      ]),
    );
    // a reaches every other; b is reached from every other. Both figures equal the
    // count of the "others here", so each line reconciles against the arrows drawn.
    const graph = buildBlueprintFlowGraph({
      childCounts: new Map([
        ["ent_a", 5],
        ["ent_b", 2],
        ["ent_c", 2],
        ["ent_d", 2],
      ]),
      dependencies: [
        { source: "ent_a", target: "ent_b", type: "imports" },
        { source: "ent_a", target: "ent_c", type: "imports" },
        { source: "ent_a", target: "ent_d", type: "imports" },
        { source: "ent_c", target: "ent_b", type: "imports" },
        { source: "ent_d", target: "ent_b", type: "imports" },
      ],
      model,
    });
    expect(graph.readout).toEqual([
      "Most depended on: b — 3 of the 3 others here import it.",
      "Reaches the most: a — imports 3 of the 3 others.",
      "Largest here: a (5 inside).",
    ]);
  });

  test("states a cycle as a measured relation, never a defect", () => {
    const roots = mergeRootsPage(emptyModel(), page([view("ent_system", { scale: "system" })]));
    const model = mergeChildrenPage(
      roots,
      "ent_system",
      page([
        view("ent_a", { name: "a", scale: "domain" }),
        view("ent_b", { name: "b", scale: "domain" }),
        view("ent_c", { name: "c", scale: "domain" }),
      ]),
    );
    const graph = buildBlueprintFlowGraph({
      dependencies: [
        { source: "ent_a", target: "ent_b", type: "imports" },
        { source: "ent_b", target: "ent_a", type: "imports" },
      ],
      model,
    });
    expect(graph.readout).toContain("a and b import each other.");
  });

  test("stays silent when a level is too small or its frame is still loading", () => {
    const roots = mergeRootsPage(emptyModel(), page([view("ent_system", { scale: "system" })]));
    // Only two siblings loaded, and the frame still has more to page: no honest
    // "of the N others" figure exists yet, so the readout says nothing.
    const partial = mergeChildrenPage(
      roots,
      "ent_system",
      page(
        [view("ent_a", { name: "a", scale: "domain" }), view("ent_b", { name: "b", scale: "domain" })],
        true,
        "more",
      ),
    );
    const graph = buildBlueprintFlowGraph({
      dependencies: [{ source: "ent_a", target: "ent_b", type: "imports" }],
      model: partial,
    });
    expect(graph.readout).toEqual([]);
  });

  test("names the reading order only where the contents form one", () => {
    const roots = mergeRootsPage(emptyModel(), page([view("ent_system", { scale: "system" })]));
    const model = mergeChildrenPage(
      roots,
      "ent_system",
      page([
        view("ent_a", { name: "a", scale: "domain" }),
        view("ent_b", { name: "b", scale: "domain" }),
      ]),
    );
    const plate = (dependencies: readonly { source: string; target: string; type: string }[]) =>
      buildBlueprintFlowGraph({
        dependencies,
        model,
      }).nodes.find((node) => node.id === "group:ent_system");

    // A dependency order exists, so the sheet may name the direction it drew.
    expect(plate([{ source: "ent_a", target: "ent_b", type: "imports" }])?.data.axis).toBe(
      "uses →",
    );
    // A cycle has no first member. The layout must still place the cards, but
    // the caption would assert an order that only exists because a line was cut.
    expect(
      plate([
        { source: "ent_a", target: "ent_b", type: "imports" },
        { source: "ent_b", target: "ent_a", type: "imports" },
      ])?.data.axis,
    ).toBeUndefined();
    // Nothing depends on anything: there is no order to describe.
    expect(plate([])?.data.axis).toBeUndefined();
  });

  test("the frame draws one level and keeps deeper loaded nodes out of view, not discarded", () => {
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
      model,
    });
    expect(shallow.nodes.map((node) => node.id)).toEqual(["group:ent_system", "ent_domain"]);
    expect(shallow.notations).toEqual(["system", "domain"]);
    // The deeper part is only out of view, never discarded from the model.
    expect(model.nodes.has("ent_part")).toBeTrue();
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
      model,
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
