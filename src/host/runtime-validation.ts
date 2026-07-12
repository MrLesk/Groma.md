import { isProxy } from "node:util/types";

import { failure, success, type Diagnostic, type Result } from "../core/index.ts";
import {
  inspectExactRecord,
  inspectIntrinsicArrayLength,
  type InspectedRecord,
} from "../core/runtime.ts";

function invalid(code: string, message: string): Diagnostic {
  return Object.freeze({ code, message });
}

export function isHostProxy(value: unknown): boolean {
  return typeof value === "object" && value !== null && isProxy(value);
}

export function inspectHostRecord(
  value: unknown,
  acceptedKeySets: readonly (readonly string[])[],
  code: string,
  subject: string,
): Result<InspectedRecord> {
  if (isHostProxy(value)) {
    return failure(invalid(code, `${subject} must not be a proxy`));
  }
  return inspectExactRecord(value, acceptedKeySets, code, subject);
}

export function inspectHostDenseArray(
  value: unknown,
  maximum: number,
  code: string,
  subject: string,
): Result<readonly unknown[]> {
  if (isHostProxy(value)) {
    return failure(invalid(code, `${subject} must not be a proxy`));
  }
  const length = inspectIntrinsicArrayLength(value, code, subject);
  if (!length.ok) return length;
  if (length.value > maximum) {
    return failure(invalid(code, `${subject} exceeds its configured bound`));
  }
  try {
    const keys = Reflect.ownKeys(value as object);
    if (keys.length !== length.value + 1) {
      return failure(invalid(code, `${subject} must be dense without extra properties`));
    }
    const copied = new Array<unknown>(length.value);
    for (let index = 0; index < length.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return failure(invalid(code, `${subject} entries must be enumerable data properties`));
      }
      copied[index] = descriptor.value;
    }
    return success(Object.freeze(copied));
  } catch {
    return failure(invalid(code, `${subject} could not be inspected safely`));
  }
}

function copyDiagnosticDetails(
  value: unknown,
  code: string,
): Result<Readonly<Record<string, string | number | boolean>>> {
  if (typeof value !== "object" || value === null || Array.isArray(value) || isProxy(value)) {
    return failure(invalid(code, "Diagnostic details are malformed"));
  }
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return failure(invalid(code, "Diagnostic details are malformed"));
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length > 64) return failure(invalid(code, "Diagnostic details are malformed"));
    const copied: Record<string, string | number | boolean> = Object.create(null) as Record<
      string,
      string | number | boolean
    >;
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      if (typeof key !== "string" || key.length === 0 || key.length > 4_096) {
        return failure(invalid(code, "Diagnostic details are malformed"));
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return failure(invalid(code, "Diagnostic details are malformed"));
      }
      const detail = descriptor.value;
      if (
        (typeof detail !== "string" || detail.length > 4_096) &&
        (typeof detail !== "number" || !Number.isFinite(detail)) &&
        typeof detail !== "boolean"
      ) {
        return failure(invalid(code, "Diagnostic details are malformed"));
      }
      copied[key] = detail;
    }
    return success(Object.freeze(copied));
  } catch {
    return failure(invalid(code, "Diagnostic details are malformed"));
  }
}

export function copyHostDiagnostics(
  value: unknown,
  maximum: number,
  code: string,
): Result<readonly Diagnostic[]> {
  const entries = inspectHostDenseArray(value, maximum, code, "Diagnostics");
  if (!entries.ok) return entries;
  const copied = new Array<Diagnostic>(entries.value.length);
  for (let index = 0; index < entries.value.length; index += 1) {
    const entry = inspectHostRecord(
      entries.value[index],
      [
        ["code", "message"],
        ["code", "details", "message"],
      ],
      code,
      "Diagnostic",
    );
    if (
      !entry.ok ||
      typeof entry.value.code !== "string" ||
      entry.value.code.length === 0 ||
      entry.value.code.length > 4_096 ||
      typeof entry.value.message !== "string" ||
      entry.value.message.length === 0 ||
      entry.value.message.length > 4_096
    ) {
      return failure(invalid(code, "Diagnostic scalar fields are malformed"));
    }
    let details: Readonly<Record<string, string | number | boolean>> | undefined;
    if (Object.hasOwn(entry.value, "details")) {
      const validated = copyDiagnosticDetails(entry.value.details, code);
      if (!validated.ok) return validated;
      details = validated.value;
    }
    copied[index] = Object.freeze({
      code: entry.value.code,
      ...(details === undefined ? {} : { details }),
      message: entry.value.message,
    });
  }
  return success(Object.freeze(copied));
}
