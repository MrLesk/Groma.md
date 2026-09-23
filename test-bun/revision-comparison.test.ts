import { expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { compareArchitecture, type SourceTexts } from '../src/history/comparison.ts'
import { sheetScene } from '../src/sheet/scene.ts'
import type { AnnotatedArchitectureModel } from '../src/types.ts'
import { readView, writeView } from '../src/viewers/web/url.ts'
import { box, uses, worldOf } from './helpers.ts'

async function fixture(): Promise<{ before: AnnotatedArchitectureModel; after: AnnotatedArchitectureModel; oldSources: SourceTexts; newSources: SourceTexts }> {
  return JSON.parse(await readFile(new URL('../test/fixtures/revision-comparison.json', import.meta.url), 'utf8'))
}

test.concurrent('comparison retains removed context, matches stable IDs, and keeps relationship changes independent', async () => {
  const { before, after, oldSources, newSources } = await fixture()
  const inputs = JSON.stringify([before, after])
  const compared = compareArchitecture(before, after, oldSources, newSources)
  expect(Object.fromEntries(Object.entries(compared.components).map(([id, item]) => [id, item.status]))).toEqual({
    checkout: 'modified', payment: 'unchanged', 'receipt-sender': 'removed', 'receipt-worker': 'added',
  })
  expect(compared.components['receipt-sender']!.files).toMatchObject([{ file: 'src/receipt.ts', status: 'unchanged', additions: 0, deletions: 0 }])
  expect(compared.components.checkout!.files).toMatchObject([{ additions: 1, deletions: 1 }])
  expect(compared.components['receipt-worker']!.files).toMatchObject([{ status: 'added', additions: 1, deletions: 0 }])
  expect(compared.relationships).toEqual({ 'relationship:9': 'modified', 'relationship:0': 'added', 'removed:relationship:1': 'removed' })
  expect(compared.world.elements.find(item => item.id === 'mail')?.children).toEqual(['receipt-sender'])
  expect(compared.world.elements.find(item => item.id === 'shop')?.children).toEqual(['api', 'mail'])
  expect(compared.components.shop).toBeUndefined()
  expect(JSON.stringify([before, after])).toBe(inputs)
})

test.concurrent('comparison source links retain former ownership without exposing it in the individual destination', async () => {
  const { before, after, oldSources, newSources } = await fixture()
  after.elements.find(item => item.id === 'checkout')!.code = []
  const compared = compareArchitecture(before, after, oldSources, newSources)
  const comparison = { from: null, components: compared.components, relationships: compared.relationships }
  const url = new URL('https://example.test/?component=checkout&file=src/checkout.ts')
  const state = readView(url, compared.world, [], [], 'auto', comparison)
  expect(state.file).toBe('src/checkout.ts')
  expect(state.tab).toBe('how')
  const shared = new URL(writeView(state, compared.world, [], '/', comparison), url)
  expect(shared.searchParams.get('file')).toBe('src/checkout.ts')
  expect(readView(shared, after, []).file).toBeUndefined()
})

test.concurrent('source-only and own-content changes modify only their owner; flows and layout measures do not', async () => {
  const { before, oldSources } = await fixture()
  const next = structuredClone(before)
  next.elements.find(item => item.id === 'checkout')!.title = 'Checkout service'
  next.elements.find(item => item.id === 'checkout')!.parent = 'mail'
  const payment = next.elements.find(item => item.id === 'payment')!
  payment.codeLines = 999
  payment.code[0]!.dependencies = 15
  next.flows = [{ id: 'purchase', title: 'Buy', overview: '', sourceFilename: 'flow.md', steps: [] }]
  const comparison = compareArchitecture(before, next, oldSources, { ...oldSources, 'src/receipt.ts': 'new implementation' })
  expect(comparison.components.checkout!.status).toBe('modified')
  expect(comparison.components.payment!.status).toBe('unchanged')
  expect(comparison.components['receipt-sender']!.status).toBe('modified')
  expect(comparison.world.flows).toBe(next.flows)
  expect(Object.values(comparison.components).some(item => item.status === 'added' || item.status === 'removed')).toBe(false)
})

test.concurrent('an id that changes kind keeps both elements, so both comparison directions place everything', () => {
  // `export` is a component in the older world and a container holding revision-control in the newer one.
  const unit = { x: 0, y: 0, width: 1, height: 1 }
  const older = worldOf([
    box('shop', 'system', unit), box('web', 'container', unit, { parent: 'observed:shop' }),
    box('export', 'component', unit, { parent: 'observed:web' }), box('developer', 'actor', unit),
  ], [uses('uses-export', 'developer', 'export')])
  const newer = worldOf([
    box('shop', 'system', unit), box('export', 'container', unit, { parent: 'observed:shop' }),
    box('revision-control', 'component', unit, { parent: 'observed:export' }), box('developer', 'actor', unit),
  ], [uses('uses-revision-control', 'developer', 'revision-control')])
  for (const [before, after] of [[older, newer], [newer, older]] as const) {
    const scene = sheetScene(compareArchitecture(before, after, {}, {}).world)
    const placed = [...scene.buildings, ...scene.slabs].map(item => item.representationId)
    expect(placed).toEqual(expect.arrayContaining(['observed:revision-control', 'observed:export', 'removed:observed:export']))
  }
})
