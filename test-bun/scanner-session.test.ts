import { expect, test } from 'bun:test'
import { createScanObservation, type ScannerPlugin, type ScanObservation } from '@groma/scanner'
import { createScannerRegistry } from '../src/scanner/registry.ts'

function scanner(id: string) {
  let calls = 0
  let failure = false
  let supported = true
  const plugin: ScannerPlugin = {
    id,
    watch: { include: [`**/*.${id}`, 'shared.config'], exclude: [] },
    async scan() {
      calls++
      if (failure) throw new Error(`${id} failed`)
      if (!supported) return undefined
      return createScanObservation({
        scanner: { technology: 'fixture', id: id, engine: 'fixture', engineVersion: '1' },
        roots: [
          { id: 'root', kind: 'package', name: id, file: 'package.json' },
          { kind: 'project', parent: 'root', id: 'scope', name: 'Scope' },
        ],
        files: [{ roots: ['scope'], file: `source.${id}`, symbols: [{ id: 'revision', name: String(calls), kind: 'function' }] }],
         diagnostics: [],
      })
    },
  }
  return { plugin, calls: () => calls, fail: (value: boolean) => { failure = value }, unsupported: () => { supported = false } }
}

function revision(observations: ScanObservation[], id: string) {
  return observations.find(observation => observation.scanner.id === id)?.files[0]?.symbols[0]?.name
}

test.concurrent('a source session runs matching subscriptions and keeps unaffected evidence', async () => {
  const first = scanner('first'), second = scanner('second')
  const registry = createScannerRegistry([first.plugin, second.plugin], file => file.startsWith('excluded/'))
  const baseline = (await registry.collectObservations('.')).observations
  const changed = (await registry.collectObservations('.', ['new.first'])).observations
  expect([first.calls(), second.calls()]).toEqual([2, 1])
  expect(revision(changed, 'first')).toBe('2')
  expect(changed[1]).toBe(baseline[1])
  expect(registry.watchesFile('excluded/new.first')).toBe(false)
  expect((await registry.collectObservations('.', ['excluded/new.first', 'readme.md'])).observations).toEqual(changed)
  expect([first.calls(), second.calls()]).toEqual([2, 1])
  await registry.collectObservations('.', ['shared.config'])
  expect([first.calls(), second.calls()]).toEqual([3, 2])
})

test.concurrent('a failed scanner leaves healthy evidence available and recovers on a later scan', async () => {
  const first = scanner('first'), second = scanner('second')
  const registry = createScannerRegistry([first.plugin, second.plugin], () => false)
  await registry.collectObservations('.')
  second.fail(true)
  const failed = await registry.collectObservations('.', ['shared.config'])
  expect(failed.failures.map(error => error.scanner)).toEqual(['second'])
  expect(failed.observations.map(item => item.scanner.id)).toEqual(['first'])
  expect(revision(failed.observations, 'first')).toBe('2')
  expect([first.calls(), second.calls()]).toEqual([2, 2])
  expect((await registry.collectObservations('.', ['changed.first'])).failures).toHaveLength(1)
  second.fail(false)
  const result = await registry.collectObservations('.', ['changed.second'])
  expect([first.calls(), second.calls()]).toEqual([3, 4])
  expect(result.failures).toEqual([])
  expect(revision(result.observations, 'first')).toBe('3')
  expect(revision(result.observations, 'second')).toBe('4')
})

test.concurrent('a scanner that stops supporting a project removes its previous observation', async () => {
  const first = scanner('first'), second = scanner('second')
  const registry = createScannerRegistry([first.plugin, second.plugin], () => false)
  await registry.collectObservations('.')
  first.unsupported()
  const result = await registry.collectObservations('.', ['shared.config'])
  expect(result.observations.map(observation => observation.scanner.id)).toEqual(['second'])
})

test.concurrent('a mixed batch waits for every scanner and returns its failures', async () => {
  const failed = scanner('failed')
  failed.fail(true)
  const started = Promise.withResolvers<void>()
  const finish = Promise.withResolvers<void>()
  let completed = false
  const slow: ScannerPlugin = {
    id: 'slow', watch: { include: ['**'], exclude: [] },
    async scan() { started.resolve(); await finish.promise; completed = true; return undefined },
  }
  const registry = createScannerRegistry([failed.plugin, slow], () => false)
  const result = registry.collectObservations('.').then(batch => {
    expect(completed).toBe(true)
    return batch
  })
  await started.promise
  finish.resolve()
  expect((await result).failures.map(error => error.scanner)).toEqual(['failed'])
})
