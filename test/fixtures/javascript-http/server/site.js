const express = require('express')
const routes = require('./routes')

// Package middleware registers no route, while a router from another file, mounted without a path,
// may serve any path from its place on.
const site = express()
site.use(express.json())
site.use(routes)
site.get('/pages/:name', function page(request, response) { response.end() })
