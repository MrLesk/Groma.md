const Koa = require('koa')
const Router = require('@koa/router')

const app = new Koa()
const rooms = new Router({ prefix: '/rooms' })
const details = new Router()
const loose = new Router()
const shifting = new Router()

rooms.get('/', list)
rooms.post('/', store)
rooms.get('room', '/named/:id', read)
rooms.get('/files/(.*)', list)
rooms.get('/files/(.*)/raw', list)
details.get('/:id', read)
rooms.use('/details', details.routes(), details.allowedMethods())
app.use(rooms.routes(), rooms.allowedMethods())

// A router this file never mounts, one whose prefix the source computes, and one whose name the file
// assigns again serve nothing known.
loose.get('/loose', list)
shifting.prefix(prefixFor())
shifting.get('/shifting', list)
app.use(shifting.routes())

let swapped = new Router({ prefix: '/swapped' })
swapped = rooms
swapped.get('/swapped', list)
app.use(swapped.routes())

function list(context) { context.body = [] }
function store(context) { context.status = 201 }
function read(context) { context.body = {} }
function prefixFor() { return '/computed' }
