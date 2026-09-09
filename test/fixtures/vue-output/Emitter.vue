<script setup lang="ts">
// A UTF-16 position witness: 🎯
const emit = defineEmits<{ saved: [value: string] }>()
const finish = (value: string) => {
  emit('saved', value)
}
</script>
<template><button @click="finish('ready')">Save</button></template>
