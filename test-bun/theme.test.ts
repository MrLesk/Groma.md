import { expect, test } from 'bun:test'
import { resolveTheme } from '../src/viewers/web/atoms/theme.ts'
import { readSavedTheme } from '../src/viewers/web/chrome/theme-control.ts'

test.concurrent('Auto follows the browser while explicit themes do not', () => {
  expect(resolveTheme('auto', false)).toBe('light')
  expect(resolveTheme('auto', true)).toBe('dark')
  expect(resolveTheme('light', true)).toBe('light')
  expect(resolveTheme('dark', false)).toBe('dark')
  expect(resolveTheme('blueprint', true)).toBe('blueprint')
})

test.concurrent('a saved theme is restored while missing or invalid values use Auto', () => {
  const stored = (value: string | null) => ({ getItem: (_key: string) => value })
  expect(readSavedTheme(stored('blueprint'))).toBe('blueprint')
  expect(readSavedTheme(stored(null))).toBe('auto')
  expect(readSavedTheme(stored('unknown'))).toBe('auto')
})
