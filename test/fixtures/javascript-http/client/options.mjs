import axios from 'axios'

const key = 'method'
const config = { url: '/api/talks' }
config.url = 'https://outside.example/api/talks'
const hidden = axios.create(readConfig())

function readConfig() {
  return { baseURL: '/api' }
}

export async function sendOptions() {
  // An option name the scan cannot read could be the method.
  await fetch('/api/computed', { [key]: 'POST' })
  // The last of two properties with one name is the value the object holds.
  await fetch('/api/twice', { method: 'GET', method: 'DELETE' })
  // A property the file assigns again no longer holds its literal.
  await fetch(config.url)
  // A request's own baseURL replaces the client's, and a host is never path text.
  await axios.get('/api/talks', { baseURL: 'https://outside.example' })
  // An instance a call configures has an unknown base.
  await hidden.get('/talks')
}
