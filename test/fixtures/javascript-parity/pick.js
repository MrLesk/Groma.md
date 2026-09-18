export function pick(items, index) {
  const value = items[index + 1]
  if (value === undefined) return 'none'
  return value.toUpperCase()
}
