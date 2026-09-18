const express = require('express')
const { Router } = require('express')

const app = express()
const orders = Router()
const loose = express.Router()
const hidden = Router()

orders.get('/:id', function readOrder(request, response) { response.json({}) })
app.use('/orders', orders)

// A router with no mount in this file serves nothing. One mounted under a computed prefix, and a
// regular expression route, may serve any path.
loose.get('/loose', function loosely(request, response) { response.end() })
hidden.get('/hidden', function hiddenly(request, response) { response.end() })
app.use(prefix(), hidden)
app.get(/\/legacy\/(\d+)/, function legacy(request, response) { response.end() })

function prefix() {
  return '/computed'
}

module.exports = app
