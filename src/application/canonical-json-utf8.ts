export interface CanonicalJsonUtf8SizeOptions {
  readonly isProxy: (value: unknown) => boolean;
  readonly maximumBytes: number;
  readonly maximumDepth: number;
}

export type CanonicalJsonUtf8Size =
  | { readonly bytes: number; readonly status: "accepted" }
  | { readonly status: "bound-exceeded" }
  | { readonly status: "depth-exceeded" }
  | { readonly status: "invalid" };

const intrinsicArrayIsArray = Array.isArray;
const intrinsicCharCodeAt = String.prototype.charCodeAt;
const intrinsicGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const intrinsicGetPrototypeOf = Object.getPrototypeOf;
const intrinsicNumberIsFinite = Number.isFinite;
const intrinsicNumberIsSafeInteger = Number.isSafeInteger;
const intrinsicObjectFreeze = Object.freeze;
const intrinsicReflectApply = Reflect.apply;
const intrinsicOwnKeys = Reflect.ownKeys;
const intrinsicString = String;
const intrinsicWeakSet = WeakSet;
const intrinsicWeakSetAdd = WeakSet.prototype.add;
const intrinsicWeakSetDelete = WeakSet.prototype.delete;
const intrinsicWeakSetHas = WeakSet.prototype.has;
const intrinsicArrayPrototype = Array.prototype;
const intrinsicObjectPrototype = Object.prototype;

const boundExceeded: CanonicalJsonUtf8Size = intrinsicObjectFreeze({
  status: "bound-exceeded" as const,
});
const depthExceeded: CanonicalJsonUtf8Size = intrinsicObjectFreeze({
  status: "depth-exceeded" as const,
});
const invalid: CanonicalJsonUtf8Size = intrinsicObjectFreeze({ status: "invalid" as const });

function codeUnit(value: string, index: number): number {
  return intrinsicReflectApply(intrinsicCharCodeAt, value, [index]) as number;
}

function activeHas(active: WeakSet<object>, value: object): boolean {
  return intrinsicReflectApply(intrinsicWeakSetHas, active, [value]) as boolean;
}

function activeAdd(active: WeakSet<object>, value: object): void {
  intrinsicReflectApply(intrinsicWeakSetAdd, active, [value]);
}

function activeDelete(active: WeakSet<object>, value: object): void {
  intrinsicReflectApply(intrinsicWeakSetDelete, active, [value]);
}

/** Counts the UTF-8 bytes emitted by JSON.stringify for one primitive string. */
function jsonStringBytes(value: string, charge: (bytes: number) => boolean): boolean {
  if (!charge(2)) return false;
  for (let index = 0; index < value.length; index += 1) {
    const current = codeUnit(value, index);
    if (current === 0x22 || current === 0x5c) {
      if (!charge(2)) return false;
      continue;
    }
    if (current <= 0x1f) {
      const shortEscape =
        current === 0x08 ||
        current === 0x09 ||
        current === 0x0a ||
        current === 0x0c ||
        current === 0x0d;
      if (!charge(shortEscape ? 2 : 6)) return false;
      continue;
    }
    if (current <= 0x7f) {
      if (!charge(1)) return false;
      continue;
    }
    if (current <= 0x7ff) {
      if (!charge(2)) return false;
      continue;
    }
    if (current >= 0xd800 && current <= 0xdbff) {
      const next = index + 1 < value.length ? codeUnit(value, index + 1) : -1;
      if (next >= 0xdc00 && next <= 0xdfff) {
        index += 1;
        if (!charge(4)) return false;
      } else if (!charge(6)) {
        return false;
      }
      continue;
    }
    if (current >= 0xdc00 && current <= 0xdfff) {
      if (!charge(6)) return false;
      continue;
    }
    if (!charge(3)) return false;
  }
  return true;
}

/**
 * Measures the exact canonical-JSON UTF-8 size used by the CLI without constructing
 * JSON text or retaining aliases. Recognized proxies are rejected before reflection.
 */
