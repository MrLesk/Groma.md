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

function list() { return new Response('[]') }
function store() { return new Response('{}') }
function ready() { return new Response('ok') }
function fallbacks() { return { GET: ready } }
