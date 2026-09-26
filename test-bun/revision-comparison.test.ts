import { componentReasons, comparisonDefaultTab, textChanges } from '../src/viewers/web/comparison/details.ts'
import { expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { compareArchitecture, type SourceTexts } from '../src/history/comparison.ts'
import { filterComparisonScene } from '../src/viewers/web/comparison/control.ts'
import { presentScene } from '../src/viewers/web/iso/view-motion/presentation.ts'
import { NESTED_POSE } from '../src/viewers/web/iso/view-motion/orbit.ts'
import { comparisonTree, nextChange } from '../src/viewers/web/comparison/tree.ts'
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


test.concurrent('comparison hierarchy includes changed paths and independent relationships, with counts owned by ancestors', async () => {
  const { before, after, oldSources, newSources } = await fixture()
  const compared = compareArchitecture(before, after, oldSources, newSources)
  const comparison = { ...compared, from: null }
  const tree = comparisonTree(compared.world, comparison)
  expect(tree.rows.map(row => row.id)).not.toContain('payment')
  expect(tree.counts.get('shop')).toEqual({ added: 1, modified: 1, removed: 1 })
  expect(tree.counts.get('api')).toEqual({ added: 1, modified: 1, removed: 0 })
  expect(tree.former.has('mail')).toBe(true)
  expect(tree.order.slice(-3)).toEqual(compared.world.relationships.map(item => item.id))
  expect(tree.order.indexOf('checkout')).toBeLessThan(tree.order.indexOf('receipt-sender'))
  const empty = compareArchitecture(after, after, newSources, newSources)
  expect(comparisonTree(empty.world, { ...empty, from: null }).order).toEqual([])
})


test.concurrent('comparison filters share list counts and navigation while removing only deleted map context', async () => {
  const { before, after, oldSources, newSources } = await fixture()
  const compared = compareArchitecture(before, after, oldSources, newSources)
  const comparison = { ...compared, from: null }
  const enabled = new Set(['added'] as const)
  const tree = comparisonTree(compared.world, comparison, enabled)
  expect(tree.counts.get('shop')).toEqual({ added: 1, modified: 0, removed: 0 })
  expect(tree.order).toEqual(['receipt-worker', 'relationship:0'])
  expect(nextChange(tree.order, undefined, 1)).toBe('receipt-worker')
  expect(nextChange(tree.order, 'relationship:0', 1)).toBe('receipt-worker')
  expect(nextChange(tree.order, 'receipt-worker', -1)).toBe('relationship:0')
  expect(nextChange([], undefined, 1)).toBeUndefined()
  const scene = presentScene(sheetScene(compared.world), undefined, NESTED_POSE)
  const original = structuredClone(scene)
  const filtered = filterComparisonScene(scene, compared.world, comparison, enabled)
  expect(filtered.buildings.some(item => item.building.representationId === 'receipt-sender')).toBe(false)
  expect(filtered.buildings.some(item => item.building.representationId === 'payment')).toBe(true)
  expect(filtered.slabs.some(item => item.slab.representationId === 'mail')).toBe(false)
  expect(filtered.routes.some(item => item.route.target === 'receipt-sender')).toBe(false)
  expect(filtered.bounds).toBe(scene.bounds)
  expect(scene).toEqual(original)
})


test.concurrent('comparison details explain owned changes and respect explicit tabs for source-only changes', async () => {
  const { before, after, oldSources, newSources } = await fixture()
  const compared = compareArchitecture(before, after, oldSources, newSources)
  expect(componentReasons(compared.components.checkout).map(reason => reason.key)).toEqual(['description', 'files'])
  const sourceOnly = compareArchitecture(before, before, oldSources, { ...oldSources, 'src/checkout.ts': 'new source' })
  const comparison = { ...sourceOnly, from: null }
  expect(comparisonDefaultTab(sourceOnly.components.checkout)).toBe('how')
  const url = new URL('https://example.test/?component=checkout')
  expect(readView(url, sourceOnly.world, [], [], 'auto', comparison).tab).toBe('how')
  url.searchParams.set('tab', 'what')
  const explicit = readView(url, sourceOnly.world, [], [], 'auto', comparison)
  expect(explicit.tab).toBe('what')
  expect(new URL(writeView(explicit, sourceOnly.world, [], '/', comparison), url).searchParams.get('tab')).toBe('what')
  expect(comparisonDefaultTab(compared.components.checkout)).toBe('what')
  expect(componentReasons(compared.components['receipt-worker'])).toEqual([])
})

test.concurrent('prose presentation separates replacements and keeps large rewrites readable', () => {
  expect(textChanges('Writes', 'Packages').parts.map(part => part.value).join('')).toBe('Writes Packages')
  expect(textChanges('This service writes the current order.', 'This service reads the current order.').mode).toBe('words')
  expect(textChanges('The queue stores pending email.', 'Payment requests go directly to the provider.').mode).toBe('rewrite')
  expect(textChanges('', 'New explanation').mode).toBe('added')
  expect(textChanges('Old explanation', '').mode).toBe('removed')
})
