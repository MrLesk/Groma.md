import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { RGBA } from '@opentui/core'
import { createTestRenderer } from '@opentui/core/testing'

import { ACCENT, viewerTheme } from '../src/viewers/tui/atoms/theme.ts'
import { mountTerminalViewer } from '../src/viewers/tui/terminal-viewer.ts'
import { navigationWorld } from './helpers.ts'

test.concurrent('every viewer colour is a terminal intent except the brand green', () => {
  const theme = viewerTheme()
  for (const [name, colour] of Object.entries(theme)) {
    if (name === 'selected') {
      assert.equal(colour.intent, 'rgb')
      assert.deepEqual(colour.toInts().slice(0, 3), RGBA.fromHex(ACCENT).toInts().slice(0, 3))
    } else {
      assert.ok(colour.intent === 'default' || colour.intent === 'indexed', `${name} is ${colour.intent}`)
    }
  }
})

test.concurrent('mounting the viewer never samples the terminal palette', async () => {
  const setup = await createTestRenderer({ width: 120, height: 36 })
  setup.renderer.getPalette = () => assert.fail('the viewer asked the terminal for its palette')
  const app = mountTerminalViewer(setup.renderer, navigationWorld())
  await setup.renderOnce()
  assert.match(setup.captureCharFrame(), /groma/)
  app.destroy()
})
