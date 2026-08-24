import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { normalizeTerminalPalette, rgbToHex } from '@opentui/core'

import { themeFromPalette } from '../src/viewers/tui/atoms/theme.ts'

test.concurrent('the terminal map uses neutral palette mixes and one green accent', () => {
  const palette = normalizeTerminalPalette()
  const theme = themeFromPalette(palette)
  assert.equal(rgbToHex(theme.selected), rgbToHex(palette.palette[2]))

  for (const color of [
    theme.observed,
    theme.planned,
    theme.missing,
    theme.actor,
    theme.system,
    theme.container,
    theme.component,
    theme.observedTint,
  ]) {
    const [red, green, blue] = color.toInts()
    assert.equal(red, green)
    assert.equal(green, blue)
    assert.notEqual(rgbToHex(color), rgbToHex(theme.selected))
  }
})
