import {
  failure,
  success,
  type ComponentCandidateStructuralSignals,
  type Diagnostic,
  type Result,
} from "../core/index.ts";

export const OBSERVED_STRUCTURE_DERIVATION_V1 = "groma/observed-structure/v1" as const;

/**
 * Breadth of use that marks a component as shared. Two distinct containers
 * depending on the same component is the smallest observation that distinguishes
 * "used across the system" from "used by its own neighbourhood".
 */
export const OBSERVED_SHARED_REUSE_BREADTH = 2;

export interface ObservedContainmentEdge {
  readonly container: string;
  readonly contained: string;
}

export interface ObservedStructure {
  /** Depth below the containment root, zero for roots. */
  readonly depthOf: ReadonlyMap<string, number>;
  readonly parentOf: ReadonlyMap<string, string>;
}

function diagnostic(code: string, message: string): Diagnostic {
  return Object.freeze({ code, message });
}

/**
 * Resolves observed containment into a forest. Containment is the one structural
 * claim every scanner can make in any language, so this derivation never mentions
 * packages, directories, or modules. Ambiguity fails closed: a component claimed
 * by two containers, or a containment cycle, yields no structure at all rather
 * than a guessed hierarchy.
 */
export function resolveObservedStructure(
  edges: readonly ObservedContainmentEdge[],
): Result<ObservedStructure> {
  const parentOf = new Map<string, string>();
  for (const edge of edges) {
    if (edge.container === edge.contained) {
      return failure(
        diagnostic(
          "observed-containment-self-reference",
          "An observed component cannot contain itself",
        ),
      );
    }
    const existing = parentOf.get(edge.contained);
    if (existing !== undefined && existing !== edge.container) {
      return failure(
        diagnostic(
          "observed-containment-ambiguous",
          "An observed component is contained by more than one container",
        ),
      );
    }
    parentOf.set(edge.contained, edge.container);
  }

  const depthOf = new Map<string, number>();
  const depthFor = (identity: string): Result<number> => {
    const known = depthOf.get(identity);
    if (known !== undefined) return success(known);
    const chain: string[] = [];
    const seen = new Set<string>();
    let current = identity;
    let base = 0;
    for (;;) {
      if (seen.has(current)) {
        return failure(
          diagnostic("observed-containment-cycle", "Observed containment must remain acyclic"),
        );
      }
      seen.add(current);
      const resolved = depthOf.get(current);
      if (resolved !== undefined) {
        base = resolved;
        break;
      }
      const parent = parentOf.get(current);
      if (parent === undefined) {
        depthOf.set(current, 0);
        base = 0;
        break;
      }
      chain.push(current);
      current = parent;
    }
    for (const entry of chain.toReversed()) {
      base += 1;
      depthOf.set(entry, base);
    }
    return success(depthOf.get(identity) ?? 0);
  };

  for (const identity of new Set([...parentOf.keys(), ...parentOf.values()])) {
    const depth = depthFor(identity);
    if (!depth.ok) return depth;
  }
  return success(Object.freeze({ depthOf, parentOf }));
}

/**
 * Breadth of use is a coupling measurement, never a size measurement, so it
 * proposes the shared flag and never a scale.
 */
export function observedSharedFromSignals(
  signals: ComponentCandidateStructuralSignals | undefined,
): boolean | undefined {
  const breadth = signals?.reuseBreadth;
  if (breadth === undefined || !Number.isSafeInteger(breadth) || breadth < 0) return undefined;
  return breadth >= OBSERVED_SHARED_REUSE_BREADTH;
}
