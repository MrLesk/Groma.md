import express from 'express'

const app = express()

// Middleware and a static mount register no route.
app.use(express.json())
app.use('/static', express.static('public'))

app.get('/talks/:id', (request, response) => response.json({ id: request.params.id }))
app.post('/talks', (request, response) => response.status(201).end())
app.all('/health', (request, response) => response.end())

// A computed route, a regular expression and a catch-all that is not last state no path.
app.get(routeFor('talks'), (request, response) => response.end())
app.get(/\/legacy\/(\d+)/, (request, response) => response.end())
app.get('/files/*/raw', (request, response) => response.end())

function routeFor(name) {
  return `/${name}/all`
}
