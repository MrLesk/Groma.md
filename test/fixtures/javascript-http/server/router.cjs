const express = require('express')
const { Router } = require('express')

const app = express()
const orders = Router()
const loose = express.Router()
const hidden = Router()

orders.get('/:id', function readOrder(request, response) { response.json({}) })
app.use('/orders', orders)

// A router with no mount in this file, and one mounted under a computed prefix, serve nothing known.
loose.get('/loose', function loosely(request, response) { response.end() })
hidden.get('/hidden', function hiddenly(request, response) { response.end() })
app.use(prefix(), hidden)

function prefix() {
  return '/computed'
}
