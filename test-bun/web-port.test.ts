import assert from 'node:assert/strict'
import { cp, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'
import { EMPTY_WORK_SOURCE } from '@groma/work-source'

import { startWebViewer } from '../src/viewers/web/server.ts'
import { repositoryRoot } from './helpers.ts'

const startupError = 'bind failed with runtime detail'

/** Each child owns its module mocks and terminal state, so concurrent tests stay isolated. */
async function failedStartup(options: { port?: number; interactive?: boolean; accepted?: boolean }) {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-port-choice-'))
  const cli = path.join(repositoryRoot, 'src', 'cli.ts')
  const args = options.port === undefined ? ['web'] : ['web', '--port', String(options.port)]
  const script = `
    import { mock } from 'bun:test'
    const attempts = [], prompts = [], messages = []
    console.log = message => messages.push(message)
    Object.defineProperty(process.stdin, 'isTTY', { value: ${options.interactive === true} })
    Object.defineProperty(process.stdout, 'isTTY', { value: ${options.interactive === true} })
    mock.module(${JSON.stringify(path.join(repositoryRoot, 'src/viewers/web/server.ts'))}, () => ({
      startWebViewer: async (_root, options) => {
        attempts.push(options.port ?? 4747)
        if (attempts.length <= 2) {
          throw Object.assign(new Error(${JSON.stringify(startupError)}), { code: 'EADDRINUSE' })
        }
        const url = 'http://localhost:' + options.port
        options.onListening?.(url)
        return { url }
      },
    }))
    const clack = await import(${JSON.stringify(import.meta.resolve('@clack/prompts'))})
    mock.module(${JSON.stringify(import.meta.resolve('@clack/prompts'))}, () => ({
      ...clack,
      confirm: async options => {
        prompts.push(options.message)
        return ${options.accepted === true}
      },
    }))
    await import(${JSON.stringify(cli)})
    process.stdout.write(JSON.stringify({ attempts, prompts, messages }))
  `
  try {
    const launcher = path.join(root, 'startup.ts')
    await writeFile(launcher, script)
    const child = Bun.spawn([process.execPath, launcher, ...args], {
      cwd: root, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
    })
    const [exit, output, error] = await Promise.all([
      child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
    ])
    assert.ok(output, error)
    const result = JSON.parse(output) as { attempts: number[]; prompts: string[]; messages: string[] }
    return { exit, error, ...result }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

for (const interactive of [false, true]) {
  test.concurrent(`failed port 0 preserves the runtime error without another choice (interactive: ${interactive})`, async () => {
    const result = await failedStartup({ port: 0, interactive, accepted: true })
    assert.equal(result.exit, 1)
    assert.equal(result.error.trim(), startupError)
    assert.deepEqual(result.attempts, [0])
    assert.deepEqual(result.prompts, [])
    assert.deepEqual(result.messages, [])
  })
}

for (const port of [undefined, 5000]) {
  test.concurrent(`noninteractive failed port ${port ?? 'default'} preserves the error and available-port choice`, async () => {
    const result = await failedStartup({ port })
    assert.equal(result.exit, 1)
    assert.ok(result.error.includes(startupError))
    assert.ok(result.error.includes('groma web --port 0'))
    assert.deepEqual(result.attempts, [port ?? 4747])
    assert.deepEqual(result.prompts, [])
  })
}

for (const accepted of [false, true]) {
  test.concurrent(`interactive concrete-port retry requires consent (accepted: ${accepted})`, async () => {
    const result = await failedStartup({ port: 5000, interactive: true, accepted })
    assert.equal(result.exit, 0)
    assert.equal(result.error, '')
    assert.equal(result.prompts.length, 1)
    assert.ok(result.prompts[0]!.includes(startupError))
    assert.deepEqual(result.attempts, accepted ? [5000, 5001, 5002] : [5000])
    assert.equal(result.messages.length, accepted ? 1 : 0)
    if (accepted) assert.ok(result.messages[0]!.includes('http://localhost:5002'))
  })
}

async function repository(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-busy-port-'))
  for (const fixture of ['empty-project', 'startup-source']) {
    await cp(path.join(repositoryRoot, 'test', 'fixtures', fixture), root, { recursive: true })
  }
  const git = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'ignore' })
  assert.equal(await git.exited, 0)
  return root
}

test.concurrent('a busy Web port fails before scanning or starting live subscriptions', async () => {
  const root = await repository()
  const holder = Bun.serve({ port: 0, fetch: () => new Response('occupied') })
  let workStarted = false
  try {
    const before = await readdir(path.join(root, 'groma'), { recursive: true })
    await assert.rejects(startWebViewer(root, {
      port: holder.port,
      scan: true,
      workSource: {
        ...EMPTY_WORK_SOURCE,
        watch: () => { workStarted = true; return { close() {} } },
      },
    }), { code: 'EADDRINUSE' })
    assert.equal(workStarted, false)
    assert.deepEqual(await readdir(path.join(root, 'groma'), { recursive: true }), before)
    assert.equal(await (await fetch(holder.url)).text(), 'occupied')
  } finally {
    await holder.stop(true)
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('noninteractive Web startup on a busy port exits with an available-port command', async () => {
  const root = await repository()
  const holder = Bun.serve({ port: 0, fetch: () => new Response('occupied') })
  try {
    const child = Bun.spawn([
      process.execPath, path.join(repositoryRoot, 'src', 'cli.ts'), 'web', '--port', String(holder.port),
    ], { cwd: root, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
    const [exit, output, error] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    assert.equal(exit, 1)
    assert.equal(output, '')
    assert.ok(error.includes('groma web --port 0'))
    assert.equal(await (await fetch(holder.url)).text(), 'occupied')
  } finally {
    await holder.stop(true)
    await rm(root, { recursive: true, force: true })
  }
})
