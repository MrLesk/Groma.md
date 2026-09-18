export function pick(items: string[], index: number): string {
  const value = items[index + 1]
  if (value === undefined) return 'none'
  return value.toUpperCase()
}
