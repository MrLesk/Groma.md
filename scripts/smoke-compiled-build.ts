import { spawn, type ChildProcess } from 'node:child_process'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const [binaryArgument, expectedVersion] = process.argv.slice(2)
if (binaryArgument === undefined || expectedVersion === undefined) {
  throw new Error('usage: bun scripts/smoke-compiled-build.ts <binary> <version>')
}

const binary = path.resolve(binaryArgument)
const fixture = (name: string) => fileURLToPath(new URL(`../test/fixtures/${name}`, import.meta.url))

function run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.once('error', reject)
    child.once('close', code => resolve({ code: code ?? 1, stdout, stderr }))
  })
}

async function availablePort(): Promise<number> {
  const reservation = Bun.serve({ port: 0, fetch: () => new Response() })
  const { port } = reservation
  await reservation.stop(true)
  if (port === undefined) throw new Error('expected an ephemeral port')
  return port
}

function waitForClose(child: ChildProcess): Promise<number> {
  return new Promise(resolve => child.once('close', code => resolve(code ?? 1)))
}

async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.killed) return
  child.kill()
  await Promise.race([
    waitForClose(child),
    new Promise<void>(resolve => setTimeout(resolve, 5_000)),
  ])
}

async function setupError(url: string): Promise<string | undefined> {
  const page = await fetch(url)
  return /<p class="error"[^>]*>(.*?)<\/p>/s.exec(await page.text())?.[1]
}

async function readyMap(url: string): Promise<void> {
  const deadline = Date.now() + 60_000
  let last = 'groma web did not become ready'
  while (Date.now() < deadline) {
    try {
      const ready = await fetch(`${url}/ready`)
      if (ready.status === 204) return
      last = await setupError(url) ?? await ready.text() ?? `HTTP ${ready.status}`
    } catch (error) {
      last = error instanceof Error ? error.message : String(error)
    }
    await Bun.sleep(100)
  }
  throw new Error(last)
}

/** The embedded TypeScript worker must derive the callback relationship the checker sees in `operation-wiring`. */
async function assertDerivedRelationship(url: string): Promise<void> {
  const world = await fetch(`${url}/world.json`)
  const body = await world.text()
  assert.equal(world.status, 200, body)
  const payload = JSON.parse(body) as { world: { relationships: { connections?: { source: string; target: string }[] }[] } }
  const connections = payload.world.relationships.flatMap(relationship => relationship.connections ?? [])
  assert.ok(
    connections.some(connection => connection.source === 'src/worker.ts' && connection.target === 'src/provider.ts'),
    `expected the worker → provider connection in ${JSON.stringify(connections)}`,
  )
}

/** A project without `node_modules/@typescript`, so the binary must bring its own TypeScript worker. */
async function smokeWeb(): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-smoke-web-'))
  let child: ChildProcess | undefined
  try {
    await cp(fixture('empty-project'), root, { recursive: true })
    await mkdir(path.join(root, 'src'))
    await cp(fixture('operation-wiring'), path.join(root, 'src'), { recursive: true })
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', bin: 'src/caller.ts' }))
    const git = spawn('git', ['init', '--quiet'], { cwd: root, stdio: 'ignore' })
    assert.equal(await waitForClose(git), 0)
    const port = await availablePort()
    child = spawn(binary, ['web', '--port', String(port)], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    child.stderr?.on('data', chunk => { stderr += String(chunk) })
    let ready = false
    const closed = waitForClose(child).then(code => {
      if (!ready) throw new Error(`groma web exited ${code}\n${stderr}`)
    })
    await Promise.race([
      readyMap(`http://127.0.0.1:${port}`).then(async () => {
        await assertDerivedRelationship(`http://127.0.0.1:${port}`)
        ready = true
      }),
      closed,
    ])
  } finally {
    if (child !== undefined) await stop(child)
    await rm(root, { recursive: true, force: true })
  }
}

const version = await run(['--version'])
assert.equal(version.code, 0, version.stderr)
assert.equal(version.stdout.trim(), expectedVersion)

const help = await run(['--help'])
assert.equal(help.code, 0, help.stderr)
assert.match(help.stdout, /Usage:.*groma/s)

await smokeWeb()
