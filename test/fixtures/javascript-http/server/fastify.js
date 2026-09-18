const Fastify = require('fastify')

const app = Fastify({ logger: true })

app.route({ method: 'POST', url: '/submissions', handler: submit })
app.route({ method: ['GET', 'POST'], url: '/multi', handler: both })
app.get('/votes/:id', read)

// A method the source computes leaves the route unsupported, and a plugin the scan does not read
// may serve anything below its prefix.
app.route({ method: process.env.METHOD, url: '/unknown', handler: submit })
app.register(require('./plugins'), { prefix: '/plugins' })

function submit(request, reply) { reply.send({}) }
function both(request, reply) { reply.send({}) }
function read(request, reply) { reply.send([]) }
