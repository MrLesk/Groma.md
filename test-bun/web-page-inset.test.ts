import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { renderPage } from '../src/viewers/web/page.ts'
import type { WebBootPayload } from '../src/viewers/web/payload.ts'
import { readView, writeView } from '../src/viewers/web/url.ts'

const payload = {
  project: { title: 'Shop' },
  world: { elements: [], relationships: [], flows: [] },
  work: { items: [] },
  pins: [],
  revisions: [],
  revision: null,
  delivery: { kind: 'live' },
} as unknown as WebBootPayload

const body = (url?: string) => renderPage(payload, url === undefined ? undefined : new URL(url)).match(/<body[^>]*>/)![0]

test.concurrent('an embedding page keeps its inset when a synchronized view is reloaded', () => {
  const url = new URL('http://localhost:4747/?inset=32')
  const initialBody = body(url.href)
  assert.equal(initialBody, '<body data-delivery="live" style="--chrome-inset:32px">')
  const view = readView(url, payload.world, [])
  url.search = writeView({ ...view, theme: 'dark', hudVisible: false }, payload.world, [], url.pathname)
  assert.equal(url.searchParams.get('inset'), '32')
  assert.equal(body(url.href), initialBody)
})

test.concurrent('the page keeps its usual layout without a usable inset', () => {
  for (const url of [undefined, 'http://localhost:4747/', 'http://localhost:4747/?inset=0', 'http://localhost:4747/?inset=-8', 'http://localhost:4747/?inset=1.5', 'http://localhost:4747/?inset=wide']) {
    assert.equal(body(url), '<body data-delivery="live">')
    const reloaded = new URL(url ?? 'http://localhost:4747/')
    reloaded.search = writeView(readView(reloaded, payload.world, []), payload.world, [], reloaded.pathname)
    assert.equal(reloaded.searchParams.has('inset'), false)
    assert.equal(body(reloaded.href), '<body data-delivery="live">')
  }
})
