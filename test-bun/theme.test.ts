import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { accent, cssBlock, nextTheme, onColour, palettes, themeLabel } from '../src/viewers/web/atoms/theme.ts'
import { PIN_COLOURS } from '../src/work/pins.ts'

function luminance(hex: string): number {
  const channels = hex.match(/[\da-f]{2}/gi)!.map(value => Number.parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
}

function contrast(left: string, right: string): number {
  const [lighter, darker] = [luminance(left), luminance(right)].sort((a, b) => b - a)
  return (lighter! + 0.05) / (darker! + 0.05)
}

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

test.concurrent('every text token and coloured work surface meets normal-text contrast', () => {
  for (const palette of Object.values(palettes)) {
    assert.ok(contrast(palette.ink, palette.paper) >= 4.5)
    assert.ok(contrast(palette.muted, palette.paper) >= 4.5)
    assert.ok(contrast(palette.accentText, palette.paper) >= 4.5)
  }
  assert.ok(contrast(onColour, accent) >= 4.5)
  for (const colour of PIN_COLOURS) assert.ok(contrast(onColour, colour) >= 4.5)
})

test.concurrent('the theme control cycles light, dark, blueprint, then light', () => {
  assert.equal(nextTheme('light'), 'dark')
  assert.equal(nextTheme('dark'), 'blueprint')
  assert.equal(nextTheme('blueprint'), 'light')
  assert.equal(themeLabel(nextTheme('dark')), 'Blueprint')
})
