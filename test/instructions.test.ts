import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  agentInstructionGuide,
  agentInstructionGuides,
} from '../src/agent-instructions.ts'
import {
  authoring,
  humanInstructionGuides,
  overview,
} from '../src/instructions.ts'
import { renderPlainWelcome } from '../src/welcome.ts'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const cli = path.join(projectRoot, 'src', 'cli.ts')
const curation = (
  await readFile(path.join(projectRoot, 'docs', 'agent-instructions', 'index.md'), 'utf8')
).trimEnd()

function run(args: string[]) {
  return new Promise<{
    code: number | null
    stdout: string
    stderr: string
  }>((resolve, reject) => {
    const child = spawn('bun', [cli, ...args], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
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
  })
}

test('bare groma without a TTY prints the plain welcome and exits', async () => {
  const result = await run([])
  const expected = await renderPlainWelcome(projectRoot)

  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout, `${expected}\n`)
  assert.equal(result.stdout.includes('\u001B['), false)
  assert.match(result.stdout, /groma\.md v0\.1\.0/)
  assert.match(result.stdout, /https:\/\/groma\.md/)
  assert.ok(result.stdout.includes(`project: ${path.basename(projectRoot)}`))
  assert.ok(result.stdout.indexOf('groma web') < result.stdout.indexOf('groma view'))
  assert.match(result.stdout, /plugins: backlog\.md: (?:found|missing \(bun i -g backlog\.md\)) │ typescript: built-in/)
  assert.match(result.stdout, /groma scanner add <source>/)
  assert.match(result.stdout, /groma scanner remove <id>/)
  assert.match(result.stdout, /groma agent-instructions \[guide\]/)
  assert.doesNotMatch(result.stdout, /System Context/)
})

test('bare groma --plain prints the same plain welcome', async () => {
  const bare = await run([])
  const result = await run(['--plain'])

  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout, bare.stdout)
  assert.equal(result.stdout.includes('\u001B['), false)
})

test('groma instructions and instructions overview print the overview', async () => {
  const bare = await run(['instructions'])
  const named = await run(['instructions', 'overview'])

  assert.equal(bare.code, 0, bare.stderr)
  assert.equal(bare.stderr, '')
  assert.equal(bare.stdout, `${overview}\n`)
  assert.equal(named.code, 0, named.stderr)
  assert.equal(named.stdout, bare.stdout)
})

test('groma instructions authoring prints the authoring guide', async () => {
  const result = await run(['instructions', 'authoring'])

  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout, `${authoring}\n`)
})

test('groma instructions unknown guide fails with a clear message', async () => {
  const result = await run(['instructions', 'curation'])

  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'unknown guide: curation\n')
})

test('groma agent-instructions prints only the shipped agent guide', async () => {
  const bare = await run(['agent-instructions'])
  const named = await run(['agent-instructions', 'curation'])

  assert.equal(bare.code, 0, bare.stderr)
  assert.equal(bare.stderr, '')
  assert.equal(bare.stdout, `${curation}\n`)
  assert.equal(named.code, 0, named.stderr)
  assert.equal(named.stdout, bare.stdout)
})

test('groma agent-instructions rejects an unknown agent guide', async () => {
  const result = await run(['agent-instructions', 'no-such'])

  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'unknown agent guide: no-such\n')
})

test('every guide points to both instruction commands', async () => {
  const guides: string[] = humanInstructionGuides.map(guide => guide.content)
  for (const definition of agentInstructionGuides) {
    const guide = await agentInstructionGuide(definition.id)
    assert.ok(guide)
    guides.push(guide.content)
  }
  for (const content of guides) {
    assert.match(content, /groma instructions/)
    assert.match(content, /groma agent-instructions/)
  }
})

test('groma --help still lists the commands', async () => {
  const result = await run(['--help'])

  assert.equal(result.code, 0, result.stderr)
  assert.notEqual(result.stdout, `${await renderPlainWelcome(projectRoot)}\n`)
  for (const name of [
    'web',
    'view',
    'scan',
    'create',
    'edit',
    'accept',
    'instructions',
    'agent-instructions',
  ]) {
    assert.match(result.stdout, new RegExp(`^\\s+${name}\\b`, 'm'))
  }
  assert.ok(result.stdout.indexOf('web') < result.stdout.indexOf('view'))
})
