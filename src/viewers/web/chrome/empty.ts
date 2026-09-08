import { hasComponents, isEmptyWorld, noComponentsHint, noComponentsTitle, scannerSupportNote } from '../../../empty-world.ts'
import type { ProjectProfile } from '../../../project-profile.ts'
import type { ArchitectureGraph } from '../../../types.ts'
import { escaped } from '../atoms/escape.ts'
import type { WebBootPayload } from '../payload.ts'

export const emptyStateCss = `
  #empty { position: fixed; inset: 0; z-index: 2; display: grid; place-items: center; pointer-events: none; }
  #empty[hidden] { display: none; }
  #empty .empty-card {
    pointer-events: auto;
    display: grid; gap: 10px;
    width: min(360px, calc(100vw - 32px));
    padding: 28px 28px 24px;
    color: var(--ink);
    background: color-mix(in srgb, var(--paper) 78%, transparent);
    border: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
    border-radius: var(--chrome-radius);
    box-shadow: 0 16px 48px color-mix(in srgb, var(--ink) 18%, transparent);
    backdrop-filter: blur(18px);
  }
  #empty h1 { margin: 0; font-size: 22px; font-weight: 600; line-height: 1.25; }
  #empty p { margin: 0; }
  #empty .project { color: var(--muted); font-size: 11px; }
  #empty .hint { font-size: 14px; line-height: 1.45; }
  #empty .note { margin-top: 6px; color: var(--muted); font-size: 12px; font-style: italic; }
  #empty.has-architecture { inset: 78px 0 auto; }
  #empty.has-architecture .empty-card { position: relative; padding: 14px 42px 14px 18px; gap: 4px; }
  #empty.has-architecture h1 { font-size: 13px; }
  #empty.has-architecture .hint, #empty.has-architecture .note { font-size: 11px; font-style: normal; }
  #empty.has-architecture .project { display: none; }
  #empty .dismiss { display: none; }
  #empty.has-architecture .dismiss { display: block; position: absolute; right: 10px; top: 8px; border: 0; padding: 2px 5px; }
`

/** An empty map offers scanner setup; existing architecture keeps its map beneath a compact notice. */
export function emptyState(payload: WebBootPayload): string {
  const hidden = payload.revision === null && !hasComponents(payload.world) ? '' : ' hidden'
  const className = isEmptyWorld(payload.world) ? '' : ' class="has-architecture"'
  return `<section id="empty" aria-label="Empty map"${className}${hidden}><div class="empty-card">`
    + `<p class="project">${escaped(payload.project?.title ?? '')}</p><h1>${noComponentsTitle}</h1>`
    + `<p class="hint">${noComponentsHint}</p><p class="note">${scannerSupportNote}</p>`
    + '<button class="dismiss" type="button" aria-label="Dismiss no-components message">×</button></div></section>'
}

/** The invitation that stands in for the map while the world has nothing to draw. */
export function createEmptyState(host: HTMLElement) {
  const title = host.querySelector('.project')!
  let dismissed = false
  host.querySelector('.dismiss')!.addEventListener('click', () => {
    dismissed = true
    host.hidden = true
  })

  return {
    /** History is read-only, so a selected revision never shows the invitation. */
    paint(world: Pick<ArchitectureGraph, 'elements'>, project: ProjectProfile | undefined, historical: boolean): void {
      host.hidden = historical || hasComponents(world) || (dismissed && !isEmptyWorld(world))
      host.classList.toggle('has-architecture', !isEmptyWorld(world))
      title.textContent = project?.title ?? ''
    },
  }
}
