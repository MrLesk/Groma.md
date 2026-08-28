export const motionCss = `
  #theme-fade {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: var(--paper);
    opacity: 0;
    pointer-events: none;
  }
`

function reducedMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Gives an existing map control brief feedback without moving its button. */
export function animateControl(control: HTMLElement, kind: 'fit' | 'zoom'): void {
  if (reducedMotion()) return
  const mark = control.querySelector<HTMLElement>('.control-icon, .control-glyph') ?? control
  for (const running of mark.getAnimations()) running.cancel()
  mark.animate(
    kind === 'fit'
      ? [{ transform: 'scale(1)' }, { transform: 'scale(0.72)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }]
      : [{ transform: 'scale(1)' }, { transform: 'scale(1.24)' }, { transform: 'scale(1)' }],
    { duration: kind === 'fit' ? 220 : 150, easing: 'ease-out' },
  )
}

/** Fades through the current paper colour and applies the new theme while hidden. */
export function createThemeTransition(host: HTMLElement): (apply: () => void) => void {
  const fade = document.createElement('div')
  fade.id = 'theme-fade'
  host.append(fade)
  let active = false
  return apply => {
    if (active) return
    if (reducedMotion()) {
      apply()
      return
    }
    active = true
    const cover = fade.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 90,
      easing: 'ease-in',
      fill: 'forwards',
    })
    cover.finished.then(() => {
      apply()
      cover.cancel()
      const reveal = fade.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 140,
        easing: 'ease-out',
      })
      reveal.finished.then(() => {
        active = false
      })
    })
  }
}
