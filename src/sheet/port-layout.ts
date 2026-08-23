import { LANES } from './grid.ts'

/** A footprint in lane units: x0..x1 and y0..y1 are its boundary lanes, inclusive. */
export interface LaneRect {
  x0: number
  y0: number
  x1: number
  y1: number
}

export type Side = 'x-' | 'x+' | 'y-' | 'y+'

export const SIDES: readonly Side[] = ['x-', 'x+', 'y-', 'y+']
/** Direction index a route takes when it leaves through each side, and the one it arrives with. */
export const OUTWARD: Record<Side, number> = { 'x+': 0, 'y+': 1, 'x-': 2, 'y-': 3 }
export const INWARD: Record<Side, number> = { 'x+': 2, 'y+': 3, 'x-': 0, 'y-': 1 }
/** A building's back sides, hidden under its roof. */
export const BACK: readonly Side[] = ['x-', 'y-']

/** Lanes between two ports on one side: ports sit on half-cell marks. */
const PORT_PITCH = 2

/** The sides of `rect` that face `other`: a side faces it when the other rect lies wholly beyond that side. */
export function facing(rect: LaneRect, other: LaneRect): Set<Side> {
  const sides = new Set<Side>()
  if (other.x1 <= rect.x0) sides.add('x-')
  if (other.x0 >= rect.x1) sides.add('x+')
  if (other.y1 <= rect.y0) sides.add('y-')
  if (other.y0 >= rect.y1) sides.add('y+')
  return sides
}

/** Free ports on one side, with their distance from its middle normalized by side length. */
export function ports(rect: LaneRect, side: Side, width: number, used: ReadonlySet<number>): { node: number; offset: number }[] {
  const alongY = side === 'x-' || side === 'x+'
  const [from, to] = alongY ? [rect.y0, rect.y1] : [rect.x0, rect.x1]
  const cells = (to - from) / LANES
  const fixed = side === 'x-' ? rect.x0 : side === 'x+' ? rect.x1 : side === 'y-' ? rect.y0 : rect.y1
  const result: { node: number; offset: number }[] = []
  for (let lane = from + PORT_PITCH; lane < to; lane += PORT_PITCH) {
    const node = alongY ? lane * width + fixed : fixed * width + lane
    if (!used.has(node)) result.push({ node, offset: Math.abs(lane - (from + to) / 2) / PORT_PITCH / cells })
  }
  return result
}

interface SeedEnd {
  key: string
  rect: LaneRect
  node: number
  policy: 'baseline' | 'prefer-centre' | 'centre-balanced'
}

export interface PortSeed {
  source: SeedEnd
  target: SeedEnd
}

export interface PortPair {
  source: number
  target: number
}

/** Concrete ports on the planned side first, optionally followed by the other sides. */
function portCandidates(seed: PortSeed['source'], baseline: number, width: number, otherSides = false): number[] {
  if (seed.policy === 'centre-balanced') return [baseline]
  const planned = sideOf(seed.rect, seed.node, width)
  const sides = otherSides ? [planned, ...SIDES.filter(side => side !== planned)] : [planned]
  const ordered = sides.flatMap(side => ports(seed.rect, side, width, new Set())
    .sort((a, b) => a.offset - b.offset || a.node - b.node)
    .map(({ node }) => node))
  return [baseline, ...ordered.filter(node => node !== baseline)]
}

/** Concrete pairs in target preference order, trying every source before relaxing that target. */
export function* portPairs(seed: PortSeed, pair: PortPair, width: number): Generator<PortPair> {
  const sources = portCandidates(seed.source, pair.source, width, true)
  const targets = portCandidates(seed.target, pair.target, width, true)
  for (const target of targets) for (const source of sources) yield { source, target }
}

export function sideOf(rect: LaneRect, node: number, width: number): Side {
  const x = node % width
  const y = (node - x) / width
  if (x === rect.x0) return 'x-'
  if (x === rect.x1) return 'x+'
  if (y === rect.y0) return 'y-'
  if (y === rect.y1) return 'y+'
  throw new Error(`Port ${node} is not on its endpoint`)
}

/** Centred and symmetric sets, nearest to the middle first. */
function centredPortSets(rect: LaneRect, side: Side, count: number, width: number): number[][] {
  const alongY = side === 'x-' || side === 'x+'
  const [from, to] = alongY ? [rect.y0, rect.y1] : [rect.x0, rect.x1]
  const fixed = side === 'x-' ? rect.x0 : side === 'x+' ? rect.x1 : side === 'y-' ? rect.y0 : rect.y1
  const middle = (from + to) / 2
  const pairs = Math.floor(count / 2)
  const furthest = (to - from) / (2 * PORT_PITCH) - 1
  const sets: number[][] = []
  const choose = (next: number, distances: number[]): void => {
    if (distances.length === pairs) {
      const steps = count % 2 === 1 ? [0] : []
      for (const distance of distances) steps.push(-distance, distance)
      sets.push(steps.map(step => {
        const lane = middle + step * PORT_PITCH
        return alongY ? lane * width + fixed : fixed * width + lane
      }).sort((a, b) => a - b))
      return
    }
    for (let distance = next; distance <= furthest; distance += 1) choose(distance + 1, [...distances, distance])
  }
  choose(1, [])
  return sets.sort((a, b) => {
    const span = (nodes: number[]): number => nodes[nodes.length - 1]! - nodes[0]!
    return span(a) - span(b)
  })
}

interface GroupEnd {
  index: number
  end: keyof PortPair
  policy: SeedEnd['policy']
}

/** Turns independently chosen sides into one centred or symmetric port layout per endpoint side. */
export function layoutPorts(seeds: readonly PortSeed[], width: number): PortPair[] {
  const result = seeds.map<PortPair>(seed => ({ source: seed.source.node, target: seed.target.node }))
  const groups = new Map<string, { rect: LaneRect; side: Side; ends: GroupEnd[] }>()
  seeds.forEach((seed, index) => {
    for (const end of ['source', 'target'] as const) {
      const item = seed[end]
      const side = sideOf(item.rect, item.node, width)
      const key = `${item.key}\0${side}`
      const group = groups.get(key) ?? { rect: item.rect, side, ends: [] }
      group.ends.push({ index, end, policy: item.policy })
      groups.set(key, group)
    }
  })
  for (const [key, { rect, side, ends }] of groups) {
    const exact = ends[0]!.policy === 'centre-balanced'
    const preferred = ends.length === 1 && ends[0]!.policy === 'prefer-centre'
    if (!exact && !preferred) continue
    const nodes = centredPortSets(rect, side, ends.length, width)[0]
    if (nodes === undefined) {
      if (exact) throw new Error(`No centred port layout for ${key}`)
      continue
    }
    ends.forEach(({ index, end }, endIndex) => { result[index]![end] = nodes[endIndex] })
  }
  return result
}
