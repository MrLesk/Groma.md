import { expect, test } from 'bun:test'
import { nextTheme } from '../src/viewers/web/atoms/theme.ts'

test.concurrent('the theme control cycles light, dark, blueprint, then light', () => {
  expect(nextTheme('light')).toBe('dark')
  expect(nextTheme('dark')).toBe('blueprint')
  expect(nextTheme('blueprint')).toBe('light')
})
