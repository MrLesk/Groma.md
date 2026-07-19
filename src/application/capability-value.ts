interface CapabilityValueContainmentOptions {
  readonly isProxy: (value: unknown) => boolean;
  readonly maximumContainerEntries: number;
  readonly maximumDepth: number;
  readonly maximumValues: number;
}

export type ContainedCapabilityValue =
  { readonly ok: false } | { readonly ok: true; readonly value: unknown };

const failed: ContainedCapabilityValue = Object.freeze({ ok: false as const });

/** Copies bounded data returned by a capability. Plugins are trusted code, not sandboxed realms. */
export function containCapabilityValue(
  source: unknown,
  options: CapabilityValueContainmentOptions,
): ContainedCapabilityValue {
  let remaining = options.maximumValues;
  const active = new WeakSet<object>();
  const copy = (value: unknown, depth: number): ContainedCapabilityValue => {
    if (depth > options.maximumDepth || remaining-- <= 0) return failed;
    if (
      value === null ||
      value === undefined ||
      typeof value === "boolean" ||
      typeof value === "string"
    )
      return { ok: true, value };
    if (typeof value === "number")
      return Number.isFinite(value)
        ? { ok: true, value: Object.is(value, -0) ? 0 : value }
        : failed;
    if (typeof value !== "object" || value instanceof Promise || active.has(value)) return failed;
    active.add(value);
    try {
      if (Array.isArray(value)) {
        if (value.length > options.maximumContainerEntries) return failed;
        const items: unknown[] = [];
        for (const item of value) {
          const copied = copy(item, depth + 1);
          if (!copied.ok) return failed;
          items.push(copied.value);
        }
        return { ok: true, value: Object.freeze(items) };
      }
      const keys = Object.keys(value);
      if (keys.length > options.maximumContainerEntries) return failed;
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        const copied = copy((value as Record<string, unknown>)[key], depth + 1);
        if (!copied.ok) return failed;
        result[key] = copied.value;
      }
      return { ok: true, value: Object.freeze(result) };
    } catch {
      return failed;
    } finally {
      active.delete(value);
    }
  };
  const result = copy(source, 0);
  return result.ok ? Object.freeze(result) : failed;
}
