import { expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { EMPTY_WORK_SNAPSHOT } from '@groma/work-source'
import { createWebMapSession } from '../src/viewers/web/map-session.ts'
import type { WebPayload, WebRevision } from '../src/viewers/web/payload.ts'
import { listGromaRevisions } from '../src/history/revisions.ts'

test.concurrent('web history includes source-only commits and reads the selected snapshot without changing checkout', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-web-revisions-'))
  const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', ...args], { cwd: root, encoding: 'utf8' }).trim()
  let session: Awaited<ReturnType<typeof createWebMapSession>> | undefined
  try {
    git('init', '--quiet')
    await writeFile(path.join(root, 'README.md'), 'No architecture yet')
    git('add', '.')
    git('commit', '--quiet', '-m', 'Before architecture')
    const unsupported = git('rev-parse', 'HEAD')
    await cp(path.resolve(import.meta.dir, '../test/fixtures/source-view'), root, { recursive: true })
    git('add', '.')
    git('commit', '--quiet', '-m', 'Architecture snapshot')
    const before = git('rev-parse', 'HEAD')
    const original = await readFile(path.join(root, 'src/orders.ts'), 'utf8')
    const source = 'export const receipt = "changed source"\n'
    await writeFile(path.join(root, 'src/orders.ts'), source)
    git('add', '.')
    git('commit', '--quiet', '-m', 'Source-only receipt update', '-m', 'The architecture is unchanged.')
    const after = git('rev-parse', 'HEAD')
    const terminalHistory = await listGromaRevisions(root)
    expect(terminalHistory.map(revision => revision.id)).toEqual([before])
    expect(terminalHistory[0]?.compatible).toBe(true)
    session = await createWebMapSession(root, { scan: false, workSource: {
      async read() { return EMPTY_WORK_SNAPSHOT },
      async readItem() { throw new Error('No task') },
      watch() { return { close() {} } },
    } })
    const request = (url: string) => session!.fetch(new Request(`http://localhost${url}`))
    const revisions = await (await request('/revisions.json')).json() as WebRevision[]
    expect(revisions.map(revision => revision.id)).toEqual([after, before, unsupported])
    expect(revisions[0]?.body).toBe('The architecture is unchanged.')
    const selected = await (await request(`/world.json?revision=${before}`)).json() as WebPayload
    const component = selected.world.elements.find(element => element.kind === 'component')!
    expect(selected.revision?.id).toBe(before)
    expect(selected.work.items).toEqual([])
    const query = new URLSearchParams({ element: component.representationId, file: 'src/orders.ts' })
    const oldSource = await (await request(`/source.json?${query}&revision=${before}`)).json()
    const newSource = await (await request(`/source.json?${query}&revision=${after}`)).json()
    expect(oldSource.source).toBe(original)
    expect(newSource.source).toBe(source)
    expect((await request(`/world.json?revision=${unsupported}`)).status).toBe(422)
    expect(git('rev-parse', 'HEAD')).toBe(after)
    expect(git('status', '--porcelain')).toBe('')
  } finally {
    await session?.close()
    await rm(root, { recursive: true, force: true })
  }
})
