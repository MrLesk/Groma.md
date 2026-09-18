const Fastify = require('fastify')

const app = Fastify({ logger: true })

app.route({ method: 'POST', url: '/submissions', handler: submit })
app.route({ method: ['GET', 'POST'], url: '/multi', handler: both })
app.get('/votes/:id', read)

// A method the source computes leaves the route unsupported.
app.route({ method: process.env.METHOD, url: '/unknown', handler: submit })

function submit(request, reply) { reply.send({}) }
function both(request, reply) { reply.send({}) }
function read(request, reply) { reply.send([]) }
