import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { listenForEmbeddedViews } from '../src/viewers/web/embedding.ts'

type Message = { source: unknown; data: unknown }

/** A window reduced to what the embedding contract touches; `parent` is itself when the map is opened directly. */
function page(embedded: boolean) {
  const posted: unknown[] = []
  const parent = { postMessage: (message: unknown) => { posted.push(message) } }
  let deliver: ((event: Message) => void) | undefined
  const self = {
    parent: undefined as unknown,
    addEventListener(_type: string, listener: (event: Message) => void) { deliver = listener },
  }
  self.parent = embedded ? parent : self
  return { window: self as unknown as Window, parent, posted, deliver: (event: Message) => deliver?.(event), listening: () => deliver !== undefined }
}

test.concurrent('an embedded map announces itself and opens the views its parent posts', () => {
  const embedded = page(true)
  const opened: string[] = []
  listenForEmbeddedViews(embedded.window, search => opened.push(search))

  assert.deepEqual(embedded.posted, [{ gromaReady: true }])
  embedded.deliver({ source: embedded.parent, data: { gromaView: '?component=orders&tab=how' } })
  assert.deepEqual(opened, ['?component=orders&tab=how'])
})

test.concurrent('an embedded map ignores other windows and messages that are not views', () => {
  const embedded = page(true)
  const opened: string[] = []
  listenForEmbeddedViews(embedded.window, search => opened.push(search))

  embedded.deliver({ source: {}, data: { gromaView: '?component=orders' } })
  embedded.deliver({ source: embedded.parent, data: { gromaView: 42 } })
  embedded.deliver({ source: embedded.parent, data: null })
  assert.deepEqual(opened, [])
})

test.concurrent('a map opened directly neither listens nor announces itself', () => {
  const direct = page(false)
  listenForEmbeddedViews(direct.window, () => assert.fail('a direct map must not open posted views'))

  assert.equal(direct.listening(), false)
  assert.deepEqual(direct.posted, [])
})
