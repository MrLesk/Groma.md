import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  isTypeScriptScanFile,
  listTypeScriptFiles,
} from '../src/typescript-files.ts'
import {
  formatTypeScriptObservation,
  observeTypeScriptSource,
  scanTypeScriptSource,
} from '../src/typescript-scanner.ts'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

function run(command: string, args: string[], cwd: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', chunk => {
        stdout += chunk
      })
      child.stderr.on('data', chunk => {
        stderr += chunk
      })
      child.on('error', reject)
      child.on('close', code => {
        resolve({ code, stdout, stderr })
      })
    },
  )
}

async function writeTree(
  root: string,
  files: Record<string, string>,
): Promise<void> {
  for (const [relative, source] of Object.entries(files)) {
    const filename = path.join(root, ...relative.split('/'))
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, source)
  }
}

async function createRepo(
  t: TestContext,
  files: Record<string, string>,
): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-ts-plugin-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeTree(root, {
    'package.json': JSON.stringify({ name: 'shop' }),
    '.gitignore': 'node_modules/\nignored.ts\n',
    'groma/observed/README.md': '# should not be read\n',
    ...files,
  })
  const init = await run('git', ['init'], root)
  assert.equal(init.code, 0, init.stderr)
  const add = await run('git', ['add', '-A'], root)
  assert.equal(add.code, 0, add.stderr)
  return root
}

test('scanTypeScriptSource returns observation candidates', async t => {
  const root = await createRepo(t, {
    'src/cli.ts': "import { scan } from './scanner.ts'\nexport function run() {}\n",
    'src/scanner.ts': 'export function scan() {}\n',
  })
  const result = await scanTypeScriptSource(root)
  const observation = await observeTypeScriptSource(root)
  assert.deepEqual(result.candidates, observation.candidates)
  assert.equal('relationships' in result, false)
})

test('gitignore and ignore patterns drop files; globs select the rest', async t => {
  const root = await createRepo(t, {
    'src/cli.ts': 'export function start() {}\n',
    'lib/extra.ts': 'export function extra() {}\n',
    'ignored.ts': 'export function hidden() {}\n',
    'node_modules/pkg/index.ts': 'export function dep() {}\n',
    'src/cli.test.ts': 'export function testStart() {}\n',
  })

  const listed = await listTypeScriptFiles(root)
  assert.deepEqual(listed, ['lib/extra.ts', 'src/cli.ts'])
  assert.equal(isTypeScriptScanFile('src/cli.ts'), true)
  assert.equal(isTypeScriptScanFile('src/cli.test.ts'), false)

  const onlySrc = await listTypeScriptFiles(root, {
    globs: ['src/**/*.ts'],
    ignore: ['**/*.test.ts'],
  })
  assert.deepEqual(onlySrc, ['src/cli.ts'])
})

test('C4 candidates match what core consumes', async t => {
  const root = await createRepo(t, {
    'src/cli.ts': `
import { scan } from './scanner.ts'
import { start } from './view.ts'
export function run() {}
`,
    'src/scanner.ts': `
import { fold } from './core.ts'
import { plugin } from './plugin.ts'
export function scan() {}
`,
    'src/view.ts': `
import { fold } from './core.ts'
export function start() {}
`,
    'src/core.ts': `
import { layout } from './world.ts'
export function fold() {}
`,
    'src/world.ts': 'export function layout() {}\n',
    'src/plugin.ts': 'export function plugin() {}\n',
    'src/unused.ts': 'export function unused() {}\n',
    'src/viewers/tui/atoms/cell.ts': 'export function cell() {}\n',
  })

  const result = await observeTypeScriptSource(root)
  const byName = new Map(result.candidates.map(candidate => [candidate.name, candidate]))

  assert.equal(byName.get('Shop')?.kind, 'system')
  assert.equal(byName.get('Cli')?.kind, 'container')
  assert.equal(byName.get('Cli')?.parent, 'Shop')
  assert.equal(byName.get('Cli')?.code?.[0]?.file, 'src/cli.ts')
  assert.equal(byName.get('Scanner')?.kind, 'container')
  assert.equal(byName.get('View')?.kind, 'container')
  assert.equal(byName.get('Core')?.kind, 'container')
  assert.equal(byName.get('Plugin')?.kind, 'component')
  assert.equal(byName.get('Plugin')?.parent, 'Scanner')
  assert.equal(byName.get('World')?.kind, 'component')
  assert.equal(byName.get('World')?.parent, 'Core')
  assert.equal(byName.has('Unused'), false)
  assert.equal(byName.has('Cell'), false)
  assert.deepEqual(result.relationships, [
    { source: 'Cli', target: 'Scanner', description: 'starts' },
    { source: 'Cli', target: 'View', description: 'starts' },
    { source: 'Scanner', target: 'Core', description: 'uses' },
    { source: 'View', target: 'Core', description: 'uses' },
  ])
})

