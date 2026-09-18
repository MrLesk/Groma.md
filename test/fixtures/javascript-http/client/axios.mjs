import axios from 'axios'
import { API_URL } from './settings.mjs'

const files = axios.create({ baseURL: API_URL })
let replaced = axios.create({ baseURL: API_URL })
replaced = axios

export async function sendAll(body) {
  await axios.post('/submissions', body)
  await files.get('/files')
  await axios({ url: '/status', method: 'delete' })
  await axios.request({ url: '/missing' })
  // A reassignable instance states no base, and another object's `get` is not a client.
  await replaced.get('/replaced')
  await cache().get('/cached')
}

function cache() {
  return { get: async path => path }
}
