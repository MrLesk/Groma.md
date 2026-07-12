import { failure, type Result, success } from "./result.ts";

export type GraphDataScalar = boolean | null | number | string;

export interface GraphDataRecord {
  readonly [key: string]: GraphData;
}

export type GraphData = GraphDataScalar | GraphDataRecord | readonly GraphData[];

type PayloadOwner = "entity" | "query" | "relation" | "transaction";

export interface CanonicalGraphDataCopy {
  readonly canonicalJson: string;
  readonly value: GraphData;
}

export interface CanonicalGraphDataBudget {
  readonly code: string;
  readonly maximum: number;
  readonly message: string;
}

export interface GraphDataStructuralBudget {
  readonly code: string;
  readonly maximumDepth: number;
  readonly maximumValues: number;
  readonly message: string;
}

interface GraphDataStructuralBudgetState {
  readonly budget: GraphDataStructuralBudget;
  remainingValues: number;
}

const intrinsicCharCodeAt = String.prototype.charCodeAt;
const intrinsicNumberToString = Number.prototype.toString;
const hexDigits = "0123456789abcdef";

interface QuotedJsonString {
  readonly length: number;
  readonly text: string;
}

function charCodeAt(value: string, index: number): number {
  return Reflect.apply(intrinsicCharCodeAt, value, [index]);
}

function quoteJsonString(
  value: string,
  maximum: number,
  emit: boolean,
): QuotedJsonString | undefined {
  if (maximum < 2) return undefined;
  let length = 1;
  let text = emit ? '"' : "";

  for (let index = 0; index < value.length; index += 1) {
    const code = charCodeAt(value, index);
    let fragment: string;
    if (code === 0x22) fragment = '\\"';
    else if (code === 0x5c) fragment = "\\\\";
    else if (code === 0x08) fragment = "\\b";
    else if (code === 0x09) fragment = "\\t";
    else if (code === 0x0a) fragment = "\\n";
    else if (code === 0x0c) fragment = "\\f";
    else if (code === 0x0d) fragment = "\\r";
    else if (code <= 0x1f || (code >= 0xd800 && code <= 0xdfff)) {
      const next = index + 1 < value.length ? charCodeAt(value, index + 1) : -1;
      if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
        fragment = value[index]! + value[index + 1]!;
        index += 1;
      } else {
        fragment = `\\u${hexDigits[(code >> 12) & 0xf]}${hexDigits[(code >> 8) & 0xf]}${hexDigits[(code >> 4) & 0xf]}${hexDigits[code & 0xf]}`;
      }
    } else fragment = value[index]!;

    if (length + fragment.length + 1 > maximum) return undefined;
    length += fragment.length;
    if (emit) text += fragment;
  }

  length += 1;
  if (emit) text += '"';
  return { length, text };
}

function payloadPath(parent: string, key: string, quotedKey?: string): string {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) return `${parent}.${key}`;
  return `${parent}[${quotedKey ?? key}]`;
}

