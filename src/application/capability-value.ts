import { containNativePromise } from "./promise-observation.ts";

interface CapabilityValueContainmentOptions {
  readonly isProxy: (value: unknown) => boolean;
  readonly maximumContainerEntries: number;
  readonly maximumDepth: number;
  readonly maximumValues: number;
}

export type ContainedCapabilityValue =
  { readonly ok: false } | { readonly ok: true; readonly value: unknown };

const intrinsicArrayIsArray = Array.isArray;
const intrinsicCreate = Object.create;
const intrinsicDefineProperty = Object.defineProperty;
const intrinsicFreeze = Object.freeze;
const intrinsicGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const intrinsicGetPrototypeOf = Object.getPrototypeOf;
const intrinsicOwnKeys = Reflect.ownKeys;

const containmentFailure: ContainedCapabilityValue = intrinsicFreeze({ ok: false as const });

/**
 * Copies one explicit capability return value without retaining aliases or invoking
 * accessors. The decoder-provenanced proxy policy always runs before reflection.
 */
export function containCapabilityValue(
  source: unknown,
  options: CapabilityValueContainmentOptions,
): ContainedCapabilityValue {
  let remaining = options.maximumValues;
  const active = new WeakSet<object>();

  const copy = (value: unknown, depth: number): ContainedCapabilityValue => {
    if (depth > options.maximumDepth || remaining < 1) return containmentFailure;
    remaining -= 1;
    if (
      value === null ||
      value === undefined ||
      typeof value === "boolean" ||
      typeof value === "number" ||
      typeof value === "string"
    ) {
      return { ok: true, value };
    }
    if (typeof value !== "object") return containmentFailure;

    try {
      if (options.isProxy(value)) return containmentFailure;
      if (containNativePromise(value) !== "not-native") return containmentFailure;
      if (active.has(value)) return containmentFailure;
      active.add(value);
      try {
        if (intrinsicArrayIsArray(value)) {
          if (intrinsicGetPrototypeOf(value) !== Array.prototype) return containmentFailure;
          const length = intrinsicGetOwnPropertyDescriptor(value, "length");
          if (
            length === undefined ||
            !("value" in length) ||
            !Number.isSafeInteger(length.value) ||
            length.value < 0 ||
            length.value > options.maximumContainerEntries
          ) {
            return containmentFailure;
          }
          const keys = intrinsicOwnKeys(value);
          const copied: unknown[] = new Array<unknown>(length.value);
          let malformed = keys.length !== length.value + 1;
          const visited = new Set<string>();
          for (let index = 0; index < length.value; index += 1) {
            const key = String(index);
            visited.add(key);
            const descriptor = intrinsicGetOwnPropertyDescriptor(value, key);
            if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
              malformed = true;
              continue;
            }
            const item = copy(descriptor.value, depth + 1);
            if (!item.ok) {
              malformed = true;
            } else {
              copied[index] = item.value;
            }
          }
          let extraEntriesRemaining = Math.max(0, options.maximumContainerEntries - length.value);
          for (const key of keys) {
            if (key === "length" || (typeof key === "string" && visited.has(key))) continue;
            malformed = true;
            if (extraEntriesRemaining < 1 || remaining < 1) break;
            extraEntriesRemaining -= 1;
            const descriptor = intrinsicGetOwnPropertyDescriptor(value, key);
            if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
              continue;
            }
            copy(descriptor.value, depth + 1);
          }
          if (malformed) return containmentFailure;
          return { ok: true, value: intrinsicFreeze(copied) };
        }

        const prototype = intrinsicGetPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return containmentFailure;
        const keys = intrinsicOwnKeys(value);
        if (keys.length > options.maximumContainerEntries) return containmentFailure;
        const copied = intrinsicCreate(null) as Record<string, unknown>;
        let malformed = false;
        for (const key of keys) {
          const descriptor = intrinsicGetOwnPropertyDescriptor(value, key);
          if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
            malformed = true;
            continue;
          }
          const child = copy(descriptor.value, depth + 1);
          if (!child.ok) {
            malformed = true;
          } else if (typeof key !== "string") {
            malformed = true;
          } else {
            intrinsicDefineProperty(copied, key, { enumerable: true, value: child.value });
          }
        }
        if (malformed) return containmentFailure;
        return { ok: true, value: intrinsicFreeze(copied) };
      } finally {
        active.delete(value);
      }
    } catch {
      return containmentFailure;
    }
  };

  try {
    const result = copy(source, 0);
    return result.ok ? intrinsicFreeze(result) : containmentFailure;
  } catch {
    return containmentFailure;
  }
}
