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
    for (let index = 0; index < ownKeys.length; index += 1) {
      if (typeof ownKeys[index] === "symbol") {
        return invalidShape(code, subject, "symbol properties are not allowed");
      }
    }
    const keys = ownKeys as string[];
    let accepted = false;
    for (let setIndex = 0; setIndex < acceptedKeySets.length && !accepted; setIndex += 1) {
      const expected = acceptedKeySets[setIndex]!;
      if (expected.length !== keys.length) continue;
      accepted = true;
      for (let keyIndex = 0; keyIndex < expected.length; keyIndex += 1) {
        let found = false;
        for (let actualIndex = 0; actualIndex < keys.length; actualIndex += 1) {
          if (keys[actualIndex] === expected[keyIndex]) {
            found = true;
            break;
          }
        }
        if (!found) {
          accepted = false;
          break;
        }
      }
    }
    if (!accepted) {
      return invalidShape(code, subject, "record keys do not match the public contract exactly");
    }

    const inspected: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index]!;
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

export function inspectIntrinsicArrayLength(
  value: unknown,
  code: string,
  subject: string,
): Result<number> {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      return invalidShape(code, subject, "expected an intrinsic array");
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    ) {
      return invalidShape(code, subject, "array length is not an intrinsic safe data value");
    }
    return success(lengthDescriptor.value);
  } catch {
    return invalidShape(code, subject, "array inspection failed");
  }
}
