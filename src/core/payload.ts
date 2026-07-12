import { failure, type Result, success } from "./result.ts";

export type GraphDataScalar = boolean | null | number | string;

export interface GraphDataRecord {
  readonly [key: string]: GraphData;
}

export type GraphData = GraphDataScalar | GraphDataRecord | readonly GraphData[];

type PayloadOwner = "entity" | "query" | "relation";

export interface CanonicalGraphDataCopy {
  readonly canonicalJson: string;
  readonly value: GraphData;
}

export interface CanonicalGraphDataBudget {
  readonly code: string;
  readonly maximum: number;
  readonly message: string;
}

function quoteJsonString(value: string): string {
  let quoted = '"';
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0x22) quoted += '\\"';
    else if (code === 0x5c) quoted += "\\\\";
    else if (code === 0x08) quoted += "\\b";
    else if (code === 0x09) quoted += "\\t";
    else if (code === 0x0a) quoted += "\\n";
    else if (code === 0x0c) quoted += "\\f";
    else if (code === 0x0d) quoted += "\\r";
    else if (code <= 0x1f || (code >= 0xd800 && code <= 0xdfff)) {
      const next = index + 1 < value.length ? value.charCodeAt(index + 1) : -1;
      if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
        quoted += value[index]! + value[index + 1]!;
        index += 1;
      } else {
        quoted += `\\u${code.toString(16).padStart(4, "0")}`;
      }
    } else quoted += value[index]!;
  }
  return `${quoted}"`;
}

function payloadPath(parent: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
    ? `${parent}.${key}`
    : `${parent}[${quoteJsonString(key)}]`;
}

function unsupportedPayload<T = never>(
  owner: PayloadOwner,
  path: string,
  reason: string,
): Result<T> {
  return failure({
    code: "unsupported-payload",
    message: `${owner} payload is not canonical graph data at ${path}: ${reason}`,
    details: { owner, path, reason },
  });
}

