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

function run(args: string[], cwd = projectRoot) {
  return new Promise<{
    code: number | null
    stdout: string
    stderr: string
  }>((resolve, reject) => {
    const child = spawn('bun', [cli, ...args], {
      cwd,
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
  assert.equal(result.stderr, '')
  assert.equal(result.stdout, 'ok\n')
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
  assert.match(result.stdout, /plugins: backlog\.md: (?:✓ ready|missing \(bun i -g backlog\.md\)) │ typescript: built-in/)
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

test('groma init creates only AGENTS.md when no instruction file exists', { concurrency: true }, async () => {
  await temporaryRepository(async root => {
    await runInit(root)

    assert.deepEqual((await readdir(root)).sort(), ['AGENTS.md', 'groma'])
    const content = await readFile(path.join(root, 'AGENTS.md'), 'utf8')
    assert.equal(managedBlockCount(content), 1)
    assert.match(content, /This project uses Groma/)
    assert.match(content, /groma agent-instructions.*before planning or changing code/)
    assert.match(content, /Do not edit Groma-owned architecture files directly/)
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
    'init',
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
