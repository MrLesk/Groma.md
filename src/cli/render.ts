import {
  CLI_MAX_RENDERED_BYTES,
  CLI_MAX_JSON_DEPTH,
  CLI_MAX_RENDERED_VALUES,
  type CliCommandResult,
  type CliFormat,
  type CliOverviewResult,
} from "./contracts.ts";
import { formatSplash } from "./splash.ts";

const intrinsicArrayIsArray = Array.isArray;
const intrinsicGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const intrinsicGetPrototypeOf = Object.getPrototypeOf;
const intrinsicJsonStringify = JSON.stringify;
const intrinsicOwnKeys = Reflect.ownKeys;
const utf8 = new TextEncoder();

export type RenderResult = { readonly ok: false } | { readonly ok: true; readonly text: string };

function jsonString(value: string): string {
  return intrinsicJsonStringify(value);
}

function canonicalJson(value: unknown): string | undefined {
  const active = new WeakSet<object>();
  let values = 0;
  const encode = (current: unknown, depth: number): string | undefined => {
    values += 1;
    if (values > CLI_MAX_RENDERED_VALUES || depth > CLI_MAX_JSON_DEPTH) return undefined;
    if (current === null) return "null";
    if (typeof current === "string") return jsonString(current);
    if (typeof current === "boolean") return current ? "true" : "false";
    if (typeof current === "number") return Number.isFinite(current) ? String(current) : undefined;
    if (current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    if (active.has(current)) return undefined;
    active.add(current);
    try {
      if (intrinsicArrayIsArray(current)) {
        if (intrinsicGetPrototypeOf(current) !== Array.prototype) return undefined;
        const length = intrinsicGetOwnPropertyDescriptor(current, "length");
        if (length === undefined || !("value" in length) || !Number.isSafeInteger(length.value)) {
          return undefined;
        }
        const keys = intrinsicOwnKeys(current);
        if (keys.length !== length.value + 1) return undefined;
        const values = new Array<string>(length.value);
        for (let index = 0; index < length.value; index += 1) {
          const descriptor = intrinsicGetOwnPropertyDescriptor(current, String(index));
          if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
            return undefined;
          }
          const encoded = encode(descriptor.value, depth + 1);
          if (encoded === undefined) return undefined;
          values[index] = encoded;
        }
        return `[${values.join(",")}]`;
      }
      const prototype = intrinsicGetPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) return undefined;
      const keys = intrinsicOwnKeys(current);
      const stringKeys = new Array<string>(keys.length);
      for (let index = 0; index < keys.length; index += 1) {
        const key = keys[index];
        if (typeof key !== "string") return undefined;
        stringKeys[index] = key;
      }
      stringKeys.sort();
      const fields: string[] = [];
      for (const key of stringKeys) {
        const descriptor = intrinsicGetOwnPropertyDescriptor(current, key);
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
          return undefined;
        }
        if (descriptor.value === undefined) continue;
        const encoded = encode(descriptor.value, depth + 1);
        if (encoded === undefined) return undefined;
        fields.push(`${jsonString(key)}:${encoded}`);
      }
      return `{${fields.join(",")}}`;
    } finally {
      active.delete(current);
    }
  };
  try {
    return encode(value, 0);
  } catch {
    return undefined;
  }
}

function overviewPlain(result: CliOverviewResult, color: boolean): string | undefined {
  if (result.kind === "workspace-missing") {
    return formatSplash({ color, workspace: "missing" });
  }
  if (result.kind === "help") return formatSplash({ color, workspace: "ready" });
  const lines = ["Groma blueprint", `generation: ${result.generation}`];
  for (const node of result.nodes) {
    const fields = [
      `id=${jsonString(node.id)}`,
      `revision=${jsonString(node.revision)}`,
      ...(node.type === undefined ? [] : [`type=${jsonString(node.type)}`]),
      ...(node.scale === undefined ? [] : [`scale=${node.scale}`]),
      ...(node.shared === true ? ["shared"] : []),
      `display=${jsonString(node.displayText)}`,
      ...(node.name === undefined ? [] : [`name=${jsonString(node.name)}`]),
    ];
    lines.push(`${"  ".repeat(node.depth)}- ${fields.join(" ")}`);
  }
  for (const truncation of result.truncations) {
    const fields = [
      `reason=${truncation.reason}`,
      ...(truncation.parent === undefined ? [] : [`parent=${jsonString(truncation.parent)}`]),
      ...(truncation.cursor === undefined ? [] : [`cursor=${jsonString(truncation.cursor)}`]),
    ];
    lines.push(`truncated: ${fields.join(" ")}`);
  }
  return `${lines.join("\n")}\n`;
}

function isOverviewResult(value: unknown): value is CliOverviewResult {
  if (typeof value !== "object" || value === null) return false;
  const kind = (value as { readonly kind?: unknown }).kind;
  return kind === "help" || kind === "workspace-missing" || kind === "hierarchy";
}

export function renderCommandResult(
  value: CliCommandResult,
  format: CliFormat,
  presentation?: { readonly color?: boolean },
): RenderResult {
  let text: string | undefined;
  try {
    if (format === "json") {
      const encoded = canonicalJson({
        command: value.command,
        exitCode: value.exitCode,
        ok: value.ok,
        result: value.result,
      });
      text = encoded === undefined ? undefined : `${encoded}\n`;
    } else if (value.command === "overview" && isOverviewResult(value.result)) {
      text = overviewPlain(value.result, presentation?.color === true);
    } else {
      const encoded = canonicalJson(value.result);
      text =
        encoded === undefined
          ? undefined
          : `command: ${value.command}\nexit-code: ${value.exitCode}\nok: ${value.ok ? "true" : "false"}\nresult: ${encoded}\n`;
    }
  } catch {
    text = undefined;
  }
  if (text === undefined || utf8.encode(text).byteLength > CLI_MAX_RENDERED_BYTES) {
    return Object.freeze({ ok: false as const });
  }
  return Object.freeze({ ok: true as const, text });
}
