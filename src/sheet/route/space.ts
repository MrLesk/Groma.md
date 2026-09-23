/** Shared plane units and physical spacing for placement, ports and route lanes. */
export const ROUTE_UNIT = 24
export const ROUTE_CLEARANCE = ROUTE_UNIT / 2
export const ROUTE_SPACING = ROUTE_UNIT / 8
/** Routes sharing a channel spread this far apart where it has room; ROUTE_SPACING is the least they keep. */
export const BUNDLE_SPACING = ROUTE_UNIT / 3
export const LANE_GAP = ROUTE_UNIT * 0.75

/** Ports sit on the middle half of a wall: from a quarter to three quarters of its length. */
export const PORT_SPAN: readonly [number, number] = [0.25, 0.75]

/** The stretch from `low` to `high` of a wall where its ports sit. */
export function portStretch(low: number, high: number): [number, number] {
  const length = high - low
  return [low + length * PORT_SPAN[0], high - length * (1 - PORT_SPAN[1])]
}

/** Cells of wall whose middle half holds `connections` ports, each keeping a stroke lane on either side for turns and clearance. */
export function portSideCells(connections: number): number {
  return 2 * Math.max(0, connections - 1) * ROUTE_SPACING / (PORT_SPAN[1] - PORT_SPAN[0]) / ROUTE_UNIT
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
