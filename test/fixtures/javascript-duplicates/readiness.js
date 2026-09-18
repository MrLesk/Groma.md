// Selects the items a reviewer still has to look at.

export function checkReadiness(items, limit) {
  const ready = []
  for (const item of items) {
    if (item.count > limit) ready.push(item.name)
  }
  return ready.sort()
}
