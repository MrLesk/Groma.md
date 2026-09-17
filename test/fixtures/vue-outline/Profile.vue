<script lang="ts">
function initials(name: string): string {
  return name.slice(0, 1)
}

export class Members {
  constructor(private readonly names: string[]) {}

  initials(): string[] {
    return this.names.map(initials)
  }

  protected first(): string | undefined {
    return this.names[0]
  }
}
</script>

<script setup lang="ts">
import { ref } from 'vue'
import { greeting } from './greeting'

const name = ref('Ada')

function save(): string {
  return greeting(name.value)
}
</script>

<template><button type="button" @click="save()">Save</button></template>
