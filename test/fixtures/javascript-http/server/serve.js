const { handlers } = require('./handlers.js')

const spread = { ...fallbacks() }

Bun.serve({
  port: 3000,
  routes: {
    '/files': { GET: list, POST: store },
    '/status': ready,
    // A spread can replace any handler, and a key that is not a method names none.
    '/spread': spread,
    '/mixed': { GET: list, middleware: ready },
  },
})

// Only a value the scan proves to be a function serves every method: an imported object or a
// parameter could hold handlers for some methods only.
Bun.serve({ routes: { '/imported': handlers } })

function boot(routes) {
  Bun.serve({ routes: { '/booted': routes } })
}

function list() { return new Response('[]') }
function store() { return new Response('{}') }
function ready() { return new Response('ok') }
function fallbacks() { return { GET: ready } }