test('fan-in inside one container stays a component', async t => {
  const root = await createRepo(t, {
    'src/cli.ts': `
import { start } from './view.ts'
export function run() {}
`,
    'src/view.ts': `
import { page } from './page.ts'
import { select } from './navigation.ts'
export function start() {}
`,
    'src/page.ts': `
import { select } from './navigation.ts'
export function page() {}
`,
    'src/navigation.ts': `
import { row } from './tree.ts'
export function select() {}
`,
    'src/tree.ts': 'export function row() {}\n',
  })

  const result = await observeTypeScriptSource(root)
  const containers = result.candidates.filter(candidate => candidate.kind === 'container')
  assert.deepEqual(
    containers.map(candidate => candidate.name).sort(),
    ['Cli', 'View'],
  )
  const navigation = result.candidates.find(candidate => candidate.name === 'Navigation')
  assert.equal(navigation?.kind, 'component')
  assert.equal(navigation?.parent, 'View')
})

test('CLI imports with high fan-in become hubs, not extra modes', async t => {
  const root = await createRepo(t, {
    'src/cli.ts': `
import { scan } from './scanner.ts'
import { help } from './help.ts'
export function run() {}
`,
    'src/scanner.ts': `
import { fold } from './core.ts'
import { help } from './help.ts'
export function scan() {}
`,
    'src/help.ts': `
import { fold } from './core.ts'
import { text } from './help-text.ts'
export function help() {}
`,
    'src/help-text.ts': 'export function text() {}\n',
    'src/core.ts': `
import { layout } from './world.ts'
export function fold() {}
`,
    'src/world.ts': 'export function layout() {}\n',
  })

  const result = await observeTypeScriptSource(root)
  const containers = result.candidates.filter(candidate => candidate.kind === 'container')
  assert.deepEqual(
    containers.map(candidate => candidate.name).sort(),
    ['Cli', 'Core', 'Help', 'Scanner'],
  )
  assert.ok(result.relationships.some(edge => {
    return edge.source === 'Cli' && edge.target === 'Scanner' && edge.description === 'starts'
  }))
  assert.ok(result.relationships.some(edge => {
    return edge.source === 'Scanner' && edge.target === 'Help' && edge.description === 'uses'
  }))
  assert.ok(!result.relationships.some(edge => {
    return edge.source === 'Cli' && edge.target === 'Help' && edge.description === 'starts'
  }))
})

test('index modules take the directory name and have one parent', async t => {
  const root = await createRepo(t, {
    'src/cli.ts': `
import { start } from './server/index.ts'
export function run() {}
`,
    'src/server/index.ts': `
import { page } from './page.ts'
export function start() {}
`,
    'src/server/page.ts': 'export function page() {}\n',
  })

  const result = await observeTypeScriptSource(root)
  const server = result.candidates.find(candidate => candidate.code?.[0]?.file === 'src/server/index.ts')
  assert.equal(server?.name, 'Server')
  assert.equal(server?.kind, 'container')
  assert.equal(
    result.candidates.filter(candidate => candidate.name === 'Page').length,
    1,
  )
})

test('the dump is an indented C4 tree', async t => {
  const root = await createRepo(t, {
    'src/cli.ts': "import { scan } from './scanner.ts'\nexport function run() {}\n",
    'src/scanner.ts': 'export function scan() {}\n',
  })
  const text = formatTypeScriptObservation(await observeTypeScriptSource(root))
  assert.match(text, /^Shop  system\n`-- Cli  container  src\/cli\.ts  run\n    `-- Scanner  component  src\/scanner\.ts  scan$/m)
})

test('running the plugin prints C4 candidates without reading groma files', async t => {
  const root = await createRepo(t, {
    'app.ts': 'export function main() {}\n',
  })

  const result = await run('bun', ['src/typescript-scanner.ts', root], projectRoot)
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /^Shop  system$/m)
  assert.match(result.stdout, /App  container  app\.ts  main/)
  assert.doesNotMatch(result.stdout, /groma|should not be read/)
})
