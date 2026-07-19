import { describe, expect, test } from "bun:test";

import type { ApiComponentPage, ApiComponentView } from "../client/api.ts";
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
});
