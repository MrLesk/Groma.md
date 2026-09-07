export function total(items: number[]): number {
  return items.reduce((sum, item) => sum + item, 0)
}
