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
</script>

<template><span>{{ upper.length + lower.length }}</span></template>
