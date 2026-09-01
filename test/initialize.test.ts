import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import {
  access,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadArchitecture } from '../src/architecture-reader.ts'
import { createArchitectureElement } from '../src/create.ts'
import { initializeGroma } from '../src/initialize.ts'
import { loadProjectProfile } from '../src/project-profile.ts'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const cli = path.join(projectRoot, 'src', 'cli.ts')

function run(args: string[], cwd: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
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
      child.on('close', code => resolve({ code, stdout, stderr }))
    },
  )
}

async function temporaryRepository(
  runTest: (root: string) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-initialize-'))
  try {
    await runTest(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

async function missing(filename: string): Promise<boolean> {
  try {
    await access(filename)
    return false
  } catch {
    return true
  }
}

test('interactive initialization asks for identity and storage before creating Groma', {
  concurrency: true,
}, async () => {
  await temporaryRepository(async root => {
    const asked: string[] = []
    const result = await initializeGroma(root, {}, {
      projectName: async () => {
        asked.push('project-name')
        return 'Visible project'
      },
      directory: async () => {
        asked.push('directory')
        return 'groma'
      },
    })

    assert.deepEqual(asked, ['project-name', 'directory'])
    assert.deepEqual(result, {
      directory: 'groma',
      projectName: 'Visible project',
    })
    assert.deepEqual((await readdir(path.join(root, 'groma'))).sort(), [
      'index.md',
      'missing',
      'observed',
      'plans',
      'project.md',
    ])
    assert.equal((await loadProjectProfile(root))?.title, 'Visible project')
    assert.equal((await loadArchitecture(root)).length, 2)
    assert.match(await readFile(path.join(root, 'AGENTS.md'), 'utf8'), /This project uses Groma/)
  })
})

test('non-interactive initialization creates and uses hidden Groma storage', {
  concurrency: true,
}, async () => {
  await temporaryRepository(async root => {
    const result = await run(
      ['init', 'Hidden project', '--directory', '.groma'],
      root,
    )

    assert.equal(result.code, 0, result.stderr)
    assert.equal(result.stdout, 'ok\n')
    assert.equal(await missing(path.join(root, 'groma')), true)
    assert.equal((await loadProjectProfile(root))?.title, 'Hidden project')
    await createArchitectureElement(root, {
      name: 'Owner',
      observed: true,
      kind: 'actor',
      overview: 'Owns the hidden architecture.',
    })
    const architecture = await loadArchitecture(root)
    assert.equal(
      architecture[0]?.documents[0]?.sourceFilename,
      '.groma/observed/actors/owner.md',
    )
  })
})

test('an existing Groma directory is reused without asking for its location', {
  concurrency: true,
}, async () => {
  await temporaryRepository(async root => {
    await mkdir(path.join(root, '.groma'))
    let askedForName = 0
    await initializeGroma(root, {}, {
      projectName: async () => {
        askedForName += 1
        return 'Existing hidden project'
      },
      directory: async () => {
        throw new Error('directory prompt must not run')
      },
    })
    const project = await readFile(path.join(root, '.groma/project.md'), 'utf8')
    const agents = await readFile(path.join(root, 'AGENTS.md'), 'utf8')

    await initializeGroma(root, {}, {
      projectName: async () => {
        throw new Error('project prompt must not run')
      },
      directory: async () => {
        throw new Error('directory prompt must not run')
      },
    })
    await assert.rejects(
      initializeGroma(root, { directory: 'groma' }),
      /already uses \.groma\//,
    )

    assert.equal(askedForName, 1)
    assert.equal(await readFile(path.join(root, '.groma/project.md'), 'utf8'), project)
    assert.equal(await readFile(path.join(root, 'AGENTS.md'), 'utf8'), agents)
    assert.equal(await missing(path.join(root, 'groma')), true)
  })
})

test('competing Groma directories fail before initialization writes', {
  concurrency: true,
}, async () => {
  await temporaryRepository(async root => {
    await mkdir(path.join(root, 'groma'))
    await mkdir(path.join(root, '.groma'))

    await assert.rejects(
      initializeGroma(root, {
        projectName: 'Ambiguous project',
        directory: 'groma',
      }),
      /Both groma\/ and \.groma\/ exist/,
    )
    assert.equal(await missing(path.join(root, 'AGENTS.md')), true)
    assert.deepEqual(await readdir(path.join(root, 'groma')), [])
    assert.deepEqual(await readdir(path.join(root, '.groma')), [])
  })
})

test('non-interactive initialization requires both explicit values before writing', {
  concurrency: true,
}, async () => {
  await temporaryRepository(async root => {
    await assert.rejects(
      initializeGroma(root, { projectName: 'Missing directory' }),
      /--directory is required/,
    )
    assert.deepEqual(await readdir(root), [])
  })
  await temporaryRepository(async root => {
    await assert.rejects(
      initializeGroma(root, { directory: 'groma' }),
      /project name is required/,
    )
    assert.deepEqual(await readdir(root), [])
  })
})
