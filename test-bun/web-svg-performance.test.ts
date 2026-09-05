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
  assert.ok(calls.some(call => call.parent === 'camera' && /paintSurfaces\.map/.test(call.arguments)))
  assert.ok(calls.some(call => call.parent === 'surface' && call.arguments.trim() === 'scene'))
  assert.ok(calls.some(call => call.parent === 'scene' && call.arguments.trim() === 'world'))
  assert.ok(calls.some(call => call.parent === 'world' && call.arguments.trim() === '...layers'))
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
  )
})

test.concurrent('one temporary motion layer always commits back to an untransformed SVG camera', async () => {
  const source = await readFile(path.join(repositoryRoot, 'src/viewers/web/iso/map.ts'), 'utf8')
  assert.doesNotMatch(mapCss, /#map \.camera\s*\{[^}]*will-change:\s*transform/)
  assert.doesNotMatch(mapCss, /#map \.zoom/)
  assert.match(source, /world\.setAttribute\('transform', `translate\(/)
  assert.match(source, /camera\.style\.transform = `translate\(\$\{x\}px, \$\{y\}px\) scale\(\$\{ratio\}\)`/)
  assert.match(source, /host\.addEventListener\('wheel'/)
  assert.match(source, /root\.addEventListener\('pointerdown'/)
  assert.match(source, /\{ capture: true, passive: true \}/)
  assert.match(source, /camera\.style\.willChange = 'transform'/)
  assert.match(source, /camera\.style\.removeProperty\('transform'\)/)
  assert.match(source, /camera\.style\.removeProperty\('will-change'\)/)
})

test.concurrent('arrowheads stay in map geometry while pins keep fixed screen geometry', async () => {
  const [map, pins] = await Promise.all([
    readFile(path.join(repositoryRoot, 'src/viewers/web/iso/map.ts'), 'utf8'),
    readFile(path.join(repositoryRoot, 'src/viewers/web/work/pins.ts'), 'utf8'),
  ])
  assert.doesNotMatch(mapCss, /--arrow-scale/)
  assert.doesNotMatch(map, /--arrow-scale/)
  assert.match(pins, /node\.style\.translate = `\$\{anchor\.x \* camera\.k\}px \$\{anchor\.y \* camera\.k\}px`/)
  assert.doesNotMatch(pins, /node\.style\.(?:left|top) = `\$\{anchor\.[xy] \* camera\.k\}/)
})
