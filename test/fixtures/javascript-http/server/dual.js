const express = require('express')

// Two applications of one file keep their own order, so a router `b` cannot follow blocks only `b`.
const a = express()
const b = express()
a.get('/dual/items', function dualItems(request, response) { response.json([]) })
b.use(require('./legacy'))
