import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { accent, cssBlock, nextTheme, palettes, themeLabel } from '../src/viewers/web/atoms/theme.ts'

function variables(block: string): Map<string, string> {
  return new Map([...block.matchAll(/(--[a-z-]+):\s*([^;]+);/g)].map(match => [match[1]!, match[2]!.trim()]))
}

test.concurrent('all themes declare the same variables and share brand signals', () => {
  const light = variables(cssBlock(palettes.light))
  const dark = variables(cssBlock(palettes.dark))
  const blueprint = variables(cssBlock(palettes.blueprint))
  assert.deepEqual([...dark.keys()], [...light.keys()])
  assert.deepEqual([...blueprint.keys()], [...light.keys()])
  assert.ok(light.size >= 10)
  for (const theme of [light, dark, blueprint]) {
    assert.equal(theme.get('--accent'), accent)
  }
  assert.notEqual(light.get('--paper'), dark.get('--paper'))
  assert.notEqual(dark.get('--paper'), blueprint.get('--paper'))
})

test.concurrent('the theme control cycles light, dark, blueprint, then light', () => {
  assert.equal(nextTheme('light'), 'dark')
  assert.equal(nextTheme('dark'), 'blueprint')
  assert.equal(nextTheme('blueprint'), 'light')
  assert.equal(themeLabel(nextTheme('dark')), 'Blueprint')
})
