import { isThemeMode, resolveTheme, themeLabel, type WebThemeMode } from '../atoms/theme.ts'
import { createThemeTransition } from './motion.ts'

const THEME_STORAGE_KEY = 'groma.theme'

export interface ThemeControl {
  readonly mode: WebThemeMode
}

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>

/** Returns the user's saved choice, or Auto for a browser profile that has no valid choice yet. */
export function readSavedTheme(storage: Pick<Storage, 'getItem'>): WebThemeMode {
  const saved = storage.getItem(THEME_STORAGE_KEY)
  return isThemeMode(saved) ? saved : 'auto'
}

/** Owns the theme dropdown, saved choice and browser preference behind Auto. */
export function bindThemeControl(
  control: HTMLDetailsElement,
  initial: WebThemeMode,
  onChange: () => void,
  storage: ThemeStorage = localStorage,
  preference: MediaQueryList = matchMedia('(prefers-color-scheme: dark)'),
): ThemeControl {
  const label = control.querySelector<HTMLElement>('.label')!
  const transition = createThemeTransition(document.body)
  let mode = initial

  const applyTheme = (): void => {
    const theme = resolveTheme(mode, preference.matches)
    control.dataset.themeMode = mode
    label.textContent = themeLabel(mode)
    for (const option of control.querySelectorAll<HTMLElement>('.theme-option')) {
      option.setAttribute('aria-current', String(option.dataset.themeMode === mode))
    }
    if (theme === 'light') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
  }

  control.addEventListener('click', event => {
    const option = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('.theme-option[data-theme-mode]')
      : null
    if (option === null || !control.contains(option)) return
    const selected = option.dataset.themeMode
    if (!isThemeMode(selected)) return
    control.removeAttribute('open')
    option.blur()
    storage.setItem(THEME_STORAGE_KEY, selected)
    if (selected === mode) {
      onChange()
      return
    }
    transition(() => {
      mode = selected
      applyTheme()
      onChange()
    })
  })

  document.addEventListener('pointerdown', event => {
    if (!control.hasAttribute('open') || !(event.target instanceof Node) || control.contains(event.target)) return
    control.removeAttribute('open')
  })

  preference.addEventListener('change', () => {
    if (mode === 'auto') transition(applyTheme)
  })

  applyTheme()
  return {
    get mode() {
      return mode
    },
  }
}
