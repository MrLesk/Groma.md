import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { renderPage } from '../src/viewers/web/page.ts'
import type { WebBootPayload } from '../src/viewers/web/payload.ts'

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

test.concurrent('an embedding page reserves room for its own frame with inset', () => {
  assert.equal(body('http://localhost:4747/?inset=32'), '<body data-delivery="live" style="--chrome-inset:32px">')
})

test.concurrent('the page keeps its usual layout without a usable inset', () => {
  for (const url of [undefined, 'http://localhost:4747/', 'http://localhost:4747/?inset=0', 'http://localhost:4747/?inset=-8', 'http://localhost:4747/?inset=1.5', 'http://localhost:4747/?inset=wide']) {
    assert.equal(body(url), '<body data-delivery="live">')
  }
})
