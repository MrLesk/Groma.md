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
  const baseline = await registry.collectObservations('.')
  const changed = await registry.collectObservations('.', ['new.first'])
  expect([first.calls(), second.calls()]).toEqual([2, 1])
  expect(revision(changed, 'first')).toBe('2')
  expect(changed[1]).toBe(baseline[1])
  expect(registry.watchesFile('excluded/new.first')).toBe(false)
  expect(await registry.collectObservations('.', ['excluded/new.first', 'readme.md'])).toEqual(changed)
  expect([first.calls(), second.calls()]).toEqual([2, 1])
  await registry.collectObservations('.', ['shared.config'])
  expect([first.calls(), second.calls()]).toEqual([3, 2])
})

test.concurrent('a failed scanner blocks publication until its pending work succeeds', async () => {
  const first = scanner('first'), second = scanner('second')
  const registry = createScannerRegistry([first.plugin, second.plugin], () => false)
  await registry.collectObservations('.')
  second.fail(true)
  await expect(registry.collectObservations('.', ['shared.config'])).rejects.toThrow()
  expect([first.calls(), second.calls()]).toEqual([2, 2])
  await expect(registry.collectObservations('.', ['changed.first'])).rejects.toThrow()
  second.fail(false)
  const result = await registry.collectObservations('.', ['changed.second'])
  expect([first.calls(), second.calls()]).toEqual([3, 4])
  expect(revision(result, 'first')).toBe('3')
  expect(revision(result, 'second')).toBe('4')
})

test.concurrent('a scanner that stops supporting a project removes its previous observation', async () => {
  const first = scanner('first'), second = scanner('second')
  const registry = createScannerRegistry([first.plugin, second.plugin], () => false)
  await registry.collectObservations('.')
  first.unsupported()
  const result = await registry.collectObservations('.', ['shared.config'])
  expect(result.map(observation => observation.scanner.id)).toEqual(['second'])
})

test.concurrent('a failed batch waits for other scanners before rejecting', async () => {
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
  const result = registry.collectObservations('.').catch(error => {
    expect(completed).toBe(true)
    return error
  })
  await started.promise
  finish.resolve()
  expect(await result).toBeInstanceOf(Error)
})
