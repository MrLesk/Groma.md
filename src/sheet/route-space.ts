/** Shared plane units and physical spacing for placement, ports and route lanes. */
export const ROUTE_UNIT = 24
export const ROUTE_CLEARANCE = ROUTE_UNIT / 2
export const ROUTE_SPACING = ROUTE_UNIT / 8
export const LANE_GAP = ROUTE_UNIT * 0.75

/** Middle-half ports each keep a stroke lane on either side for turns and clearance. */
export function portSideCells(connections: number): number {
  return 4 * Math.max(0, connections - 1) * ROUTE_SPACING / ROUTE_UNIT
}

/** Clearance, one turning lane per connection, and a free lane beyond the fan. */
export function routeReach(connections: number): number {
  return (ROUTE_CLEARANCE + (connections + 1) * ROUTE_SPACING) / ROUTE_UNIT
}

export function connectionCounts(relationships: readonly { source: string; target: string }[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const { source, target } of relationships) {
    counts.set(source, (counts.get(source) ?? 0) + 1)
    counts.set(target, (counts.get(target) ?? 0) + 1)
  }
  return counts
}
