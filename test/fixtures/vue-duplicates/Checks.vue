<script setup lang="ts">
function first(): number {
  return 1 + 2
}

function second(): number {
  return 1 + 2
}
</script>

<template><span>{{ first() + second() }}</span></template>
