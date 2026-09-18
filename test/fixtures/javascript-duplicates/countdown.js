// Recursive walks whose only difference is the name each body calls.

export function countDown(value) {
  if (value <= 0) return 0
  return value + countDown(value - 1)
}
