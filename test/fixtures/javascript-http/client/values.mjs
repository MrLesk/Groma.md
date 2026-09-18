export const shared = { talks: '/api/talks' }
const local = { talks: '/api/talks' }
let base = '/api'
let moved = '/api'
moved = 'https://speakers.example.com'

export async function loadValues() {
  await fetch(shared.talks)
  await fetch(local.talks)
  await fetch(base + '/talks')
  await fetch(moved + '/talks')
}
