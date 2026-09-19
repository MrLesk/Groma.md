import type { ScanHttpEndpoint } from '@groma/scanner'

/*
 * The registration order of routers that take the first registered match, numbered without a compiler
 * for the shared router reader in ./http-routes.ts and the TypeScript scanner's NestJS controllers.
 */

/** Where a registrar's routes join an application, and how far their registration order is known. */
export interface Placement {
  /** The path the registrar's routes start with. */
  prefix: string
  /** The application: the file that creates it, and the variable that holds it where the scan names one. */
  application: string
  /** Registration indices from the application down to the registrar, as far as the source proves them. */
  rank: readonly number[]
  /** False once a level's order is unknown, so nothing below it adds an index. */
  known: boolean
  /** Whether the application takes the first registered match, and so reports its order. */
  ordered: boolean
  /** False when the routes may not be there, such as routes a copy may have missed, which then only block. */
  certain: boolean
}

/**
 * The placement below `prefix` of a registration made at `indices` of its registrar: its index, then its
 * place among the registrars one call mounts. The rank grows only while every index is known.
 */
export function below(placement: Placement, prefix: string, ...indices: readonly (number | undefined)[]): Placement {
  const known = placement.known && indices.every(index => index !== undefined)
  return {
    ...placement,
    prefix: `${placement.prefix}/${prefix}`,
    rank: known ? [...placement.rank, ...indices as number[]] : placement.rank,
    known,
  }
}

/** An endpoint with the placement of its registration, before its position is numbered. */
export interface Placed {
  endpoint: ScanHttpEndpoint
  placement: Placement
}

/** Ranks compare index by index; once cut, no rank begins another. */
function compare(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    if (left[index] !== right[index]) return left[index]! - right[index]!
  }
  return 0
}

function begins(rank: readonly number[], start: readonly number[]): boolean {
  return start.every((index, at) => rank[at] === index)
}

/**
 * A rank stops where an order is unknown, so it equals every rank it begins. Each rank is cut to the
 * shortest rank of its application it begins with, which leaves ranks that compare consistently.
 */
function cut(rank: readonly number[], ranks: readonly (readonly number[])[]): readonly number[] {
  return ranks.reduce((shortest, other) => other.length < shortest.length && begins(rank, other) ? other : shortest, rank)
}

/**
 * The endpoints with their order: each application numbers its registrations, equal ranks share a
 * position, and an application that prefers the most specific route states none.
 */
export function withOrder(placed: readonly Placed[]): ScanHttpEndpoint[] {
  const ranks = new Map<string, (readonly number[])[]>()
  for (const { placement } of placed) {
    if (!placement.ordered) continue
    const list = ranks.get(placement.application) ?? []
    list.push(placement.rank)
    ranks.set(placement.application, list)
  }
  const positions = new Map([...ranks].map(([application, list]) => {
    const distinct = new Map(list.map(rank => cut(rank, list)).map(rank => [rank.join('.'), rank]))
    return [application, [...distinct.values()].sort(compare).map(rank => rank.join('.'))]
  }))
  return placed.map(({ endpoint, placement }) => {
    const list = ranks.get(placement.application)
    if (!placement.ordered || list === undefined) return endpoint
    const position = positions.get(placement.application)!.indexOf(cut(placement.rank, list).join('.'))
    return { ...endpoint, order: { application: placement.application, position } }
  })
}
