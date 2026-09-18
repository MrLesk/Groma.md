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

// A router this file never mounts serves nothing, one whose prefix the source computes blocks where it
// is mounted, and one handed to a name the file assigns again blocks its own paths from there on.
loose.get('/loose', list)
shifting.prefix(prefixFor())
shifting.get('/shifting', list)
rooms.use('/shifting', shifting.routes())

let swapped = new Router({ prefix: '/swapped' })
swapped = rooms
swapped.get('/swapped', list)

// `del` is `delete`, and a redirect answers every method at its source.
rooms.del('/:id', store)
rooms.redirect('/old', '/rooms')
// A redirect from a route name answers at a path the scan cannot read.
rooms.redirect('home', '/rooms')

// A router's `use` copies the routes its child has when it runs, so a later one is not under it.
const later = new Router()
rooms.use('/later', later.routes())
later.get('/', list)

function list(context) { context.body = [] }
function store(context) { context.status = 201 }
function read(context) { context.body = {} }
function prefixFor() { return '/computed' }
