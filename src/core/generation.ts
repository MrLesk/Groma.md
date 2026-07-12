import { failure, type Result, success } from "./result.ts";

declare const graphGenerationBrand: unique symbol;

export type GraphGeneration = number & { readonly [graphGenerationBrand]: true };

export function parseGraphGeneration(value: unknown): Result<GraphGeneration> {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? success((Object.is(value, -0) ? 0 : value) as GraphGeneration)
    : failure({
        code: "invalid-graph-generation",
        message: "Graph generation must be a nonnegative safe integer",
        details: { receivedType: typeof value },
      });
}

export function nextGraphGeneration(current: GraphGeneration): Result<GraphGeneration> {
  const parsed = parseGraphGeneration(current);
  if (!parsed.ok) return parsed;
  return parsed.value < Number.MAX_SAFE_INTEGER
    ? success((parsed.value + 1) as GraphGeneration)
    : failure({
        code: "graph-generation-overflow",
        message: "Graph generation cannot advance beyond the largest safe integer",
        details: { generation: parsed.value },
      });
}
