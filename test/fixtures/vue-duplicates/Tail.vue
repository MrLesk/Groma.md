<script setup lang="ts">
function tail(values: string[]): string {
  const part = values.slice(1, 3)
  return part.join(',') + values[1]
}
</script>

<template><span>{{ tail([]) }}</span></template>
