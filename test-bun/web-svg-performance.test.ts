import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { test } from 'bun:test'

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
    ['root'],
    'Append the patterned field beside the moving camera; nesting it causes pan and zoom repaint regressions',
  )
  assert.ok(
    calls.some(call => call.parent === 'root' && call.arguments.replaceAll(/\s/g, '') === 'field,camera'),
    'Append the field and camera together as root SVG siblings',
  )
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
