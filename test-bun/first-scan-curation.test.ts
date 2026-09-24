import assert from 'node:assert/strict'
import { test } from 'bun:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { writeTree } from '../test/cli-helpers.ts'
import { firstScanAgentNote, initializeAgentInstructions } from '../src/agent-instructions.ts'
import { awaitsCuration, firstScanHint, firstScanTitle } from '../src/empty-world.ts'
import { emptyState } from '../src/viewers/web/chrome/empty.ts'
import type { WebBootPayload } from '../src/viewers/web/payload.ts'
import { box, worldOf } from './helpers.ts'

const unit = { x: 0, y: 0, width: 1, height: 1 }
const cli = path.resolve(import.meta.dir, '../src/cli.ts')

function firstScan() {
  return worldOf([
    box('shop', 'system', unit, { children: ['observed:app'] }),
    box('app', 'container', unit, { parent: 'observed:shop', children: ['observed:cart'] }),
    box('cart', 'component', unit, { parent: 'observed:app', code: [{ scanner: 'fixture', file: 'src/cart.ts' }] }),
  ])
}

function withProse(prose: { description?: string; overview?: string }) {
  const world = firstScan()
  return { ...world, elements: world.elements.map(element => element.id === 'cart' ? { ...element, ...prose } : element) }
}

function notice(world: ReturnType<typeof firstScan>, revision: string | null = null): string {
  return emptyState({ revision, world, project: undefined } as unknown as WebBootPayload)
}

test.concurrent('a map is a first scan until any element gets a description or an overview', () => {
  assert.equal(awaitsCuration(firstScan()), true)
  assert.equal(awaitsCuration(withProse({ description: 'Holds what a customer wants to buy' })), false)
  assert.equal(awaitsCuration(withProse({ overview: 'The cart prices its lines.' })), false)
  assert.equal(awaitsCuration(worldOf([])), false)
  assert.equal(awaitsCuration(worldOf([box('shop', 'system', unit)])), false)
})

test.concurrent('the browser shows the first-scan notice only on a live first scan', () => {
  const shown = notice(firstScan())
  assert.match(shown, /<section id="empty" aria-label="Map notice" class="has-architecture first-scan">/)
  assert.ok(shown.includes(`<h1>${firstScanTitle}</h1>`))
  assert.ok(shown.includes(`<p class="hint">${firstScanHint}</p>`))
  assert.match(notice(withProse({ description: 'Holds what a customer wants to buy' })), /<section id="empty"[^>]* hidden>/)
  assert.match(notice(firstScan(), 'a1b2c3'), /<section id="empty"[^>]* hidden>/)
})

test.concurrent('setup tells agents to ask before curating a first scan', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-first-scan-agents-'))
  try {
    await initializeAgentInstructions(root)
    assert.ok((await readFile(path.join(root, 'AGENTS.md'), 'utf8'))
      .includes('When it reports a first scan, ask the user whether they want you to curate the architecture.'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a scan and the agent guide index point to curation while nobody has curated the scan', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-first-scan-cli-'))
  const component = (prose: string) => `---\ntype: C4 Component\ntitle: Cart\nstatus: stable\ngroma:\n  id: cart\n  parent: app\n  code:\n    - scanner: fixture\n      file: src/cart.ts\n${prose}---\n`
  const run = async (...args: string[]) => {
    const child = Bun.spawn([process.execPath, cli, ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    await child.exited
    return new Response(child.stdout).text()
  }
  try {
    await writeTree(root, {
      'groma/index.md': '---\nokf_version: "0.2"\n---\n',
      'groma/project.md': '---\ntype: Groma Project\ntitle: Shop\ngroma:\n  profile: architecture\n---\n\nArchitecture for Shop.\n',
      'groma/scanners.json': '{ "scanners": [] }\n',
      'groma/systems/shop/system.md': '---\ntype: C4 System\ntitle: Shop\nstatus: stable\ngroma:\n  id: shop\n---\n',
      'groma/systems/shop/containers/app/container.md': '---\ntype: C4 Container\ntitle: app\nstatus: stable\ngroma:\n  id: app\n  parent: shop\n---\n',
      'groma/systems/shop/containers/app/components/cart.md': component(''),
      'src/cart.ts': 'export const cart = []\n',
    })
    const guide = await run('agent-instructions')
    assert.ok(guide.startsWith(`${firstScanAgentNote}\n\n# groma.md agent guides`))
    assert.ok(!(await run('agent-instructions', 'inspect')).includes(firstScanAgentNote))
    assert.ok((await run('scan')).includes(`${firstScanTitle}. ${firstScanHint}`))

    await writeTree(root, { 'groma/systems/shop/containers/app/components/cart.md': component('description: Holds what a customer wants to buy\n') })
    assert.ok((await run('agent-instructions')).startsWith('# groma.md agent guides'))
    assert.ok(!(await run('scan')).includes(firstScanTitle))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
