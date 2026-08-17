import { expect, test } from 'bun:test'

import * as theme from '../src/viewers/web/atoms/theme.ts'

test.concurrent('setPalette swaps the live color bindings', () => {
  expect(theme.paper).toBe(theme.palettes.light.paper)
  theme.setPalette(theme.palettes.dark)
  try {
    expect(theme.paper).toBe(theme.palettes.dark.paper)
    expect(theme.ink).toBe(theme.palettes.dark.ink)
    expect(theme.shadowInk).toBe(theme.palettes.dark.shadowInk)
  } finally {
    theme.setPalette(theme.palettes.light)
  }
  expect(theme.ink).toBe(theme.palettes.light.ink)
})
