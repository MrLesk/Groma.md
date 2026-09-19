const express = require('express')
const { requireAuth } = require('./auth')

// A handler before a router, from the application's own module or a package, is middleware, so the
// call states no path.
const app = express()
const api = express.Router()
const open = express.Router()
api.get('/guarded/items', function guardedItems(request, response) { response.json([]) })
open.get('/open/items', function openItems(request, response) { response.json([]) })
app.use(requireAuth, api)
app.use(express.json(), open)
