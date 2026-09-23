<script setup lang="ts">
const term = 'vue'

// Nuxt's standard page usage: the component's own setup code sends the request.
const { data } = useFetch('/api/talks')

function list() {
  return $fetch('/api/talks')
}

function create(talk: unknown) {
  return $fetch('/api/talks', { method: 'POST', body: talk })
}

function byMethod(method: string) {
  return $fetch('/api/talks', { method })
}

function one(id: string) {
  return useFetch(`/api/talks/${id}`)
}

function partial(id: string) {
  return $fetch(`/api/talks/${id}-latest`)
}

function search() {
  return $fetch('/api/talks?term=' + term)
}

function external() {
  return $fetch('https://api.example.com/talks')
}

function fromBase(base: string) {
  return $fetch(base + '/talks')
}

function plain() {
  return fetch('/health')
}

const resourceUrl = new URL('/api/talks', location.origin)
function urlObject() {
  return fetch(resourceUrl)
}
</script>

<template><button type="button" @click="list()">{{ data }}</button></template>
