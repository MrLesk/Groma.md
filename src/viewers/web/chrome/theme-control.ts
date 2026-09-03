import { nextTheme, themeLabel, type WebTheme } from '../atoms/theme.ts'
import { createThemeTransition } from './motion.ts'

export interface ThemeControl {
  readonly current: WebTheme
}

/** The header button cycles the theme; the document attribute and the button label follow it. */
export function bindThemeControl(
  button: HTMLElement,
  initial: WebTheme,
  onChange: () => void,
): ThemeControl {
  const label = button.querySelector<HTMLElement>('.label')!
  let theme = initial
  const paint = (): void => {
    const next = nextTheme(theme)
    button.dataset.nextTheme = next
    label.textContent = themeLabel(next)
    if (theme === 'light') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
  }
  const transition = createThemeTransition(document.body)
  button.addEventListener('click', () => transition(() => {
    theme = nextTheme(theme)
    paint()
    onChange()
  }))
  paint()
  return {
    get current() {
      return theme
    },
  }
}
