<script setup lang="ts">
function head(values: string[]): string {
  const part = values.slice(0, 2)
  return part.join(',') + values[0]
}
</script>

<template><span>{{ head([]) }}</span></template>
