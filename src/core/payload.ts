import { failure, type Result, success } from "./result.ts";

export type GraphDataScalar = boolean | null | number | string;

export interface GraphDataRecord {
  readonly [key: string]: GraphData;
}

export type GraphData = GraphDataScalar | GraphDataRecord | readonly GraphData[];

type PayloadOwner = "entity" | "query" | "relation";

function payloadPath(parent: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
    ? `${parent}.${key}`
    : `${parent}[${JSON.stringify(key)}]`;
}

function unsupportedPayload(owner: PayloadOwner, path: string, reason: string): Result<GraphData> {
  return failure({
    code: "unsupported-payload",
    message: `${owner} payload is not canonical graph data at ${path}: ${reason}`,
    details: { owner, path, reason },
  });
}

export function copyGraphPayload(payload: unknown, owner: PayloadOwner): Result<GraphData> {
  const activeContainers = new WeakSet<object>();

  const copy = (value: unknown, path: string): Result<GraphData> => {
    if (value === null || typeof value === "boolean" || typeof value === "string") {
      return success(value);
    }
    if (typeof value === "number") {
      return Number.isFinite(value)
        ? success(Object.is(value, -0) ? 0 : value)
        : unsupportedPayload(owner, path, "numbers must be finite");
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

      activeContainers.add(value);
      try {
        const copiedItems: GraphData[] = [];
        for (let index = 0; index < arrayLength; index += 1) {
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
          const item = copy(descriptor.value, itemPath);
          if (!item.ok) return item;
          copiedItems.push(item.value);
        }
        return success(Object.freeze(copiedItems));
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

    activeContainers.add(value);
    try {
      const copiedRecord: Record<string, GraphData> = {};
      const keys = (ownKeys as string[]).sort();
      for (const key of keys) {
        const pathToValue = payloadPath(path, key);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
          return unsupportedPayload(
            owner,
            pathToValue,
            "record properties must be ordinary enumerable data values, not accessors",
          );
        }
        const child = copy(descriptor.value, pathToValue);
        if (!child.ok) return child;
        Object.defineProperty(copiedRecord, key, {
          configurable: true,
          enumerable: true,
          value: child.value,
          writable: true,
        });
      }
      return success(Object.freeze(copiedRecord));
    } finally {
      activeContainers.delete(value);
    }
  };

  try {
    return copy(payload, "$");
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
