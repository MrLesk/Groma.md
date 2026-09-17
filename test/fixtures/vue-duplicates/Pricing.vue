<script lang="ts">
export default {
  methods: {
    price(lines: { amount: number; rate: number }[]): number {
      let total = 0
      for (const line of lines) {
        const net = line.amount * line.rate
        if (net > 10) {
          total = total + net
        }
      }
      return Math.round(total * 100) / 100
    },
  },
}
</script>

<template><span>Pricing</span></template>
