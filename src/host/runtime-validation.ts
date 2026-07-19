import { failure, success, type Diagnostic, type Result } from "../core/index.ts";
import { inspectExactRecord, type InspectedRecord } from "../core/runtime.ts";

const invalid = (code: string, message: string): Diagnostic => Object.freeze({ code, message });

/** Plugins run in the same trusted process; Proxy detection is not a security boundary. */
export function isHostProxy(_value: unknown): boolean {
  return false;
}

export function inspectHostRecord(
  value: unknown,
  acceptedKeySets: readonly (readonly string[])[],
  code: string,
  subject: string,
): Result<InspectedRecord> {
  return inspectExactRecord(value, acceptedKeySets, code, subject);
}

export function inspectHostDenseArray(
  value: unknown,
  maximum: number,
  code: string,
  subject: string,
): Result<readonly unknown[]> {
  if (!Array.isArray(value) || value.length > maximum)
    return failure(invalid(code, `${subject} must be a bounded array`));
  return success(Object.freeze([...value]));
}

function copyDetails(
  value: unknown,
  code: string,
): Result<Readonly<Record<string, string | number | boolean>>> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return failure(invalid(code, "Diagnostic details are malformed"));
  const entries = Object.entries(value);
  if (entries.length > 64) return failure(invalid(code, "Diagnostic details are malformed"));
  const copied: Record<string, string | number | boolean> = {};
  for (const [key, detail] of entries) {
    if (
      key.length === 0 ||
      key.length > 4_096 ||
      (typeof detail === "string" && detail.length > 4_096) ||
      (typeof detail === "number" && !Number.isFinite(detail)) ||
      !["string", "number", "boolean"].includes(typeof detail)
    )
      return failure(invalid(code, "Diagnostic details are malformed"));
    copied[key] = detail as string | number | boolean;
  }
  return success(Object.freeze(copied));
}

export function copyHostDiagnostics(
  value: unknown,
  maximum: number,
  code: string,
): Result<readonly Diagnostic[]> {
  const entries = inspectHostDenseArray(value, maximum, code, "Diagnostics");
  if (!entries.ok) return entries;
  const copied: Diagnostic[] = [];
  for (const item of entries.value) {
    if (typeof item !== "object" || item === null || Array.isArray(item))
      return failure(invalid(code, "Diagnostics are malformed"));
    const record = item as Record<string, unknown>;
    if (
      typeof record.code !== "string" ||
      record.code.length === 0 ||
      record.code.length > 4_096 ||
      typeof record.message !== "string" ||
      record.message.length === 0 ||
      record.message.length > 4_096
    )
      return failure(invalid(code, "Diagnostics are malformed"));
    const details = record.details === undefined ? undefined : copyDetails(record.details, code);
    if (details !== undefined && !details.ok) return details;
    copied.push(
      Object.freeze({
        code: record.code,
        ...(details === undefined ? {} : { details: details.value }),
        message: record.message,
      }),
    );
  }
  return success(Object.freeze(copied));
}
