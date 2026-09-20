import assert from 'node:assert/strict'
import path from 'node:path'

import { test } from 'bun:test'

import { loadAnnotatedArchitecture } from '../src/core.ts'
import { readView, writeView } from '../src/viewers/web/url.ts'

const fixture = path.resolve(import.meta.dir, '../test/fixtures/empty-project')

test.concurrent('publication paths select a theme before the saved browser preference', async () => {
  const world = await loadAnnotatedArchitecture(fixture)
  for (const theme of ['auto', 'light', 'dark', 'blueprint']) {
    const url = new URL(`https://example.test/repository/architecture/${theme}/`)
    assert.equal(readView(url, world, [], [], 'light').theme, theme)
  }
})

test.concurrent('paths without a publication theme keep the saved browser preference', async () => {
  const world = await loadAnnotatedArchitecture(fixture)
  for (const pathname of ['/', '/repository/', '/repository/architecture/unknown/']) {
    assert.equal(readView(new URL(pathname, 'https://example.test'), world, [], [], 'dark').theme, 'dark')
  }
})

test.concurrent('an explicit query theme overrides the publication path', async () => {
  const world = await loadAnnotatedArchitecture(fixture)
  const url = new URL('https://example.test/repository/architecture/blueprint/?theme=auto')
  assert.equal(readView(url, world, [], [], 'dark').theme, 'auto')
  url.searchParams.set('theme', 'light')
  assert.equal(readView(url, world, [], [], 'dark').theme, 'light')
  url.searchParams.set('theme', 'unknown')
  assert.equal(readView(url, world, [], [], 'dark').theme, 'blueprint')
})

test.concurrent('theme choices survive a shared URL including Auto on a Blueprint path', async () => {
  const world = await loadAnnotatedArchitecture(fixture)
  const url = new URL('https://example.test/repository/architecture/blueprint/')
  const opened = readView(url, world, [], [], 'dark')
  for (const theme of ['auto', 'light', 'dark', 'blueprint'] as const) {
    url.search = writeView({ ...opened, theme }, world, [], url.pathname)
    assert.equal(readView(url, world, [], [], 'dark').theme, theme)
    assert.equal(url.searchParams.get('theme'), theme === 'blueprint' ? null : theme)
  }
})