export function measureCanonicalJsonUtf8Bytes(
  value: unknown,
  options: CanonicalJsonUtf8SizeOptions,
): CanonicalJsonUtf8Size {
  if (
    !intrinsicNumberIsSafeInteger(options.maximumBytes) ||
    options.maximumBytes < 0 ||
    !intrinsicNumberIsSafeInteger(options.maximumDepth) ||
    options.maximumDepth < 0 ||
    typeof options.isProxy !== "function"
  ) {
    return invalid;
  }
  let bytes = 0;
  const active = new intrinsicWeakSet<object>();
  const charge = (additional: number): boolean => {
    if (additional > options.maximumBytes - bytes) return false;
    bytes += additional;
    return true;
  };

  const visit = (candidate: unknown, depth: number): CanonicalJsonUtf8Size["status"] => {
    if (depth > options.maximumDepth) return "depth-exceeded";
    if (candidate === null) return charge(4) ? "accepted" : "bound-exceeded";
    if (typeof candidate === "boolean") {
      return charge(candidate ? 4 : 5) ? "accepted" : "bound-exceeded";
    }
    if (typeof candidate === "number") {
      if (!intrinsicNumberIsFinite(candidate)) return "invalid";
      return charge(intrinsicString(candidate).length) ? "accepted" : "bound-exceeded";
    }
    if (typeof candidate === "string") {
      return jsonStringBytes(candidate, charge) ? "accepted" : "bound-exceeded";
    }
    if (typeof candidate !== "object" || candidate === undefined) return "invalid";

    try {
      if (options.isProxy(candidate) || activeHas(active, candidate)) return "invalid";
      activeAdd(active, candidate);
      try {
        if (intrinsicArrayIsArray(candidate)) {
          if (intrinsicGetPrototypeOf(candidate) !== intrinsicArrayPrototype) return "invalid";
          const length = intrinsicGetOwnPropertyDescriptor(candidate, "length");
          if (
            length === undefined ||
            !("value" in length) ||
            !intrinsicNumberIsSafeInteger(length.value) ||
            length.value < 0
          ) {
            return "invalid";
          }
          const keys = intrinsicOwnKeys(candidate);
          if (keys.length !== length.value + 1) return "invalid";
          for (let index = 0; index < length.value; index += 1) {
            const descriptor = intrinsicGetOwnPropertyDescriptor(candidate, intrinsicString(index));
            if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
              return "invalid";
            }
          }
          if (!charge(2 + (length.value === 0 ? 0 : length.value - 1))) {
            return "bound-exceeded";
          }
          for (let index = 0; index < length.value; index += 1) {
            const descriptor = intrinsicGetOwnPropertyDescriptor(candidate, intrinsicString(index));
            if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
              return "invalid";
            }
            const status = visit(descriptor.value, depth + 1);
            if (status !== "accepted") return status;
          }
          return "accepted";
        }

        const prototype = intrinsicGetPrototypeOf(candidate);
        if (prototype !== intrinsicObjectPrototype && prototype !== null) return "invalid";
        const keys = intrinsicOwnKeys(candidate);
        let fieldCount = 0;
        for (let index = 0; index < keys.length; index += 1) {
          const key = keys[index];
          if (typeof key !== "string") return "invalid";
          const descriptor = intrinsicGetOwnPropertyDescriptor(candidate, key);
          if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
            return "invalid";
          }
          if (descriptor.value !== undefined) {
            fieldCount += 1;
          }
        }
        if (!charge(2 + (fieldCount === 0 ? 0 : fieldCount - 1))) return "bound-exceeded";
        for (let index = 0; index < keys.length; index += 1) {
          const key = keys[index];
          if (typeof key !== "string") return "invalid";
          const descriptor = intrinsicGetOwnPropertyDescriptor(candidate, key);
          if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
            return "invalid";
          }
          if (descriptor.value === undefined) continue;
          if (!jsonStringBytes(key, charge) || !charge(1)) return "bound-exceeded";
          const status = visit(descriptor.value, depth + 1);
          if (status !== "accepted") return status;
        }
        return "accepted";
      } finally {
        activeDelete(active, candidate);
      }
    } catch {
      return "invalid";
    }
  };

  try {
    const status = visit(value, 0);
    return status === "accepted"
      ? intrinsicObjectFreeze({ bytes, status })
      : status === "invalid"
        ? invalid
        : status === "depth-exceeded"
          ? depthExceeded
          : boundExceeded;
  } catch {
    return invalid;
  }
}
