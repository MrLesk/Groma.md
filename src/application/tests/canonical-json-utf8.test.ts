import { describe, expect, test } from "bun:test";

import { measureCanonicalJsonUtf8Bytes } from "../canonical-json-utf8.ts";

const utf8 = new TextEncoder();
const noProxy = (_value: unknown) => false;
const intrinsicDefineProperty = Object.defineProperty;
const intrinsicGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const intrinsicDeleteProperty = Reflect.deleteProperty;

function renderedBytes(value: unknown): number {
  return utf8.encode(JSON.stringify(value)).byteLength;
}

function measured(value: unknown, maximumBytes = Number.MAX_SAFE_INTEGER, maximumDepth = 30) {
  return measureCanonicalJsonUtf8Bytes(value, {
    isProxy: noProxy,
    maximumBytes,
    maximumDepth,
  });
}

describe("Application canonical JSON UTF-8 measurement", () => {
  test.each([
    null,
    true,
    false,
    0,
    -0,
    1.25,
    1e21,
    "plain",
    'quote"slash\\',
    "\b\t\n\f\r\u0000\u001f",
    "é漢\u2028",
    "😀",
    "\ud800",
    "\udc00",
    [null, "repeat", "repeat", { z: true, a: 1 }],
    { skipped: undefined, nested: ["same", "same"], empty: {} },
    Object.assign(Object.create(null), { b: "two", a: "one" }),
  ])("matches canonical JSON UTF-8 bytes for %#", (value) => {
    expect(measured(value)).toEqual({ bytes: renderedBytes(value), status: "accepted" });
  });

  test("accepts the exact boundary and stops at the first byte beyond it", () => {
    const value = { text: 'é"\u0000😀' };
    const exact = renderedBytes(value);
    expect(measured(value, exact)).toEqual({ bytes: exact, status: "accepted" });
    expect(measured(value, exact - 1)).toEqual({ status: "bound-exceeded" });
    expect(measured(value, 0)).toEqual({ status: "bound-exceeded" });
  });

  test("accepts the exact depth boundary and distinguishes proven depth exhaustion", () => {
    const value = { x: { x: { x: "leaf" } } };
    const exactBytes = renderedBytes(value);
    expect(measured(value, exactBytes, 3)).toEqual({
      bytes: exactBytes,
      status: "accepted",
    });
    expect(measured(value, exactBytes, 2)).toEqual({ status: "depth-exceeded" });
  });

  test("counts repeated aliases at every occurrence and rejects cycles", () => {
    const shared = Object.freeze({ text: "shared" });
    const repeated = Object.freeze({ first: shared, second: shared });
    expect(measured(repeated)).toEqual({
      bytes: renderedBytes(repeated),
      status: "accepted",
    });
    const cycle: { self?: unknown } = {};
    cycle.self = cycle;
    expect(measured(cycle)).toEqual({ status: "invalid" });
  });

  test("rejects getters and toJSON values without invoking them", () => {
    let calls = 0;
    const getter = {};
    Object.defineProperty(getter, "value", {
      enumerable: true,
      get: () => {
        calls += 1;
        return "private";
      },
    });
    const toJson = {
      toJSON: () => {
        calls += 1;
        return "private";
      },
    };
    expect(measured(getter)).toEqual({ status: "invalid" });
    expect(measured(toJson)).toEqual({ status: "invalid" });
    expect(calls).toBe(0);
  });

  test("rejects custom prototypes without consulting inherited behavior", () => {
    let calls = 0;
    const prototype = {};
    Object.defineProperty(prototype, "toJSON", {
      get: () => {
        calls += 1;
        return () => "private";
      },
    });
    const value = Object.create(prototype) as Record<string, unknown>;
    value.visible = true;
    expect(measured(value)).toEqual({ status: "invalid" });
    expect(calls).toBe(0);
  });

  test("rejects recognized proxies before reflection", () => {
    let traps = 0;
    const proxies = new Set<unknown>();
    const proxy = new Proxy(
      { value: "private" },
      {
        getPrototypeOf: () => {
          traps += 1;
          throw new Error("private proxy trap");
        },
        ownKeys: () => {
          traps += 1;
          throw new Error("private proxy trap");
        },
      },
    );
    proxies.add(proxy);
    expect(
      measureCanonicalJsonUtf8Bytes(proxy, {
        isProxy: (value) => proxies.has(value),
        maximumBytes: 100,
        maximumDepth: 30,
      }),
    ).toEqual({ status: "invalid" });
    expect(traps).toBe(0);
  });

  test("keeps exact bounds, valid aliases, and cycle rejection under poisoned globals", () => {
    interface RestoreEntry {
      readonly descriptor: PropertyDescriptor | undefined;
      readonly key: PropertyKey;
      readonly target: object;
    }

    const restores: RestoreEntry[] = [];
    let restoreCount = 0;
    const replace = (target: object, key: PropertyKey, value: unknown): void => {
      const descriptor = intrinsicGetOwnPropertyDescriptor(target, key);
      if (descriptor === undefined || !("value" in descriptor)) {
        throw new Error("expected a replaceable data property");
      }
      restores[restoreCount] = { descriptor, key, target };
      restoreCount += 1;
      intrinsicDefineProperty(target, key, {
        configurable: descriptor.configurable === true,
        enumerable: descriptor.enumerable === true,
        value,
        writable: descriptor.writable === true,
      });
    };
    const install = (target: object, key: PropertyKey, descriptor: PropertyDescriptor): void => {
      restores[restoreCount] = {
        descriptor: intrinsicGetOwnPropertyDescriptor(target, key),
        key,
        target,
      };
      restoreCount += 1;
      intrinsicDefineProperty(target, key, descriptor);
    };
    const poisoned = (): never => {
      throw new Error("poisoned intrinsic invoked");
    };
    const long = { long: "x".repeat(1_000) };
    const longArray = ["x".repeat(1_000)];
    const shared = { text: "é😀" };
    const valid = { again: shared, nested: ["ok", shared] };
    const validBytes = renderedBytes(valid);
    const cycle: { self?: unknown } = {};
    cycle.self = cycle;
    let oversized: ReturnType<typeof measureCanonicalJsonUtf8Bytes> | undefined;
    let oversizedArray: ReturnType<typeof measureCanonicalJsonUtf8Bytes> | undefined;
    let accepted: ReturnType<typeof measureCanonicalJsonUtf8Bytes> | undefined;
    let cyclic: ReturnType<typeof measureCanonicalJsonUtf8Bytes> | undefined;

    try {
      install(Array.prototype, "0", {
        configurable: true,
        enumerable: false,
        get: () => ({ key: "", value: null }),
        set: () => {},
      });
      replace(Array.prototype, Symbol.iterator, function* () {
        return;
      });
      replace(Array.prototype, "push", poisoned);
      replace(Array, "isArray", poisoned);
      replace(String.prototype, "charCodeAt", poisoned);
      replace(Number, "isFinite", poisoned);
      replace(Number, "isSafeInteger", poisoned);
      replace(Object, "freeze", (value: unknown) => value);
      replace(Object, "getOwnPropertyDescriptor", poisoned);
      replace(Object, "getPrototypeOf", poisoned);
      replace(Reflect, "apply", poisoned);
      replace(Reflect, "ownKeys", poisoned);
      replace(Math, "max", () => 0);
      replace(WeakSet.prototype, "add", poisoned);
      replace(WeakSet.prototype, "delete", poisoned);
      replace(WeakSet.prototype, "has", poisoned);
      replace(globalThis, "Array", poisoned);
      replace(globalThis, "String", poisoned);
      replace(globalThis, "WeakSet", poisoned);

      oversized = measured(long, 10);
      oversizedArray = measured(longArray, 10);
      accepted = measured(valid, validBytes);
      cyclic = measured(cycle, 100);
    } finally {
      for (let index = restoreCount - 1; index >= 0; index -= 1) {
        const entry = restores[index]!;
        if (entry.descriptor === undefined) {
          intrinsicDeleteProperty(entry.target, entry.key);
        } else {
          intrinsicDefineProperty(entry.target, entry.key, entry.descriptor);
        }
      }
    }

    expect(oversized).toEqual({ status: "bound-exceeded" });
    expect(oversizedArray).toEqual({ status: "bound-exceeded" });
    expect(accepted).toEqual({ bytes: validBytes, status: "accepted" });
    expect(cyclic).toEqual({ status: "invalid" });
    expect(Object.isFrozen(oversized)).toBeTrue();
    expect(Object.isFrozen(accepted)).toBeTrue();
    expect(Object.isFrozen(cyclic)).toBeTrue();
  });

  test("rejects sparse, accessor-backed, exotic, deep, and non-finite values", () => {
    const sparse = new Array(1);
    const accessorArray = ["value"];
    Object.defineProperty(accessorArray, "0", { enumerable: true, get: () => "private" });
    expect(measured(sparse)).toEqual({ status: "invalid" });
    expect(measured(accessorArray)).toEqual({ status: "invalid" });
    expect(measured(new Date())).toEqual({ status: "invalid" });
    expect(measured(Number.NaN)).toEqual({ status: "invalid" });
    expect(measured(Number.POSITIVE_INFINITY)).toEqual({ status: "invalid" });
    expect(
      measureCanonicalJsonUtf8Bytes(
        { nested: {} },
        {
          isProxy: noProxy,
          maximumBytes: 100,
          maximumDepth: 0,
        },
      ),
    ).toEqual({ status: "depth-exceeded" });
  });
});
