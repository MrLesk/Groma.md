import { parseEntityId, type EntityId } from "./identity.ts";
import { failure, type Result, success } from "./result.ts";

export interface EntityAliasInput {
  readonly source: string;
  readonly target: string;
}

export interface EntityAlias {
  readonly source: EntityId;
  readonly target: EntityId;
}

export interface EntityAliasResolution {
  readonly chain: readonly EntityId[];
  readonly requested: EntityId;
  readonly resolved: EntityId;
}

export interface EntityAliasResolver {
  readonly records: readonly EntityAlias[];
  has(source: string): boolean;
  resolve(id: string): Result<EntityAliasResolution>;
}

const absoluteMaximumAliases = 1_000_000;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Builds one deterministic alias view against the final set of live identities.
 * Every accepted chain is guaranteed to terminate at exactly one live identity.
 */
export function createEntityAliasResolver(
  aliases: readonly EntityAliasInput[],
  liveIdentities: ReadonlySet<EntityId>,
  maximumAliases = 100_000,
): Result<EntityAliasResolver> {
  if (
    !Number.isSafeInteger(maximumAliases) ||
    maximumAliases <= 0 ||
    maximumAliases > absoluteMaximumAliases
  ) {
    throw new RangeError(
      `maximumAliases must be a positive safe integer no greater than ${absoluteMaximumAliases}`,
    );
  }
  if (!Array.isArray(aliases) || aliases.length > maximumAliases) {
    return failure({
      code: "alias-count-exceeded",
      message: "Component aliases exceed the configured item count",
      details: { maximum: maximumAliases },
    });
  }

  const live = new Set(liveIdentities);

  const bySource = new Map<EntityId, EntityId>();
  for (let index = 0; index < aliases.length; index += 1) {
    const input = aliases[index];
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return failure({
        code: "invalid-component-alias",
        message: "A component alias must contain one obsolete source and one target identity",
        details: { index },
      });
    }
    const source = parseEntityId(input.source);
    const target = parseEntityId(input.target);
    if (!source.ok) return source;
    if (!target.ok) return target;
    if (source.value === target.value) {
      return failure({
        code: "self-component-alias",
        message: "A component identity cannot supersede itself",
        details: { id: source.value },
      });
    }
    if (live.has(source.value)) {
      return failure({
        code: "ambiguous-component-supersession",
        message: "An alias source cannot also identify a live component",
        details: { id: source.value },
      });
    }
    if (bySource.has(source.value)) {
      return failure({
        code: "ambiguous-component-supersession",
        message: "An obsolete component identity can have only one superseding target",
        details: { id: source.value },
      });
    }
    bySource.set(source.value, target.value);
  }

  const terminal = new Map<EntityId, EntityId>();
  for (const start of Array.from(bySource.keys()).sort(compareText)) {
    if (terminal.has(start)) continue;
    const trail: EntityId[] = [];
    const positions = new Map<EntityId, number>();
    let current = start;
    while (!live.has(current)) {
      const known = terminal.get(current);
      if (known !== undefined) {
        current = known;
        break;
      }
      const priorPosition = positions.get(current);
      if (priorPosition !== undefined) {
        let representative = current;
        for (let index = priorPosition; index < trail.length; index += 1) {
          if (trail[index]! < representative) representative = trail[index]!;
        }
        return failure({
          code: "component-alias-cycle",
          message: "Component alias chains must be acyclic",
          details: { id: representative },
        });
      }
      positions.set(current, trail.length);
      trail.push(current);
      const next = bySource.get(current);
      if (next === undefined) {
        return failure({
          code: "missing-component-alias-target",
          message: "A component alias chain must end at one live component",
          details: { id: start, missing: current },
        });
      }
      current = next;
    }
    for (let index = trail.length - 1; index >= 0; index -= 1) {
      terminal.set(trail[index]!, current);
    }
  }

  const records = Object.freeze(
    Array.from(bySource, ([source, target]) => Object.freeze({ source, target })).sort(
      (left, right) => compareText(left.source, right.source),
    ),
  );
  const resolver: EntityAliasResolver = Object.freeze({
    records,
    has: (value: string) => {
      const parsed = parseEntityId(value);
      return parsed.ok && bySource.has(parsed.value);
    },
    resolve: (value: string) => {
      const requested = parseEntityId(value);
      if (!requested.ok) return requested;
      if (live.has(requested.value)) {
        return success(
          Object.freeze({
            chain: Object.freeze([]),
            requested: requested.value,
            resolved: requested.value,
          }),
        );
      }
      const resolved = terminal.get(requested.value);
      if (resolved === undefined) {
        return failure({
          code: "unknown-entity",
          message: "No entity or component alias exists for the exact stable identity",
          details: { id: requested.value },
        });
      }
      const chain: EntityId[] = [];
      let current = requested.value;
      while (current !== resolved) {
        const next = bySource.get(current)!;
        chain.push(next);
        current = next;
      }
      return success(
        Object.freeze({
          chain: Object.freeze(chain),
          requested: requested.value,
          resolved,
        }),
      );
    },
  });
  return success(resolver);
}
