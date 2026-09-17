<script setup lang="ts">
function depth(level: number): number {
  if (level < 1) {
    return 0
  }
  return depth(level - 1) + 2
}
</script>

<template><span>{{ depth(3) }}</span></template>
