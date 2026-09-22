import { awaitsCuration, firstScanHint, firstScanTitle, hasComponents, isEmptyWorld, noComponentsHint, noComponentsTitle, scannerSupportNote } from '../../../empty-world.ts'
import type { ProjectProfile } from '../../../project-profile.ts'
import type { ArchitectureGraph } from '../../../types.ts'
import { escaped } from '../atoms/escape.ts'
import type { WebBootPayload } from '../payload.ts'

export const emptyStateCss = `
  #empty { position: fixed; inset: 0; z-index: 2; display: grid; place-items: center; pointer-events: none; }
  #empty[hidden] { display: none; }
  #empty .empty-card {
    pointer-events: auto;
    display: grid; gap: 16px;
    width: min(440px, calc(100vw - 32px));
    padding: 32px;
    color: var(--ink);
    background: color-mix(in srgb, var(--paper) 78%, transparent);
    border: 1px solid var(--hairline);
    border-radius: 16px;
    box-shadow: 0 16px 64px color-mix(in srgb, var(--ink) 8%, transparent);
    backdrop-filter: blur(18px);
  }
  #empty h1 { margin: 0; font-size: 24px; font-weight: 600; line-height: 1.3; letter-spacing: -0.04em; }
  #empty p { margin: 0; }
  #empty .project { color: var(--muted); font-size: 12px; overflow-wrap: anywhere; }
  #empty .hint { color: var(--muted); font-size: 14px; line-height: 1.6; }
  #empty .note { margin-top: 6px; color: var(--muted); font-size: 12px; font-style: italic; }
  #empty:not(.has-architecture) .note, #empty.first-scan .note { display: none; }
  #empty .empty-action {
    margin-top: 8px; padding: 12px 18px; border: 1px solid var(--accent); border-radius: 8px;
    background: var(--accent); color: var(--on-colour); font-size: 14px; font-weight: 600;
  }
  #empty .empty-action:hover { background: color-mix(in srgb, var(--accent) 88%, var(--ink)); }
  #empty .empty-action[hidden], #empty.has-architecture .empty-action { display: none; }
  body:not(.hud-hidden) #empty:not(.has-architecture) { left: var(--hierarchy-inset); right: var(--details-inset); }
  /* Below the Iso, 2D and Layers bar (top 74px, 44px tall); map-only view hides the notice with the rest of the chrome. */
  #empty.has-architecture { inset: 130px 0 auto; }
  body.hud-hidden #empty.has-architecture { display: none; }
  #empty.has-architecture .empty-card { position: relative; width: min(360px, calc(100vw - 32px)); padding: 14px 42px 14px 18px; gap: 4px; border-radius: var(--chrome-radius); }
  #empty.has-architecture h1 { font-size: 13px; }
  #empty.has-architecture .hint, #empty.has-architecture .note { font-size: 11px; font-style: normal; }
  #empty.has-architecture .project { display: none; }
  #empty .dismiss { display: none; }
  #empty.has-architecture .dismiss { display: block; position: absolute; right: 10px; top: 8px; border: 0; padding: 2px 5px; }
  @media (max-width: 640px) { #empty .empty-card { padding: 24px; } }
`

type World = Pick<ArchitectureGraph, 'elements'>

function emptyMessage(world: World) {
  if (isEmptyWorld(world)) return { title: 'Your map starts here', hint: "Add code when you're ready. Set up scanners to bring it into your map." }
  return hasComponents(world) ? { title: firstScanTitle, hint: firstScanHint } : { title: noComponentsTitle, hint: noComponentsHint }
}

/** An empty map, a map without components, and a first scan nobody has curated each get a notice. */
function needsNotice(world: World): boolean {
  return !hasComponents(world) || awaitsCuration(world)
}

/** A new map welcomes an empty project; existing architecture keeps its compact notice. */
export function emptyState(payload: WebBootPayload): string {
  const hidden = payload.revision === null && needsNotice(payload.world) ? '' : ' hidden'
  const classes = [isEmptyWorld(payload.world) ? '' : 'has-architecture', awaitsCuration(payload.world) ? 'first-scan' : ''].filter(Boolean)
  const className = classes.length === 0 ? '' : ` class="${classes.join(' ')}"`
  const message = emptyMessage(payload.world)
  return `<section id="empty" aria-label="Map notice"${className}${hidden}><div class="empty-card">`
    + `<p class="project">${escaped(payload.project?.title ?? '')}</p><h1>${message.title}</h1>`
    + `<p class="hint">${message.hint}</p><p class="note">${scannerSupportNote}</p>`
    + '<button id="empty-scanners" class="empty-action" type="button" aria-haspopup="dialog" aria-controls="project-settings" hidden>Set up scanners</button>'
    + '<button class="dismiss" type="button" aria-label="Dismiss message">×</button></div></section>'
}

/** The invitation that stands in for the map while the world has nothing to draw. */
export function createEmptyState(host: HTMLElement) {
  const title = host.querySelector('.project')!
  const heading = host.querySelector('h1')!
  const hint = host.querySelector('.hint')!
  let dismissed = false
  host.querySelector('.dismiss')!.addEventListener('click', () => {
    dismissed = true
    host.hidden = true
  })

  return {
    /** History is read-only, so a selected revision never shows the invitation. */
    paint(world: World, project: ProjectProfile | undefined, historical: boolean): void {
      const empty = isEmptyWorld(world)
      const message = emptyMessage(world)
      host.hidden = historical || !needsNotice(world) || (dismissed && !empty)
      host.classList.toggle('has-architecture', !empty)
      host.classList.toggle('first-scan', awaitsCuration(world))
      title.textContent = project?.title ?? ''
      heading.textContent = message.title
      hint.textContent = message.hint
    },
  }
}
