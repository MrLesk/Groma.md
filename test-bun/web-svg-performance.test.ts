import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { test } from 'bun:test'

import { mapCss } from '../src/viewers/web/iso/style.ts'
import { repositoryRoot } from './helpers.ts'

interface AppendCall {
  parent: string
  arguments: string
}

function appendCalls(source: string): AppendCall[] {
  const calls: AppendCall[] = []
  const start = /\b(\w+)\.append\(/g
  for (let match = start.exec(source); match !== null; match = start.exec(source)) {
    let depth = 1
    let end = start.lastIndex
    while (depth > 0 && end < source.length) {
      if (source[end] === '(') depth += 1
      if (source[end] === ')') depth -= 1
      end += 1
    }
    calls.push({ parent: match[1]!, arguments: source.slice(start.lastIndex, end - 1) })
    start.lastIndex = end
  }
  return calls
}

function assertFastComposition(source: string): void {
  const calls = appendCalls(source)
  assert.deepEqual(
    calls.filter(call => /\bfield\b/.test(call.arguments)).map(call => call.parent),
    ['fieldSurface'],
    'Append the patterned field beside the moving camera; nesting it causes pan and zoom repaint regressions',
  )
  assert.ok(
    calls.some(call => call.parent === 'root' && call.arguments.replaceAll(/\s/g, '') === 'fieldSurface,camera'),
    'Append the field surface and camera together as map-surface siblings',
  )
  assert.ok(calls.some(call => call.parent === 'camera' && call.arguments.trim() === 'zoom'))
  assert.ok(calls.some(call => call.parent === 'zoom' && call.arguments.trim() === 'scene'))
}

test.concurrent('the patterned grid stays outside the moving SVG camera', async () => {
  assertFastComposition(await readFile(
    path.join(repositoryRoot, 'src/viewers/web/iso/map.ts'),
    'utf8',
  ))
})

test.concurrent('the SVG performance guard rejects a field inside the camera', () => {
  assert.throws(
    () => assertFastComposition('camera.append(field, ...Object.values(layers))\nroot.append(camera)'),
    /Append the patterned field beside the moving camera/,
  )
})

test.concurrent('pan and zoom stay on separate retained composition layers', async () => {
  const source = await readFile(path.join(repositoryRoot, 'src/viewers/web/iso/map.ts'), 'utf8')
  assert.match(
    mapCss,
    /#map \.camera\s*\{[^}]*will-change:\s*transform/,
    'Retain the complete scaled scene while panning instead of repainting its text and routes',
  )
  assert.match(source, /camera\.style\.transform = `translate\(/)
  assert.match(source, /zoom\.style\.transform = `scale\(/)
})
