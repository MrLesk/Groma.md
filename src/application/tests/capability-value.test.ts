import { expect, test } from "bun:test";

import { containCapabilityValue } from "../capability-value.ts";

test("capability value containment bounds malformed array extra-value inspection", () => {
  const value: unknown[] = [];
  for (let index = 0; index < 100; index += 1) {
    Object.defineProperty(value, `extra-${index}`, {
      enumerable: true,
      value: Object.freeze({ index }),
    });
  }

  let inspectedObjects = 0;
  const result = containCapabilityValue(value, {
    isProxy(candidate) {
      if (typeof candidate === "object" && candidate !== null) inspectedObjects += 1;
      return false;
    },
    maximumContainerEntries: 1,
    maximumDepth: 4,
    maximumValues: 1_000,
  });

  expect(result).toEqual({ ok: false });
  expect(inspectedObjects).toBe(2);
});
