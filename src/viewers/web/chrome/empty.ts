import type { DraftElementInput } from '../../../draft.ts'
import { isEmptyWorld } from '../../../empty-world.ts'
import type { ProjectProfile } from '../../../project-profile.ts'
import type { ArchitectureGraph } from '../../../types.ts'

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

/** The invitation that stands in for the map while the world has nothing to draw. */
export function createEmptyState(
  host: HTMLElement,
  draft: ((input: DraftElementInput) => Promise<void>) | undefined,
) {
  const title = host.querySelector('h1')!
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
      host.hidden = historical || !isEmptyWorld(world)
      title.textContent = project?.title ?? ''
    },
  }
}
