import express from 'express'
import { requireAuth } from './auth.mjs'

const app = express()

// Middleware registers no route, and a static mount blocks its path.
app.use(express.json())
app.use('/static', express.static('public'))

app.get('/talks/:id', (request, response) => response.json({ id: request.params.id }))
app.post('/talks', (request, response) => response.status(201).end())
app.all('/health', (request, response) => response.end())

// A partly computed route and a catch-all that is not last block what they may serve.
app.get(`/reports/${kindOf('talks')}`, (request, response) => response.end())
app.get('/downloads/*/raw', (request, response) => response.end())

function kindOf(name) {
  return `${name}-all`
}

// A handler next to a recognized router is middleware, wherever it comes from.
const admin = express.Router()
admin.get('/users', (request, response) => response.json([]))
app.use('/admin', requireAuth, admin)
