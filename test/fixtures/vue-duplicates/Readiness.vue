<script setup lang="ts">
function ready(items: string[]): string[] {
  const done: string[] = []
  for (const item of items) {
    if (item.length > 2) {
      done.push(item.trim())
    }
  }
  return done
}
</script>

<template><button type="button" @click="ready([])">Ready</button></template>
