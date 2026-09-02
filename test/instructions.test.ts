import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import {
  lstat,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const cli = path.join(projectRoot, 'src', 'cli.ts')
function run(args: string[], cwd = projectRoot) {
  return new Promise<{
    code: number | null
    stderr: string
  }>((resolve, reject) => {
    const child = spawn('bun', [cli, ...args], {
      cwd,
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', code => {
      resolve({ code, stderr })
    })
  })
}

async function temporaryRepository(runTest: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-init-'))
  try {
    await runTest(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

function managedBlockCount(content: string): number {
  return content.split('<!-- groma:start -->').length - 1
}

async function runInit(root: string) {
  const result = await run(['init', 'Test project', '--directory', 'groma'], root)
  assert.equal(result.code, 0, result.stderr)
}

test('groma init creates only AGENTS.md when no instruction file exists', { concurrency: true }, async () => {
  await temporaryRepository(async root => {
    await runInit(root)

    assert.deepEqual((await readdir(root)).sort(), ['AGENTS.md', 'groma'])
    const content = await readFile(path.join(root, 'AGENTS.md'), 'utf8')
    assert.equal(managedBlockCount(content), 1)
  })
})

test('groma init updates only an existing AGENTS.md and remains idempotent', { concurrency: true }, async () => {
  await temporaryRepository(async root => {
    const original = '# Existing agent rules\n\nKeep these rules.\n'
    const agents = path.join(root, 'AGENTS.md')
    const unrelated = path.join(root, 'notes.md')
    await writeFile(agents, original)
    await writeFile(unrelated, 'unchanged\n')

    await runInit(root)
    const once = await readFile(agents, 'utf8')
    await runInit(root)

    assert.equal(await readFile(agents, 'utf8'), once)
    assert.equal(managedBlockCount(once), 1)
    assert.ok(once.startsWith(original))
    assert.equal(await readFile(unrelated, 'utf8'), 'unchanged\n')
    assert.deepEqual((await readdir(root)).sort(), ['AGENTS.md', 'groma', 'notes.md'])
  })
})

test('groma init updates only an existing CLAUDE.md', { concurrency: true }, async () => {
  await temporaryRepository(async root => {
    const original = '# Existing Claude rules\n'
    const claude = path.join(root, 'CLAUDE.md')
    await writeFile(claude, original)

    await runInit(root)

    const content = await readFile(claude, 'utf8')
    assert.equal(managedBlockCount(content), 1)
    assert.ok(content.startsWith(original))
    assert.deepEqual((await readdir(root)).sort(), ['CLAUDE.md', 'groma'])
  })
})

test('groma init updates distinct AGENTS.md and CLAUDE.md files', { concurrency: true }, async () => {
  await temporaryRepository(async root => {
    const agents = path.join(root, 'AGENTS.md')
    const claude = path.join(root, 'CLAUDE.md')
    await writeFile(agents, '# Agent rules\n')
    await writeFile(claude, '# Claude rules\n')

    await runInit(root)

    const agentContent = await readFile(agents, 'utf8')
    const claudeContent = await readFile(claude, 'utf8')
    assert.equal(managedBlockCount(agentContent), 1)
    assert.equal(managedBlockCount(claudeContent), 1)
    assert.ok(agentContent.startsWith('# Agent rules\n'))
    assert.ok(claudeContent.startsWith('# Claude rules\n'))
  })
})

test('groma init preserves a CLAUDE.md symlink to AGENTS.md and writes once', { concurrency: true }, async () => {
  await temporaryRepository(async root => {
    const agents = path.join(root, 'AGENTS.md')
    const claude = path.join(root, 'CLAUDE.md')
    await writeFile(agents, '# Shared rules\n')
    await symlink('AGENTS.md', claude)

    await runInit(root)
    await runInit(root)

    const content = await readFile(agents, 'utf8')
    assert.equal(managedBlockCount(content), 1)
    assert.equal(await readFile(claude, 'utf8'), content)
    assert.equal((await lstat(claude)).isSymbolicLink(), true)
    assert.equal(await readlink(claude), 'AGENTS.md')
  })
})
