import { describe, expect, test } from "bun:test";

import { createOpaqueIdSource, parseEntityId, parseRelationId } from "../identity.ts";

describe("opaque graph identity", () => {
  test("formats exactly 128 supplied entropy bits without names or paths", () => {
    const source = createOpaqueIdSource(() => Uint8Array.from({ length: 16 }, (_, index) => index));

    expect(source.nextEntityId()).toBe("ent_000102030405060708090a0b0c0d0e0f");
    expect(source.nextRelationId()).toBe("rel_000102030405060708090a0b0c0d0e0f");
  });

  test("rejects malformed, name-derived, and path-derived identities", () => {
    for (const value of ["Ordering", "packages/ordering", "ent_ordering", "cmp_example"]) {
      expect(parseEntityId(value).ok).toBeFalse();
    }
    expect(parseRelationId("rel_example").ok).toBeFalse();
  });

  test("rejects entropy sources that do not provide exactly 16 bytes", () => {
    const source = createOpaqueIdSource(() => new Uint8Array(15));
    expect(() => source.nextEntityId()).toThrow("16 bytes");
  });
});
