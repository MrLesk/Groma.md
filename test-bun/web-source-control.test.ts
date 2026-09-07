import { expect, test } from 'bun:test'

import type { AnnotatedElement } from '../src/types.ts'
import { createSourceControl } from '../src/viewers/web/source/control.ts'

function component(): AnnotatedElement {
  return {
    representationId: 'orders',
    id: 'orders',
    kind: 'component',
    title: 'Orders',
    overview: '',
    parent: null,
    children: [],
    external: false,
    code: [{ scanner: 'typescript', file: 'src/orders.ts' }],
    origin: 'observed',
  }
}

function host(scrollTop: number) {
  return {
    scrollTop,
    getAnimations: () => [] as { finished: Promise<void> }[],
  }
}

test.concurrent('back from source restores How it is built scroll', async () => {
  const selected = component()
  const details = host(240)
  const source = createSourceControl({
    host: details as unknown as HTMLElement,
    element: () => selected,
    revision: () => undefined,
    readCode: async () => [],
    readSource: async () => ({ source: 'export function placeOrder() {}' }),
    repaint() {
      details.scrollTop = 0
    },
  })
  source.open('src/orders.ts', 1)
  await Promise.resolve()
  expect(details.scrollTop).toBe(0)
  source.back()
  expect(details.scrollTop).toBe(240)
  await Promise.resolve()
  expect(details.scrollTop).toBe(240)
})

test.concurrent('clearing source does not restore How it is built scroll', async () => {
  const selected = component()
  const details = host(240)
  const source = createSourceControl({
    host: details as unknown as HTMLElement,
    element: () => selected,
    revision: () => undefined,
    readCode: async () => [],
    readSource: async () => ({ source: 'export function placeOrder() {}' }),
    repaint() {
      details.scrollTop = 0
    },
  })
  source.open('src/orders.ts', 1)
  await Promise.resolve()
  source.clear()
  expect(details.scrollTop).toBe(0)
})
