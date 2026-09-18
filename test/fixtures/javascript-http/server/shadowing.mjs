import express from 'express'

// A parameter that shadows the import is not the framework.
export function plugin(express) {
  const app = express()
  app.get('/plugin', handle)
}

function handle(request, response) {
  response.end()
}
