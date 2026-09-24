import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createScannerSession } from '../src/scanner/session.ts'
import { readScannerConfig, writeScannerConfig } from '../src/scanner/modules/config.ts'
import { loadAnnotatedArchitecture } from '../src/core.ts'

async function project() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-settings-live-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
  expect(await git.exited).toBe(0)
  await mkdir(path.join(root, 'ui'))
  await writeFile(path.join(root, 'ui/package.json'), JSON.stringify({ dependencies: { react: '19.0.0' } }))
  await writeFile(path.join(root, 'ui/view.fixture'), 'first')
  await writeScannerConfig(root, { scanners: [] })
  const source = path.join(root, 'plugin')
  await mkdir(source)
  await writeFile(path.join(source, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0',
    groma: { scanner: { id: 'fixture', entry: './index.ts', include: ['**/*.fixture'], discovery: {
      technologies: ['react'], rules: [{ type: 'dependency', files: ['**/package.json'], technology: 'react', kind: 'framework', package: 'react' }],
    } } },
  }))
  await writeFile(path.join(source, 'index.ts'), `import { readFile, stat } from 'node:fs/promises'
export default { id: 'fixture', async scan(root) {
  if (await stat(root + '/tool-missing').then(() => true, () => false)) throw new Error('Install the project tool.')
  return { scanner: { id: 'fixture', technology: 'react', engine: 'fixture', engineVersion: '1' }, diagnostics: [],
    roots: [{ id: 'root', name: 'Fixture', kind: 'package', file: 'ui/package.json' }, { id: 'ui', name: 'UI', kind: 'project', parent: 'root' }],
    files: [{ file: 'ui/view.fixture', roots: ['ui'], symbols: [{ id: 'view', kind: 'function', name: await readFile(root + '/ui/view.fixture', 'utf8') }] }] }
} }`)
  return { root, source }
}

test.concurrent('settings changes reconfigure live scanning and keep saved evidence when a selection is removed', async () => {
  const { root, source } = await project()
  let folds = 0
  let nextFold: (() => void) | undefined
  const session = await createScannerSession(root, { onFold() { folds++; nextFold?.() } })
  try {
    await session.reconfigure()
    expect(session.state.notice.tone, JSON.stringify(session.state)).toBe('warning')
    await session.change({ action: 'add', source })
    expect(session.state.notice.tone).toBe('neutral')
    expect(session.state.scanners.map(item => item.id)).toEqual(['fixture'])
    const changed = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Source edit did not reach the new scanner subscription')), 3000)
      nextFold = () => { clearTimeout(timer); resolve() }
    })
    await writeFile(path.join(root, 'ui/view.fixture'), 'second')
    await changed
    const scanned = await loadAnnotatedArchitecture(root)
    expect(scanned.elements.flatMap(element => element.code).some(code => code.symbol === 'second')).toBe(true)
    nextFold = undefined
    const config = await readScannerConfig(root)
    await writeScannerConfig(root, { ...config, scanners: [...config.scanners, { id: 'absent', source: path.join(root, 'absent'), include: ['**/*.fixture'] }] })
    await session.reconfigure()
    const beforeCheck = folds
    await session.change({ action: 'retry' })
    expect(folds).toBe(beforeCheck + 1)
    expect(session.state.scanners.find(item => item.id === 'fixture')?.status).toBe('ready')
    await writeScannerConfig(root, { ...config, exclude: ['ui/'] })
    await session.reconfigure()
    expect(session.state.scanners[0]?.match).toBe('none')
    await session.change({ action: 'remove', id: 'fixture' })
    expect((await loadAnnotatedArchitecture(root)).elements).toEqual(scanned.elements)
    await expect(session.change({ action: 'add', source: path.join(root, 'missing-plugin') })).rejects.toThrow('scanner package not found')
    expect(session.state.notice.tone).toBe('error')
    expect((await readScannerConfig(root)).scanners).toEqual([])
    expect(await readFile(path.join(root, 'ui/view.fixture'), 'utf8')).toBe('second')
  } finally { await session.close(); await rm(root, { recursive: true, force: true }) }
})

test.concurrent('install reports preparation failures automatically and retry scans after the tool is restored', async () => {
  const { root, source } = await project()
  await writeFile(path.join(root, 'tool-missing'), '')
  const before = await loadAnnotatedArchitecture(root)
  const session = await createScannerSession(root)
  try {
    await session.change({ action: 'add', source })
    expect(session.state.scanners[0]?.status).toBe('blocked')
    expect(session.state.scanners[0]?.message).toContain('Install the project tool.')
    expect((await loadAnnotatedArchitecture(root)).elements).toEqual(before.elements)
    await rm(path.join(root, 'tool-missing'))
    await session.change({ action: 'retry' })
    expect(session.state.scanners[0]?.status).toBe('ready')
    expect((await loadAnnotatedArchitecture(root)).elements.flatMap(element => element.code).some(code => code.symbol === 'first')).toBe(true)
  } finally { await session.close(); await rm(root, { recursive: true, force: true }) }
})

test.concurrent('live scanning updates healthy evidence, reports every failure and clears errors after recovery', async () => {
  const { root, source } = await project()
  for (const id of ['broken', 'tool']) {
    const directory = path.join(root, id)
    await mkdir(directory)
    await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: id, version: '1.0.0',
      groma: { scanner: { id, entry: './index.ts', include: ['**/*.fixture'] } } }))
    await writeFile(path.join(directory, 'index.ts'), id === 'broken' ? 'export default {}' : `
      import { stat } from 'node:fs/promises'
      export default { id: 'tool', async scan(root) {
        if (await stat(root + '/tool.fail').then(() => true, () => false)) throw new Error('Tool failed')
        return undefined
      } }
    `)
  }
  await writeFile(path.join(root, 'tool.fail'), '')
  await writeScannerConfig(root, { scanners: [
    { id: 'fixture', source, include: ['**/*.fixture'] }, { id: 'broken', source: './broken', include: ['**/*.fixture'] },
    { id: 'tool', source: './tool', include: ['**/*.fixture'] },
  ] })
  let nextFold: (() => void) | undefined
  const session = await createScannerSession(root, { onFold() { nextFold?.() } })
  const blocked = () => session.state.scanners.filter(item => item.status === 'blocked').map(item => item.id).sort()
  try {
    await session.reconfigure()
    expect(blocked()).toEqual(['broken', 'tool'])
    expect(session.state.scanners.find(item => item.id === 'fixture')?.status).toBe('ready')
    const changed = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Healthy scanner did not process the source edit')), 3000)
      nextFold = () => { clearTimeout(timer); resolve() }
    })
    await writeFile(path.join(root, 'ui/view.fixture'), 'changed')
    await changed
    nextFold = undefined
    expect(blocked()).toEqual(['broken', 'tool'])
    expect((await loadAnnotatedArchitecture(root)).elements.flatMap(element => element.code).some(code => code.symbol === 'changed')).toBe(true)
    await rm(path.join(root, 'tool.fail'))
    await session.change({ action: 'retry' })
    expect(blocked()).toEqual(['broken'])
    await session.change({ action: 'remove', id: 'broken' })
    expect(blocked()).toEqual([])
    expect(session.state.notice.tone).not.toBe('error')
  } finally { await session.close(); await rm(root, { recursive: true, force: true }) }
})