export function copyCanonicalGraphData(
  payload: unknown,
  owner: PayloadOwner,
  budget?: CanonicalGraphDataBudget,
): Result<CanonicalGraphDataCopy> {
  const activeContainers = new WeakSet<object>();
  const maximum = budget?.maximum ?? Number.POSITIVE_INFINITY;

  const tooLarge = (): Result<never> =>
    failure({
      code: budget?.code ?? "canonical-graph-data-too-large",
      message: budget?.message ?? "Canonical graph data exceeds its character budget",
      details: { maximum },
    });

  const copy = (
    value: unknown,
    path: string,
    remaining: number,
  ): Result<CanonicalGraphDataCopy> => {
    if (value === null) {
      return remaining >= 4 ? success({ canonicalJson: "null", value }) : tooLarge();
    }
    if (typeof value === "boolean") {
      const canonicalJson = value ? "true" : "false";
      return remaining >= canonicalJson.length ? success({ canonicalJson, value }) : tooLarge();
    }
    if (typeof value === "string") {
      const canonicalJson = quoteJsonString(value);
      return remaining >= canonicalJson.length ? success({ canonicalJson, value }) : tooLarge();
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        return unsupportedPayload(owner, path, "numbers must be finite");
      }
      const normalized = Object.is(value, -0) ? 0 : value;
      const canonicalJson = String(normalized);
      return remaining >= canonicalJson.length
        ? success({ canonicalJson, value: normalized })
        : tooLarge();
    }
    if (typeof value !== "object") {
      return unsupportedPayload(
        owner,
        path,
        `received ${typeof value}; expected null, boolean, finite number, string, array, or plain record`,
      );
    }
    if (activeContainers.has(value)) {
      return unsupportedPayload(owner, path, "cyclic references are not supported");
    }

    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        return unsupportedPayload(
          owner,
          path,
          "arrays must use the intrinsic Array prototype without subclasses or custom prototypes",
        );
      }
      const ownKeys = Reflect.ownKeys(value);
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
      if (
        lengthDescriptor === undefined ||
        !("value" in lengthDescriptor) ||
        !Number.isSafeInteger(lengthDescriptor.value) ||
        lengthDescriptor.value < 0
      ) {
        return unsupportedPayload(owner, path, "arrays must have an intrinsic data length");
      }
      const arrayLength = lengthDescriptor.value;
      const symbolKey = ownKeys.find((key) => typeof key === "symbol");
      if (symbolKey !== undefined) {
        return unsupportedPayload(owner, path, "arrays must not contain symbol properties");
      }
      const extraKey = ownKeys.find((key) => {
        if (key === "length" || typeof key !== "string") return false;
        const index = Number(key);
        return (
          !Number.isSafeInteger(index) || index < 0 || index >= arrayLength || String(index) !== key
        );
      });
      if (extraKey !== undefined) {
        return unsupportedPayload(
          owner,
          payloadPath(path, String(extraKey)),
          "arrays must not contain named or non-index properties",
        );
      }
      if (remaining < 2) return tooLarge();

      activeContainers.add(value);
      try {
        const copiedItems: GraphData[] = [];
        const canonicalParts = ["["];
        let available = remaining - 1;
        for (let index = 0; index < arrayLength; index += 1) {
          if (index > 0) {
            if (available < 1) return tooLarge();
            canonicalParts.push(",");
            available -= 1;
          }
          const itemPath = `${path}[${index}]`;
          const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
          if (descriptor === undefined) {
            return unsupportedPayload(owner, itemPath, "sparse array entries are not supported");
          }
          if (!("value" in descriptor) || !descriptor.enumerable) {
            return unsupportedPayload(
              owner,
              itemPath,
              "array entries must be ordinary enumerable data values",
            );
          }
          const item = copy(descriptor.value, itemPath, available - 1);
          if (!item.ok) return item;
          copiedItems.push(item.value.value);
          canonicalParts.push(item.value.canonicalJson);
          available -= item.value.canonicalJson.length;
        }
        if (available < 1) return tooLarge();
        canonicalParts.push("]");
        return success({
          canonicalJson: canonicalParts.join(""),
          value: Object.freeze(copiedItems),
        });
      } finally {
        activeContainers.delete(value);
      }
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return unsupportedPayload(
        owner,
        path,
        "objects must be plain records without class instances or custom prototypes",
      );
    }
    const ownKeys = Reflect.ownKeys(value);
    const symbolKey = ownKeys.find((key) => typeof key === "symbol");
    if (symbolKey !== undefined) {
      return unsupportedPayload(owner, path, "plain records must not contain symbol properties");
    }
    if (remaining < 2) return tooLarge();

    activeContainers.add(value);
    try {
      const copiedRecord: Record<string, GraphData> = {};
      const canonicalParts = ["{"];
      const keys = (ownKeys as string[]).sort();
      let available = remaining - 1;
      for (let index = 0; index < keys.length; index += 1) {
        const key = keys[index]!;
        const keyJson = quoteJsonString(key);
        const prefix = `${index > 0 ? "," : ""}${keyJson}:`;
        if (available - 1 < prefix.length) return tooLarge();
        canonicalParts.push(prefix);
        available -= prefix.length;

        const pathToValue = payloadPath(path, key);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
          return unsupportedPayload(
            owner,
            pathToValue,
            "record properties must be ordinary enumerable data values, not accessors",
          );
        }
        const child = copy(descriptor.value, pathToValue, available - 1);
        if (!child.ok) return child;
        Object.defineProperty(copiedRecord, key, {
          configurable: true,
          enumerable: true,
          value: child.value.value,
          writable: true,
        });
        canonicalParts.push(child.value.canonicalJson);
        available -= child.value.canonicalJson.length;
      }
      if (available < 1) return tooLarge();
      canonicalParts.push("}");
      return success({
        canonicalJson: canonicalParts.join(""),
        value: Object.freeze(copiedRecord),
      });
    } finally {
      activeContainers.delete(value);
    }
  };

  try {
    return copy(payload, "$", maximum);
  } catch (error) {
    let inspectionError = "unknown inspection failure";
    try {
      inspectionError = error instanceof Error ? error.message : String(error);
    } catch {
      // A thrown behavior-bearing value may itself reject inspection.
    }
    return unsupportedPayload(
      owner,
      "$",
      `payload could not be inspected safely (${inspectionError})`,
    );
  }
}

export function copyGraphPayload(payload: unknown, owner: PayloadOwner): Result<GraphData> {
  const copied = copyCanonicalGraphData(payload, owner);
  return copied.ok ? success(copied.value.value) : copied;
}
