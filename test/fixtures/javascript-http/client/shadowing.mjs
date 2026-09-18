import axios from 'axios'
import fetch from 'node-fetch'

const base = '/api'

// A parameter, a local function or constant, and a loop binding that shadow an import or an outer
// constant are not it.
export function readWith(axios) {
  return axios.get('/shadowed')
}

export function readLocal() {
  const axios = { get: async path => path }
  return axios.get('/shadowed')
}

export function readNested() {
  function fetch(path) { return path }
  return fetch('/shadowed')
}

export async function readBases(bases) {
  for (const base of bases) await fetch(base + '/talks')
}
