import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'
import { EMPTY_WORK_SNAPSHOT, type WorkSource } from '@groma/work-source'
import { loadProjectProfile, saveProjectProfile } from '../src/project-profile.ts'
import { exportWebViewer } from '../src/viewers/web/export.ts'
import { startWebViewer } from '../src/viewers/web/server.ts'
import { sharingMetadata } from '../src/viewers/web/sharing/metadata.ts'

const fixture = path.resolve(import.meta.dir, '../test/fixtures/empty-project')
const mappedFixture = path.resolve(import.meta.dir, '../test/fixtures/source-view')

function emptyWork(): WorkSource {
  return {
    async read() { return EMPTY_WORK_SNAPSHOT },
    async readItem() { throw new Error('No work items') },
    watch() { return { close() {} } },
  }
}

async function headMetadata(html: string): Promise<Map<string, string>> {
  const fields = new Map<string, string>()
  await new HTMLRewriter().on('head meta[property]', { element(element) {
    fields.set(element.getAttribute('property')!, element.getAttribute('content')!)
  } }).transform(new Response(html)).text()
  return fields
}

function assertCover(bytes: Buffer): void {
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  assert.equal(bytes.readUInt32BE(16), 1200)
  assert.equal(bytes.readUInt32BE(20), 630)
}

test.concurrent('export writes the themed image referenced by its initial sharing metadata', async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'groma-sharing-export-'))
  try {
    const exported = await exportWebViewer(mappedFixture, output, {
      url: 'https://example.test/repository/architecture/blueprint', workSource: emptyWork(),
    })
    await exported.close()
    const fields = await headMetadata(await readFile(path.join(output, 'index.html'), 'utf8'))
    assert.equal(fields.get('og:url'), 'https://example.test/repository/architecture/blueprint/')
    assert.equal(fields.get('og:image'), 'https://example.test/repository/architecture/blueprint/cover-blueprint.png')
    assert.equal(fields.get('og:type'), 'website')
    assert.equal(fields.get('og:image:type'), 'image/png')
    assert.equal(fields.get('og:image:width'), '1200')
    assert.equal(fields.get('og:image:height'), '630')
    assert.ok(fields.get('og:image:alt'))
    assert.equal(fields.has('og:description'), false)
    for (const theme of ['light', 'dark', 'blueprint']) {
      assertCover(await readFile(path.join(output, `cover-${theme}.png`)))
    }
  } finally {
    await rm(output, { recursive: true, force: true })
  }
})

test.concurrent('live initial metadata uses the project profile and links to a theme-matched PNG', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-sharing-live-'))
  let viewer: Awaited<ReturnType<typeof startWebViewer>> | undefined
  try {
    await cp(fixture, root, { recursive: true })
    const project = await loadProjectProfile(root)
    await saveProjectProfile(root, { ...project!, title: 'Shared project', description: 'Tracks submitted requests.' })
    viewer = await startWebViewer(root, { port: 0, workSource: emptyWork() })
    for (const theme of ['light', 'dark', 'blueprint']) {
      const url: string = `${viewer.url}/?theme=${theme}`
      const fields = await headMetadata(await (await fetch(url)).text())
      assert.equal(fields.get('og:title'), 'Shared project')
      assert.equal(fields.get('og:description'), 'Tracks submitted requests.')
      assert.equal(fields.get('og:url'), url)
      assert.equal(fields.get('og:image'), `${viewer.url}/cover-${theme}.png`)
      const image = await fetch(fields.get('og:image')!)
      assert.equal(image.headers.get('content-type'), 'image/png')
      assertCover(Buffer.from(await image.arrayBuffer()))
    }
  } finally {
    await viewer?.close()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('Auto shares a light cover without inventing an unauthored project description', async () => {
  const project = await loadProjectProfile(fixture)
  const fields = await headMetadata(`<html><head>${sharingMetadata(project!, new URL('https://example.test/architecture/auto/'))}</head></html>`)
  assert.equal(fields.get('og:image'), 'https://example.test/architecture/auto/cover-light.png')
  assert.equal(fields.has('og:description'), false)
})
