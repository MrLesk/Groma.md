import { createRender } from '@comark/html'
import security from 'comark/plugins/security'

import type { ProjectProfile, ProjectProfileInput } from '../../../project-profile.ts'

const renderMarkdown = createRender({
  plugins: [security({
    allowedTags: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'br'],
    allowedProtocols: ['http', 'https', 'mailto'],
    allowDataImages: false,
  })],
})

export const projectEditorCss = `
  #project-editor {
    position: fixed;
    width: min(480px, calc(100vw - 32px));
    max-height: calc(100dvh - 32px);
    margin: 0;
    padding: 0;
    overflow: visible;
    color: var(--ink);
    background: color-mix(in srgb, var(--paper) 78%, transparent);
    border: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
    border-radius: var(--chrome-radius);
    box-shadow: 0 16px 48px color-mix(in srgb, var(--ink) 18%, transparent);
    backdrop-filter: blur(18px);
  }
  #project-editor::backdrop { background: color-mix(in srgb, var(--ink) 8%, transparent); }
  #project-editor form {
    position: relative; z-index: 1; display: grid; gap: 12px; max-height: calc(100dvh - 32px); padding: 20px;
    overflow: hidden; border-radius: inherit; background: inherit;
  }
  #project-editor .anchor-line {
    position: absolute; z-index: 0; height: 1px; background: var(--map-line);
    transform-origin: left center; pointer-events: none;
  }
  #project-editor h1 { margin: 0; font-size: 18px; line-height: 1.3; }
  #project-editor label { display: grid; gap: 6px; color: var(--muted); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; }
  #project-editor .markdown-field { display: grid; gap: 6px; }
  #project-editor .markdown-head { display: flex; align-items: end; justify-content: space-between; }
  #project-editor .markdown-label { color: var(--muted); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; }
  #project-editor .markdown-modes { display: flex; gap: 2px; padding: 2px; border: 1px solid var(--hairline); border-radius: 6px; }
  #project-editor .markdown-modes button { border: 0; padding: 4px 8px; color: var(--muted); font-size: 10px; }
  #project-editor .markdown-modes button[aria-selected="true"] { color: var(--paper); background: var(--ink); }
  #project-editor input, #project-editor textarea {
    width: 100%;
    border: 1px solid var(--hairline);
    border-radius: 6px;
    padding: 9px 10px;
    color: var(--ink);
    background: color-mix(in srgb, var(--paper) 72%, transparent);
    font: 12px/1.5 'SF Mono', ui-monospace, Menlo, monospace;
    resize: none;
  }
  #project-editor textarea { height: clamp(180px, 28vh, 280px); overflow: auto; }
  #project-editor .markdown-preview {
    height: clamp(180px, 28vh, 280px); overflow: auto;
    border: 1px solid var(--hairline); border-radius: 6px; padding: 10px;
    color: var(--ink); background: color-mix(in srgb, var(--paper) 72%, transparent);
    font: 12px/1.55 'SF Mono', ui-monospace, Menlo, monospace;
  }
  #project-editor .markdown-preview :where(h1, h2, h3, h4, h5, h6) { margin: 0 0 0.5em; line-height: 1.25; }
  #project-editor .markdown-preview h1 { font-size: 1.45em; }
  #project-editor .markdown-preview h2 { font-size: 1.3em; }
  #project-editor .markdown-preview :where(h3, h4, h5, h6) { font-size: 1.1em; }
  #project-editor .markdown-preview :where(p, ul, ol, blockquote, pre) { margin: 0 0 0.75em; }
  #project-editor .markdown-preview :where(p, ul, ol, blockquote, pre):last-child { margin-bottom: 0; }
  #project-editor .markdown-preview :where(ul, ol) { padding-left: 2em; }
  #project-editor .markdown-preview blockquote { padding-left: 0.75em; border-left: 2px solid var(--hairline); color: var(--muted); }
  #project-editor .markdown-preview code { padding: 1px 4px; border-radius: 3px; background: color-mix(in srgb, var(--ink) 8%, transparent); }
  #project-editor .markdown-preview a { color: var(--highlight-text); text-underline-offset: 2px; }
  #project-editor input:focus, #project-editor textarea:focus { outline: 2px solid var(--highlight); outline-offset: -1px; }
  #project-editor .error { min-height: 1.5em; margin: -6px 0 0; color: var(--highlight-text); font-size: 11px; }
  #project-editor .error:empty { display: none; }
  #project-editor .actions { display: flex; justify-content: flex-end; gap: 8px; }
  #project-editor button { border: 1px solid var(--hairline); border-radius: 6px; padding: 7px 12px; background: transparent; }
  #project-editor button[type="submit"] { border-color: var(--accent); background: transparent; color: var(--accent-text); }
  #project-editor button:disabled { opacity: 0.5; cursor: wait; }
  @media (max-width: 640px) {
    #project-editor { width: calc(100vw - 24px); max-height: calc(100dvh - 24px); }
    #project-editor form { gap: 10px; max-height: calc(100dvh - 24px); padding: 16px; }
    #project-editor textarea, #project-editor .markdown-preview { height: clamp(150px, 28vh, 220px); }
  }
`

