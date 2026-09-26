export const motionCss = `
  #theme-fade {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: color-mix(in srgb, var(--paper) 85%, transparent);
    opacity: 0;
    pointer-events: none;
  }
`

function reducedMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Rotates a repainted disclosure from its previous state into its current one. */
export function animateDisclosure(chevron: HTMLElement, expanded: boolean): void {
  if (reducedMotion()) return
  chevron.animate([
    { transform: `rotate(${expanded ? -45 : 45}deg)` },
    { transform: `rotate(${expanded ? 45 : -45}deg)` },
  ], { duration: 180, easing: 'ease-out' })
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

/** Softens theme changes with a translucent wash of the current paper colour. */
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

/** Comparison content and counters enter with the same timing as the surrounding chrome. */
export function animateContent(host: HTMLElement): void {
  if (reducedMotion()) return
  const style = getComputedStyle(host)
  host.animate([{ opacity: 0, transform: 'translateY(3px)' }, { opacity: 1, transform: 'translateY(0)' }], {
    duration: Number.parseFloat(style.getPropertyValue('--chrome-motion')),
    easing: style.getPropertyValue('--chrome-ease').trim(),
  })
}

/** Tree rows enter or leave in place, so neighboring rows move with the disclosure. */
export function animateRow(row: HTMLElement, entering: boolean, height: number): void {
  if (reducedMotion()) { if (!entering) row.remove(); return }
  const style = getComputedStyle(row)
  const open = { height: `${height}px`, paddingTop: style.paddingTop, paddingBottom: style.paddingBottom, opacity: 1 }
  const closed = { height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0 }
  row.style.overflow = 'hidden'
  row.style.boxSizing = 'border-box'
  const animation = row.animate(entering ? [closed, open] : [open, closed], {
    duration: Number.parseFloat(style.getPropertyValue('--chrome-motion')),
    easing: style.getPropertyValue('--chrome-ease').trim(),
  })
  animation.onfinish = () => { if (!entering) row.remove() }
}
