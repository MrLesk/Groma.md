import { expect, test } from 'bun:test'
import { cp, mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { exportWebViewer, type WebExportOptions } from '../src/viewers/web/export.ts'
import { createWebDataSource, openWebBoot } from '../src/viewers/web/data.ts'
import type { WebBootPayload } from '../src/viewers/web/payload.ts'

const fixture = path.resolve(import.meta.dir, '../test/fixtures/source-view')
async function publish(root: string, options: WebExportOptions = {}): Promise<WebBootPayload> {
  const output = path.join(root, 'site')
  await (await exportWebViewer(root, output, options)).close()
  let json = ''
  await new HTMLRewriter().on('script#world', { text(chunk) { json += chunk.text } })
    .transform(new Response(await readFile(path.join(output, 'index.html'), 'utf8'))).text()
  return JSON.parse(json)
}

function expectNoWork(payload: WebBootPayload): void {
  expect(payload.work.items).toEqual([])
  expect(payload.pins).toEqual([])
  expect(payload.delivery.kind).toBe('published')
  if (payload.delivery.kind !== 'published') return
  for (const view of payload.delivery.views) {
    expect(view.payload.work.items).toEqual([])
    expect(view.payload.pins).toEqual([])
    expect(Object.keys(view.reads).sort()).toEqual(['code', 'sources'])
  }
}

test.concurrent('working-tree export retains uncommitted source and contains one task-free snapshot', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-export-tree-'))
  try {
    await cp(fixture, root, { recursive: true })
    await writeFile(path.join(root, 'src/orders.ts'), 'export const uncommitted = true\n')
    await mkdir(path.join(root, 'backlog', 'tasks'), { recursive: true })
    await writeFile(path.join(root, 'backlog', 'tasks', 'task-1.md'), 'Private task text must stay outside the export')
    const boot = await publish(root)
    expectNoWork(boot)
    expect(boot.revision).toBeNull()
    expect(boot.revisions).toEqual([])
    expect(boot.delivery.kind === 'published' && boot.delivery.views.length).toBe(1)
    expect(JSON.stringify(boot)).not.toContain('Private task text')
    const data = createWebDataSource(boot)
    expect((await data.readSource('orders', 'src/orders.ts')).source).toContain('uncommitted')
    await expect(data.readTask('TASK-1')).rejects.toThrow()
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('commit export and both comparison directions use only bundled commits independently of checkout', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-export-commits-'))
  const git = async (...args: string[]) => {
    const process = Bun.spawn(['git', ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    const output = await new Response(process.stdout).text()
    expect(await process.exited).toBe(0)
    return output.trim()
  }
  try {
    await cp(fixture, root, { recursive: true })
    await git('init', '--quiet')
    await git('add', '.')
    await git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--quiet', '-m', 'Record orders')
    const before = await git('rev-parse', 'HEAD')
    const oldSource = await readFile(path.join(root, 'src/orders.ts'), 'utf8')
    const newSource = oldSource.replace('return lines', 'return lines + 1')
    await writeFile(path.join(root, 'src/orders.ts'), newSource)
    await git('add', '.')
    await git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--quiet', '-m', 'Include delivery', '-m', 'Count the delivery line.')
    const after = await git('rev-parse', 'HEAD')
    await git('checkout', '--quiet', before)
    await writeFile(path.join(root, 'src/orders.ts'), 'export const localOnly = true\n')
    const single = await publish(root, { revision: after })
    expectNoWork(single)
    expect(single.revision).toMatchObject({ id: after, subject: 'Include delivery', body: 'Count the delivery line.' })
    expect(single.revisions.map(item => item.id)).toEqual([after])
    expect((await createWebDataSource(single).readSource('orders', 'src/orders.ts', after)).source).toBe(newSource)

    const boot = await publish(root, { from: before, revision: after })
    expectNoWork(boot)
    expect(boot.comparison?.from?.id).toBe(before)
    expect(boot.revision?.id).toBe(after)
    expect(boot.revisions.map(item => item.id)).toEqual([before, after])
    expect(boot.comparison?.components.orders).toMatchObject({ status: 'modified', files: [{ status: 'modified', additions: 1, deletions: 1 }] })
    const data = createWebDataSource(boot)
    expect((await data.readWorld(after)).comparison).toBeUndefined()
    expect((await data.readSource('orders', 'src/orders.ts', before)).source).toBe(oldSource)
    const reverse = await data.readWorld(before, after)
    expect(reverse.comparison?.components.orders?.files[0]?.hunks.flatMap(hunk => hunk.lines))
      .toContainEqual(expect.objectContaining({ kind: 'removed', text: '  return lines + 1' }))
    const opened = openWebBoot(boot, { search: `?revision=${before}` })
    expect(opened.comparison).toBeUndefined()
    expect(opened.revision?.id).toBe(before)
    expect(openWebBoot(boot, { search: `?revision=${before}&from=${after}` }).comparison?.from?.id).toBe(after)
    await expect(data.readWorld()).rejects.toThrow()
    await expect(data.readWorld('unbundled')).rejects.toThrow()
    expect(await git('rev-parse', 'HEAD')).toBe(before)
    expect(await readFile(path.join(root, 'src/orders.ts'), 'utf8')).toContain('localOnly')
  } finally { await rm(root, { recursive: true, force: true }) }
})