const VIEWPORT_INSET = 16
const EDITOR_GAP = 24

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum))
}

function placeEditor(dialog: HTMLDialogElement, anchor: Element, line: HTMLElement): void {
  const anchorRect = anchor.getBoundingClientRect()
  const editorRect = dialog.getBoundingClientRect()
  const left = clamp(
    anchorRect.right + EDITOR_GAP,
    VIEWPORT_INSET,
    innerWidth - editorRect.width - VIEWPORT_INSET,
  )
  const top = clamp(
    anchorRect.top - editorRect.height - EDITOR_GAP,
    VIEWPORT_INSET,
    innerHeight - editorRect.height - VIEWPORT_INSET,
  )
  dialog.style.left = `${left}px`
  dialog.style.top = `${top}px`

  const placed = dialog.getBoundingClientRect()
  const anchorX = anchorRect.left + anchorRect.width / 2
  const anchorY = anchorRect.top + anchorRect.height / 2
  const lineX = clamp(anchorX, placed.left, placed.right)
  const lineY = clamp(anchorY, placed.top, placed.bottom)
  const dx = anchorX - lineX
  const dy = anchorY - lineY
  line.style.left = `${lineX - placed.left}px`
  line.style.top = `${lineY - placed.top}px`
  line.style.width = `${Math.hypot(dx, dy)}px`
  line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`
}

export function createProjectEditor(
  save: (profile: ProjectProfileInput) => Promise<void>,
) {
  const dialog = document.createElement('dialog')
  dialog.id = 'project-editor'
  dialog.innerHTML = '<span class="anchor-line" aria-hidden="true"></span><form><h1></h1><label>Title<input name="title" required></label><label>Description<input name="description"></label><div class="markdown-field"><div class="markdown-head"><span class="markdown-label">Overview</span><div class="markdown-modes" role="tablist"><button type="button" role="tab" data-mode="write" aria-selected="true">Write</button><button type="button" role="tab" data-mode="preview" aria-selected="false">Preview</button></div></div><textarea name="overview" required aria-label="Overview Markdown"></textarea><div class="markdown-preview" role="tabpanel" hidden></div></div><p class="error" role="status"></p><div class="actions"><button type="button" data-cancel>Cancel</button><button type="submit">Save</button></div></form>'
  document.body.append(dialog)

  const line = dialog.querySelector<HTMLElement>('.anchor-line')!
  const form = dialog.querySelector('form')!
  const heading = form.querySelector('h1')!
  const title = form.elements.namedItem('title') as HTMLInputElement
  const description = form.elements.namedItem('description') as HTMLInputElement
  const overview = form.elements.namedItem('overview') as HTMLTextAreaElement
  const preview = form.querySelector<HTMLElement>('.markdown-preview')!
  const modes = [...form.querySelectorAll<HTMLButtonElement>('[data-mode]')]
  const cancel = form.querySelector<HTMLButtonElement>('[data-cancel]')!
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
  const error = form.querySelector<HTMLElement>('.error')!
  let anchor: Element | undefined

  window.addEventListener('resize', () => {
    if (dialog.open && anchor !== undefined) placeEditor(dialog, anchor, line)
  })

  let previewVersion = 0
  const showMode = async (mode: 'write' | 'preview') => {
    modes.forEach(button => {
      button.setAttribute('aria-selected', String(button.dataset.mode === mode))
    })
    overview.hidden = mode === 'preview'
    preview.hidden = mode === 'write'
    if (mode === 'write') return
    const version = ++previewVersion
    const html = await renderMarkdown(overview.value)
    if (version !== previewVersion) return
    preview.innerHTML = html
  }

  modes.forEach(button => {
    button.addEventListener('click', () => void showMode(button.dataset.mode as 'write' | 'preview'))
  })
  overview.addEventListener('input', () => {
    if (!preview.hidden) void showMode('preview')
  })
  cancel.addEventListener('click', () => dialog.close())
  form.addEventListener('submit', async event => {
    event.preventDefault()
    submit.disabled = true
    error.textContent = ''
    try {
      await save({
        title: title.value,
        overview: overview.value,
        description: description.value,
      })
      dialog.close()
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : String(cause)
    } finally {
      submit.disabled = false
    }
  })

  return {
    open(profile: ProjectProfile) {
      anchor = document.querySelector('[data-project-edit]')!
      heading.textContent = `Edit ${profile.title}`
      title.value = profile.title
      description.value = profile.description ?? ''
      overview.value = profile.overview
      error.textContent = ''
      void showMode('write')
      dialog.showModal()
      placeEditor(dialog, anchor, line)
      title.focus()
    },
  }
}
