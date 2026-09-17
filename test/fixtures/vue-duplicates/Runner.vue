<script setup lang="ts">
function run(values: string[]): string[] {
  const kept: string[] = []
  for (const value of values) {
    if (value.length > 2) {
      kept.push(value.trim())
    }
  }
  return kept
}
</script>

<template><button type="button" @click="run([])">Run</button></template>
