import { Hono } from 'hono'

const api = new Hono()
const app = new Hono()

api.get('/talks', context => context.json([]))
app.route('/api', api)
