import { Hono } from 'hono'

const api = new Hono()
const app = new Hono()

// The files that import the application are not scanned with it, and run after all of it, so they may
// add any route after its own.
export default app

api.get('/talks', context => context.json([]))
app.route('/api', api)

// Hono's `route` copies the routes its child has when it runs: a later route is not under it, and one
// registered at a time the scan does not know may be.
const late = new Hono()
const lazy = new Hono()
app.route('/late', late)
late.get('/talks', context => context.json([]))
app.route('/lazy', lazy)

export function addLazy() {
  lazy.get('/items', context => context.json([]))
}
