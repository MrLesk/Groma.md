type Payload = { price: number }

export function total(entries: unknown[]): number {
  let sum = 0
  for (const entry of entries) {
    sum = sum + (entry as Payload).price * 2
  }
  return sum
}
