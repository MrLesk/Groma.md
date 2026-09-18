import express from 'express'

// An exported declaration hands the application to the files that import it, after all of its routes.
export const app = express()

app.get('/exported/items', (request, response) => response.end())
