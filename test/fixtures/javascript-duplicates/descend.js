// The same walk under another name.

export function descend(value) {
  if (value <= 0) return 0
  return value + descend(value - 1)
}
