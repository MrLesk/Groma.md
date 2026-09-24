import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createScanObservation, type ScannerPlugin, type ScanObservation } from '@groma/scanner'
import { createScannerRegistry, type ScanEvent } from '../src/scanner/registry.ts'
import { scannerSelection } from '../src/scanner/modules/selection.ts'

function scanner(id: string) {
  let calls = 0
  let failure = false
  let supported = true
  const plugin: ScannerPlugin = {
    id,
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

/** Plugins as the host runs them: each reads its own extension and the shared config, less one exclusion list. */
function configured(exclude: string[], ...plugins: ScannerPlugin[]) {
  return plugins.map(plugin => ({ plugin, ...scannerSelection({ include: [`**/*.${plugin.id}`, 'shared.config'], exclude }) }))
}

function revision(observations: ScanObservation[], id: string) {
  return observations.find(observation => observation.scanner.id === id)?.files[0]?.symbols[0]?.name
}

test.concurrent('a source session runs matching subscriptions and keeps unaffected evidence', async () => {
  const first = scanner('first'), second = scanner('second')
  const registry = createScannerRegistry(configured(['/excluded/'], first.plugin, second.plugin))
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
  const registry = createScannerRegistry(configured([], first.plugin, second.plugin))
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
  const registry = createScannerRegistry(configured([], first.plugin, second.plugin))
  await registry.collectObservations('.')
  first.unsupported()
  const result = await registry.collectObservations('.', ['shared.config'])
  expect(result.observations.map(observation => observation.scanner.id)).toEqual(['second'])
})

test.concurrent('a mixed batch waits for every invocation and emits its start and end events', async () => {
  // The skipped scanner's include list names one file, which its exclusions name too.
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-session-'))
  await mkdir(path.join(root, 'excluded'))
  await writeFile(path.join(root, 'excluded/source.skipped'), '')
  expect(await Bun.spawn(['git', 'init', '--quiet', root]).exited).toBe(0)
  const failed = scanner('failed')
  failed.fail(true)
  const skipped = scanner('skipped')
  const started = Promise.withResolvers<void>()
  const finish = Promise.withResolvers<void>()
  const events: ScanEvent[] = []
  let completed = false
  const slow: ScannerPlugin = {
    id: 'slow',
    async scan() { started.resolve(); await finish.promise; completed = true; return undefined },
  }
  const registry = createScannerRegistry(configured(['/excluded/'], failed.plugin, slow, skipped.plugin))
  const result = registry.collectObservations(root, undefined, event => events.push(event)).then(batch => {
    expect(completed).toBe(true)
    return batch
  }).finally(() => rm(root, { recursive: true, force: true }))
  await started.promise
  const beforeFinish = events.filter(event => event.scanner === 'slow')
  finish.resolve()
  expect((await result).failures.map(error => error.scanner)).toEqual(['failed'])
  expect(beforeFinish).toEqual([{ scanner: 'slow', type: 'start' }])
  for (const id of ['failed', 'slow']) {
    expect(events.filter(event => event.scanner === id).map(event => event.type)).toEqual(['start', 'end'])
  }
  expect(events.filter(event => event.scanner === 'skipped')).toEqual([])
  expect(skipped.calls()).toBe(0)
})