function sortedStrings(values: readonly string[]): string[] {
  let source = new Array<string>(values.length);
  for (let index = 0; index < values.length; index += 1) source[index] = values[index]!;
  let target = new Array<string>(values.length);

  for (let width = 1; width < values.length; width *= 2) {
    for (let start = 0; start < values.length; start += width * 2) {
      const proposedMiddle = start + width;
      const proposedEnd = start + width * 2;
      const middle = proposedMiddle < values.length ? proposedMiddle : values.length;
      const end = proposedEnd < values.length ? proposedEnd : values.length;
      let left = start;
      let right = middle;
      let output = start;
      while (left < middle && right < end) {
        if (source[left]! <= source[right]!) target[output++] = source[left++]!;
        else target[output++] = source[right++]!;
      }
      while (left < middle) target[output++] = source[left++]!;
      while (right < end) target[output++] = source[right++]!;
    }
    const previous = source;
    source = target;
    target = previous;
  }
  return source;
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

function copyGraphData(
  payload: unknown,
  owner: PayloadOwner,
  emitCanonicalJson: boolean,
  budget?: CanonicalGraphDataBudget,
  structuralBudget?: GraphDataStructuralBudget,
  sharedStructuralState?: GraphDataStructuralBudgetState,
  rootPath = "$",
): Result<CanonicalGraphDataCopy> {
  const activeContainers = new WeakSet<object>();
  const maximum = budget?.maximum ?? Number.POSITIVE_INFINITY;
  const structuralState =
    sharedStructuralState ??
    (structuralBudget === undefined
      ? undefined
      : { budget: structuralBudget, remainingValues: structuralBudget.maximumValues });

  const tooLarge = (): Result<never> =>
    failure({
      code: budget?.code ?? "canonical-graph-data-too-large",
      message: budget?.message ?? "Canonical graph data exceeds its character budget",
      details: { maximum },
    });

  const tooComplex = (): Result<never> => {
    const structural = structuralState?.budget;
    return failure({
      code: structural?.code ?? "graph-data-structure-too-large",
      message: structural?.message ?? "Graph data exceeds its structural budget",
      details: {
        maximumDepth: structural?.maximumDepth ?? 0,
        maximumValues: structural?.maximumValues ?? 0,
      },
    });
  };

  const copy = (
    value: unknown,
    path: string,
    remaining: number,
    depth: number,
  ): Result<CanonicalGraphDataCopy> => {
    if (structuralState !== undefined) {
      if (depth > structuralState.budget.maximumDepth || structuralState.remainingValues < 1) {
        return tooComplex();
      }
      structuralState.remainingValues -= 1;
    }
    if (value === null) {
      return !emitCanonicalJson || remaining >= 4
        ? success({ canonicalJson: emitCanonicalJson ? "null" : "", value })
        : tooLarge();
    }
    if (typeof value === "boolean") {
      const canonicalJson = emitCanonicalJson ? (value ? "true" : "false") : "";
      return !emitCanonicalJson || remaining >= canonicalJson.length
        ? success({ canonicalJson, value })
        : tooLarge();
    }
    if (typeof value === "string") {
      if (!emitCanonicalJson) return success({ canonicalJson: "", value });
      const quoted = quoteJsonString(value, remaining, true);
      return quoted === undefined ? tooLarge() : success({ canonicalJson: quoted.text, value });
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        return unsupportedPayload(owner, path, "numbers must be finite");
      }
      const normalized = Object.is(value, -0) ? 0 : value;
      const canonicalJson = emitCanonicalJson
        ? Reflect.apply(intrinsicNumberToString, normalized, [])
        : "";
      return !emitCanonicalJson || remaining >= canonicalJson.length
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
      if (structuralState !== undefined && arrayLength > structuralState.remainingValues) {
        return tooComplex();
      }
      if (emitCanonicalJson) {
        if (remaining < 2) return tooLarge();
        if (arrayLength > 0 && arrayLength > (remaining - 1) / 2) return tooLarge();
      }
      const ownKeys = Reflect.ownKeys(value);
      for (let keyIndex = 0; keyIndex < ownKeys.length; keyIndex += 1) {
        const key = ownKeys[keyIndex]!;
        if (typeof key === "symbol") {
          return unsupportedPayload(owner, path, "arrays must not contain symbol properties");
        }
        if (key === "length") continue;
        const index = Number(key);
        if (
          !Number.isSafeInteger(index) ||
          index < 0 ||
          index >= arrayLength ||
          String(index) !== key
        ) {
          return unsupportedPayload(
            owner,
            payloadPath(path, key),
            "arrays must not contain named or non-index properties",
          );
        }
      }
      activeContainers.add(value);
      try {
        const copiedItems: GraphData[] = [];
        let canonicalJson = emitCanonicalJson ? "[" : "";
        let available = emitCanonicalJson ? remaining - 1 : remaining;
        for (let index = 0; index < arrayLength; index += 1) {
          if (emitCanonicalJson && index > 0) {
            if (available < 1) return tooLarge();
            canonicalJson += ",";
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
          const item = copy(
            descriptor.value,
            itemPath,
            emitCanonicalJson ? available - 1 : available,
            depth + 1,
          );
          if (!item.ok) return item;
          copiedItems[index] = item.value.value;
          if (emitCanonicalJson) {
            canonicalJson += item.value.canonicalJson;
            available -= item.value.canonicalJson.length;
          }
        }
        if (emitCanonicalJson) {
          if (available < 1) return tooLarge();
          canonicalJson += "]";
        }
        return success({ canonicalJson, value: Object.freeze(copiedItems) });
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
    for (let keyIndex = 0; keyIndex < ownKeys.length; keyIndex += 1) {
      const key = ownKeys[keyIndex]!;
      if (typeof key === "symbol") {
        return unsupportedPayload(owner, path, "plain records must not contain symbol properties");
      }
    }
    if (structuralState !== undefined && ownKeys.length > structuralState.remainingValues) {
      return tooComplex();
    }
    if (emitCanonicalJson && remaining < 2) return tooLarge();

    const keys = ownKeys as string[];
    const quotedKeys: Record<string, string> = Object.create(null) as Record<string, string>;
    if (emitCanonicalJson) {
      const commaCharacters = keys.length > 0 ? keys.length - 1 : 0;
      const minimum = 2 + commaCharacters + keys.length * 4;
      if (minimum > remaining) return tooLarge();
      let extraKeyCharacters = remaining - minimum;
      for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
        const key = keys[keyIndex]!;
        const quoted = quoteJsonString(key, extraKeyCharacters + 2, true);
        if (quoted === undefined) return tooLarge();
        quotedKeys[key] = quoted.text;
        extraKeyCharacters -= quoted.length - 2;
      }
    }
    const sortedKeys = sortedStrings(keys);

    activeContainers.add(value);
    try {
      const copiedRecord: Record<string, GraphData> = {};
      let canonicalJson = emitCanonicalJson ? "{" : "";
      let available = emitCanonicalJson ? remaining - 1 : remaining;
      for (let index = 0; index < sortedKeys.length; index += 1) {
        const key = sortedKeys[index]!;
        if (emitCanonicalJson) {
          const prefix = `${index > 0 ? "," : ""}${quotedKeys[key]}:`;
          if (available - 1 < prefix.length) return tooLarge();
          canonicalJson += prefix;
          available -= prefix.length;
        }

        const pathToValue = payloadPath(path, key, emitCanonicalJson ? quotedKeys[key] : undefined);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
          return unsupportedPayload(
            owner,
            pathToValue,
            "record properties must be ordinary enumerable data values, not accessors",
          );
        }
        const child = copy(
          descriptor.value,
          pathToValue,
          emitCanonicalJson ? available - 1 : available,
          depth + 1,
        );
        if (!child.ok) return child;
        Object.defineProperty(copiedRecord, key, {
          configurable: true,
          enumerable: true,
          value: child.value.value,
          writable: true,
        });
        if (emitCanonicalJson) {
          canonicalJson += child.value.canonicalJson;
          available -= child.value.canonicalJson.length;
        }
      }
      if (emitCanonicalJson) {
        if (available < 1) return tooLarge();
        canonicalJson += "}";
      }
      return success({ canonicalJson, value: Object.freeze(copiedRecord) });
    } finally {
      activeContainers.delete(value);
    }
  };

  try {
    return copy(payload, rootPath, maximum, 1);
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

export function copyCanonicalGraphData(
  payload: unknown,
  owner: PayloadOwner,
  budget?: CanonicalGraphDataBudget,
  structuralBudget?: GraphDataStructuralBudget,
): Result<CanonicalGraphDataCopy> {
  return copyGraphData(payload, owner, true, budget, structuralBudget);
}

export function copyGraphPayload(
  payload: unknown,
  owner: PayloadOwner,
  structuralBudget?: GraphDataStructuralBudget,
): Result<GraphData> {
  const copied = copyGraphData(payload, owner, false, undefined, structuralBudget);
  return copied.ok ? success(copied.value.value) : copied;
}

export function copyGraphPayloadPair(
  first: unknown,
  second: unknown,
  owner: PayloadOwner,
  structuralBudget: GraphDataStructuralBudget,
): Result<readonly [GraphData, GraphData]> {
  const structuralState: GraphDataStructuralBudgetState = {
    budget: structuralBudget,
    remainingValues: structuralBudget.maximumValues,
  };
  const payloads = [first, second];
  const copied: [GraphData, GraphData] = [null, null];
  for (let index = 0; index < 2; index += 1) {
    const result = copyGraphData(
      payloads[index],
      owner,
      false,
      undefined,
      structuralBudget,
      structuralState,
      `$[${index}]`,
    );
    if (!result.ok) return result;
    copied[index] = result.value.value;
  }
  return success(Object.freeze(copied));
}
