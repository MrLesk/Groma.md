const express = require('express')

let app = express()
const cache = { get() {} }

// A destructuring assignment replaces the application.
;[app] = [cache]
app.get('/replaced', handle)

function handle(request, response) {
  response.end()
}
