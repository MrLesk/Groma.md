<script setup lang="ts">
const names = ['first', 'second']

const upper = names.map(name => {
  const trimmed = name.trim()
  if (trimmed.length > 2) {
    return trimmed.toUpperCase()
  }
  return trimmed
})

const lower = names.map(name => {
  const trimmed = name.trim()
  if (trimmed.length > 2) {
    return trimmed.toUpperCase()
  }
  return trimmed
})

declare function register(options: { setup(): number }): void

register(({
  setup() {
    const total = names.length * 2
    return total + names.length + 10
  },
}))
register({
  setup() {
    const total = names.length * 2
    return total + names.length + 10
  },
} as { setup(): number })
register({
  setup() {
    const total = names.length * 2
    return total + names.length + 10
  },
} satisfies { setup(): number })
register({
  setup() {
    const total = names.length * 2
    return total + names.length + 10
  },
}!)
</script>

<template><span>{{ upper.length + lower.length }}</span></template>
