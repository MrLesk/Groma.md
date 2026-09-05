import type { DraftElementInput } from '../../../authoring.ts'
import { createComponentsHint, hasComponents, isEmptyWorld, noComponentsTitle } from '../../../empty-world.ts'
import type { ProjectProfile } from '../../../project-profile.ts'
import type { ArchitectureGraph } from '../../../types.ts'
import { escaped } from '../atoms/escape.ts'
import type { WebBootPayload } from '../payload.ts'

export const emptyStateCss = `
  #empty { position: fixed; inset: 0; z-index: 2; display: grid; place-items: center; pointer-events: none; }
  #empty[hidden] { display: none; }
  #empty .empty-card {
    pointer-events: auto;
    display: grid; gap: 12px;
    width: min(420px, calc(100vw - 32px));
    padding: 24px;
    color: var(--ink);
    background: color-mix(in srgb, var(--paper) 78%, transparent);
    border: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
    border-radius: var(--chrome-radius);
    box-shadow: 0 16px 48px color-mix(in srgb, var(--ink) 18%, transparent);
    backdrop-filter: blur(18px);
  }
  #empty h1 { margin: 0; font-size: 20px; line-height: 1.3; }
  #empty p { margin: 0; }
  #empty .project { color: var(--muted); font-size: 11px; }
  #empty.has-architecture { inset: 78px 0 auto; }
  #empty.has-architecture .empty-card { position: relative; padding: 14px 42px 14px 18px; gap: 4px; }
  #empty.has-architecture h1 { font-size: 13px; }
  #empty.has-architecture p { font-size: 11px; }
  #empty.has-architecture form, #empty.has-architecture .project { display: none; }
  #empty .dismiss { display: none; }
  #empty.has-architecture .dismiss { display: block; position: absolute; right: 10px; top: 8px; border: 0; padding: 2px 5px; }
  #empty form { display: grid; gap: 8px; }
  #empty input, #empty textarea {
    width: 100%;
    border: 1px solid var(--hairline);
    border-radius: 6px;
    padding: 9px 10px;
    color: var(--ink);
    background: color-mix(in srgb, var(--paper) 72%, transparent);
    font: 12px/1.5 'SF Mono', ui-monospace, Menlo, monospace;
    resize: none;
  }
  #empty textarea { height: 96px; }
  #empty input:focus, #empty textarea:focus { outline: 2px solid var(--highlight); outline-offset: -1px; }
  #empty .error { min-height: 1.5em; color: var(--highlight-text); font-size: 11px; }
  #empty .error:empty { display: none; }
  #empty button { justify-self: end; border: 1px solid var(--accent); border-radius: 6px; padding: 7px 12px; background: transparent; color: var(--accent-text); }
  #empty button:disabled { opacity: 0.5; cursor: wait; }
`

/** An empty map invites creation; existing architecture keeps its map beneath a compact notice. */
export function emptyState(payload: WebBootPayload): string {
  const hidden = payload.revision === null && !hasComponents(payload.world) ? '' : ' hidden'
  const className = isEmptyWorld(payload.world) ? '' : ' class="has-architecture"'
  const form = payload.delivery.kind === 'live'
    ? '<form><input name="name" placeholder="System name" aria-label="System name" required><textarea name="overview" placeholder="What it will do" aria-label="Overview" required></textarea><p class="error" role="status"></p><button type="submit">Draft system</button></form>'
    : ''
  return `<section id="empty" aria-label="Empty map"${className}${hidden}><div class="empty-card">`
    + `<p class="project">${escaped(payload.project?.title ?? '')}</p><h1>${noComponentsTitle}</h1>`
    + `<p>${createComponentsHint}</p>${form}<button class="dismiss" type="button" aria-label="Dismiss no-components message">×</button></div></section>`
}

/** The invitation that stands in for the map while the world has nothing to draw. */
export function createEmptyState(
  host: HTMLElement,
  draft: ((input: DraftElementInput) => Promise<void>) | undefined,
) {
  const title = host.querySelector('.project')!
  let dismissed = false
  host.querySelector('.dismiss')!.addEventListener('click', () => {
    dismissed = true
    host.hidden = true
  })
  if (draft !== undefined) {
    const form = host.querySelector<HTMLFormElement>('form')!
    const name = form.elements.namedItem('name') as HTMLInputElement
    const overview = form.elements.namedItem('overview') as HTMLTextAreaElement
    const error = form.querySelector<HTMLElement>('.error')!
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
    form.addEventListener('submit', async event => {
      event.preventDefault()
      submit.disabled = true
      error.textContent = ''
      try {
        await draft({ kind: 'system', name: name.value, overview: overview.value })
        form.reset()
      } catch (cause) {
        error.textContent = cause instanceof Error ? cause.message : String(cause)
      } finally {
        submit.disabled = false
      }
    })
  }

  return {
    /** History is read-only, so a selected revision never shows the invitation. */
    paint(world: Pick<ArchitectureGraph, 'elements'>, project: ProjectProfile | undefined, historical: boolean): void {
      host.hidden = historical || hasComponents(world) || (dismissed && !isEmptyWorld(world))
      host.classList.toggle('has-architecture', !isEmptyWorld(world))
      title.textContent = project?.title ?? ''
    },
  }
}
