const Koa = require('koa')
const api = require('./api')

// The routes of a router from another file may be any path.
const app = new Koa()
app.use(api.routes())
