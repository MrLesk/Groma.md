import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { accent, cssBlock, palettes } from '../src/viewers/web/atoms/theme.ts'

function variables(block: string): Map<string, string> {
  return new Map([...block.matchAll(/(--[a-z-]+):\s*([^;]+);/g)].map(match => [match[1]!, match[2]!.trim()]))
}

test.concurrent('light and dark themes declare the same variables and share the accent', () => {
  const light = variables(cssBlock(palettes.light))
  const dark = variables(cssBlock(palettes.dark))
  assert.deepEqual([...dark.keys()], [...light.keys()])
  assert.ok(light.size >= 10)
  assert.equal(light.get('--accent'), accent)
  assert.equal(dark.get('--accent'), accent)
  assert.notEqual(light.get('--paper'), dark.get('--paper'))
})
