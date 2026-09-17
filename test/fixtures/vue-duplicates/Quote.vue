<script lang="ts">
export default {
  methods: {
    quote(rows: { amount: number; rate: number }[]): number {
      let sum = 0
      for (const row of rows) {
        const value = row.amount * row.rate
        if (value > 25) {
          sum = sum + value
        }
      }
      return Math.round(sum * 100) / 100
    },
  },
}
</script>

<template><span>Quote</span></template>
