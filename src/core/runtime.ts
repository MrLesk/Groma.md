import { failure, type Result, success } from "./result.ts";

export type InspectedRecord = Readonly<Record<string, unknown>>;

function invalidShape(code: string, subject: string, reason: string): Result<never> {
  return failure({
    code,
    message: `${subject} has an invalid runtime shape: ${reason}`,
    details: { reason },
  });
}

export function inspectExactRecord(
  value: unknown,
  acceptedKeySets: readonly (readonly string[])[],
  code: string,
  subject: string,
): Result<InspectedRecord> {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return invalidShape(code, subject, "expected a plain record");
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return invalidShape(code, subject, "expected the intrinsic Object prototype or null");
    }
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key === "symbol")) {
      return invalidShape(code, subject, "symbol properties are not allowed");
    }
    const keys = (ownKeys as string[]).sort();
    const accepted = acceptedKeySets.some((keySet) => {
      const expected = [...keySet].sort();
      return expected.length === keys.length && expected.every((key, index) => key === keys[index]);
    });
    if (!accepted) {
      return invalidShape(code, subject, "record keys do not match the public contract exactly");
    }

    const inspected: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return invalidShape(code, subject, `${key} must be an enumerable data property`);
      }
      Object.defineProperty(inspected, key, {
        enumerable: true,
        value: descriptor.value,
      });
    }
    return success(Object.freeze(inspected));
  } catch {
    return invalidShape(code, subject, "record inspection failed");
  }
}
