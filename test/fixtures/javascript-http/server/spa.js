const express = require('express')

const app = express()
app.use(require('./shop'))
app.get('*', function spa(request, response) { response.sendFile('index.html') })
