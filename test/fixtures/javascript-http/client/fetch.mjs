import { API_URL } from './settings.mjs'

export async function loadTalks(id, method) {
  await fetch('/api/talks')
  await fetch('/dual/items')
  await fetch(`/talks/${id}`)
  await fetch(API_URL + '/votes/' + id)
  await fetch('https://speakers.example.com/talks')
  await fetch(buildUrl(id))
  await fetch(`/api/talks/${id}-${id}`)
  await fetch('/status', { method })
}

export async function loadFromBases(bases) {
  // A base a loop variable computes is not a configuration value.
  for (const base of bases) await fetch(base + '/rooms')
}

function buildUrl(id) {
  return `/talks/${id}/votes`
}
