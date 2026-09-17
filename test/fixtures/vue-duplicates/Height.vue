<script setup lang="ts">
function height(level: number): number {
  if (level < 1) {
    return 0
  }
  return height(level - 1) + 2
}
</script>

<template><span>{{ height(3) }}</span></template>
