<script lang="ts">
type Payload = { price: number }

export function total(entries: unknown[], limits: number[]): number {
  let sum = 0
  let count = 0
  for (const entry of entries) {
    if (typeof entry === 'object') {
      sum = (sum + (entry as Payload).price) * 2
    } else {
      sum = sum + limits[count]
    }
    count++
  }
  return sum
}

export class Tally {
  readonly size: number

  constructor(entries: number[]) {
    this.size = entries[0] + entries.length
  }
}
</script>

<template><span>Totals</span></template>
