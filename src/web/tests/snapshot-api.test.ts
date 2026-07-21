import { afterEach, describe, expect, test } from "bun:test";

import {
  fetchChildren,
  fetchComponent,
  fetchConnections,
  fetchRoots,
  fetchSearch,
  isStaticBlueprintSnapshot,
} from "../client/api.ts";

afterEach(() => {
  globalThis.__GROMA_BLUEPRINT_SNAPSHOT__ = undefined;
});

describe("static snapshot data source", () => {
  test("serves navigation, search, connections, and detail without HTTP", async () => {
    globalThis.__GROMA_BLUEPRINT_SNAPSHOT__ = {
      format: "groma-read-only-blueprint-v1",
      generation: 9,
      items: [
        {
          component: { id: "ent_root", kind: "component", name: "Commerce", scale: "system" },
          relationships: [
            { id: "rel_1", source: "ent_root", target: "ent_child", type: "contains-purpose" },
          ],
        },
        {
          component: {
            id: "ent_child",
            kind: "component",
            name: "Orders",
            parent: "ent_root",
            summary: "Coordinates purchases",
          },
          relationships: [],
        },
      ],
    };

    expect(isStaticBlueprintSnapshot()).toBeTrue();
    expect(await fetchRoots(20)).toMatchObject({
      ok: true,
      value: { generation: 9, items: [{ component: { id: "ent_root" } }] },
    });
    expect(await fetchChildren("ent_root", 10)).toMatchObject({
      ok: true,
      value: { items: [{ component: { id: "ent_child" } }] },
    });
    expect(await fetchConnections(100)).toMatchObject({
      ok: true,
      value: { items: [{ component: { id: "ent_root" } }, { component: { id: "ent_child" } }] },
    });
    expect(await fetchSearch("purchases", 20)).toMatchObject({
      ok: true,
      value: { items: [{ id: "ent_child" }] },
    });
    expect(await fetchComponent("ent_child", 20)).toMatchObject({
      ok: true,
      value: {
        evidence: [],
        item: { component: { id: "ent_child" } },
        relationships: { items: [{ relationship: { id: "rel_1" } }] },
      },
    });
  });
});
