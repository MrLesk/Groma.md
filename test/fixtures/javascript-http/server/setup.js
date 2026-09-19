const express = require('express')

// Mounts inside a function run in an order the scan does not know, so every router they list shares
// one position, however many routers each mount lists.
const app = express()
const first = express.Router()
const second = express.Router()
const third = express.Router()
const fourth = express.Router()
first.get('/first', function one(request, response) { response.end() })
second.get('/second', function two(request, response) { response.end() })
third.get('/third', function three(request, response) { response.end() })
fourth.get('/fourth', function four(request, response) { response.end() })

function mountAll() {
  app.use('/left', first, second)
  app.use('/right', third, fourth)
}

mountAll()
