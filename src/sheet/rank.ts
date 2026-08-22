/**
 * Flow ranks among the children of one surface: the children the outside
 * feeds (a person, or anything beyond the surface) stand first, and every
 * other child stands east of whatever feeds it, by the longest chain. Back
 * edges found by a depth-first walk from the entries in hierarchy order, then
 * from the children nothing feeds, then from whatever is left, are dropped
 * first, so in a cycle the child the flow reaches first ranks lower. Edges
 * into an entry never move it. Children no relationship touches are absent.
 */
export function flowRanks(
  order: readonly string[],
  entries: ReadonlySet<string>,
  edges: ReadonlyMap<string, readonly string[]>,
): Map<string, number> {
  const fed = new Set([...edges.values()].flat())
  const touched = (key: string): boolean => entries.has(key) || fed.has(key) || (edges.get(key)?.length ?? 0) > 0
  const starts = [
    ...order.filter(key => entries.has(key)),
    ...order.filter(key => touched(key) && !entries.has(key) && !fed.has(key)),
    ...order.filter(touched),
  ]
  const state = new Map<string, 'open' | 'done'>()
  const kept = new Map<string, string[]>()
  const finished: string[] = []
  const visit = (key: string): void => {
    state.set(key, 'open')
    for (const next of edges.get(key) ?? []) {
      if (entries.has(next) || state.get(next) === 'open') continue
      kept.set(key, [...(kept.get(key) ?? []), next])
      if (!state.has(next)) visit(next)
    }
    state.set(key, 'done')
    finished.push(key)
  }
  for (const start of starts) if (!state.has(start)) visit(start)

  const rank = new Map<string, number>()
  for (const key of finished.reverse()) {
    const own = rank.get(key) ?? 0
    rank.set(key, own)
    for (const next of kept.get(key) ?? []) rank.set(next, Math.max(rank.get(next) ?? 0, own + 1))
  }
  return rank
}
