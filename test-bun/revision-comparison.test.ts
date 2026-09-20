import { expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { compareArchitecture, type SourceTexts } from '../src/history/comparison.ts'
import type { AnnotatedArchitectureModel } from '../src/types.ts'

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
  expect(compared.components['receipt-sender']!.files).toEqual([{ file: 'src/receipt.ts', status: 'unchanged' }])
  expect(compared.relationships).toEqual({ 'relationship:9': 'modified', 'relationship:0': 'added', 'removed:relationship:1': 'removed' })
  expect(compared.world.elements.find(item => item.id === 'mail')?.children).toEqual(['receipt-sender'])
  expect(compared.world.elements.find(item => item.id === 'shop')?.children).toEqual(['api', 'mail'])
  expect(compared.components.shop).toBeUndefined()
  expect(JSON.stringify([before, after])).toBe(inputs)
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
