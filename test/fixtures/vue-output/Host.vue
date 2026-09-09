<script setup lang="ts">
import Emitter from './Emitter.vue'
import { receive } from './receiver'
const onSaved = (value: string) => { receive(value) }
</script>
<template>
  <Emitter @saved="onSaved" />
  <Emitter @saved="receive" />
</template>
