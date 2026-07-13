import {
  CLI_MAX_INPUT_BYTES,
  CLI_MAX_JSON_DEPTH,
  CLI_MAX_JSON_VALUES,
  type CliDiagnostic,
} from "./contracts.ts";

const intrinsicArrayIsArray = Array.isArray;
const intrinsicGetPrototypeOf = Object.getPrototypeOf;
const intrinsicOwnKeys = Reflect.ownKeys;
const intrinsicGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const intrinsicJsonParse = JSON.parse;
const utf8 = new TextEncoder();

export type StructuredInputResult =
  | { readonly diagnostic: CliDiagnostic; readonly ok: false }
  | { readonly ok: true; readonly value: Readonly<Record<string, unknown>> };

function failure(message: string): StructuredInputResult {
  return Object.freeze({
    diagnostic: Object.freeze({ code: "cli-invalid-input", message }),
    ok: false as const,
  });
}

function boundedJson(value: unknown): boolean {
  let values = 0;
  const visit = (current: unknown, depth: number): boolean => {
    values += 1;
    if (values > CLI_MAX_JSON_VALUES || depth > CLI_MAX_JSON_DEPTH) return false;
    if (
      current === null ||
      typeof current === "string" ||
      typeof current === "boolean" ||
      (typeof current === "number" && Number.isFinite(current))
    ) {
      return true;
    }
    if (typeof current !== "object") return false;
    const prototype = intrinsicGetPrototypeOf(current);
    if (intrinsicArrayIsArray(current)) {
      if (prototype !== Array.prototype || current.length > CLI_MAX_JSON_VALUES) return false;
      const keys = intrinsicOwnKeys(current);
      if (keys.length !== current.length + 1) return false;
      for (let index = 0; index < current.length; index += 1) {
        const descriptor = intrinsicGetOwnPropertyDescriptor(current, String(index));
        if (
          descriptor === undefined ||
          !("value" in descriptor) ||
          !descriptor.enumerable ||
          !visit(descriptor.value, depth + 1)
        ) {
          return false;
        }
      }
      return true;
    }
    if (prototype !== Object.prototype) return false;
    const keys = intrinsicOwnKeys(current);
    if (keys.length > CLI_MAX_JSON_VALUES) return false;
    for (const key of keys) {
      if (typeof key !== "string") return false;
      const descriptor = intrinsicGetOwnPropertyDescriptor(current, key);
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        !descriptor.enumerable ||
        !visit(descriptor.value, depth + 1)
      ) {
        return false;
      }
    }
    return true;
  };
  return visit(value, 0);
}

export function decodeStructuredInput(text: string): StructuredInputResult {
  if (utf8.encode(text).byteLength > CLI_MAX_INPUT_BYTES) {
    return failure("Structured input exceeds the supported byte bound");
  }
  const document = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  let value: unknown;
  try {
    value = intrinsicJsonParse(document) as unknown;
  } catch {
    return failure("Structured input must be one valid UTF-8 JSON document");
  }
  if (
    typeof value !== "object" ||
    value === null ||
    intrinsicArrayIsArray(value) ||
    !boundedJson(value)
  ) {
    return failure("Structured input must be one bounded JSON object");
  }
  return Object.freeze({ ok: true as const, value: value as Readonly<Record<string, unknown>> });
}
