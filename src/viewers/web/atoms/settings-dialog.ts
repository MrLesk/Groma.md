/** Shared chrome for the independent Settings and Project review dialogs. */
export const settingsDialogCss = `
  .settings-dialog { box-sizing: border-box; width: min(1000px, calc(100vw - 48px)); height: min(720px, calc(100dvh - 64px)); max-width: none; max-height: none; padding: 22px 24px; color: var(--ink); background: var(--paper); border: 1px solid var(--hairline); border-radius: var(--chrome-radius); box-shadow: 0 16px 48px #0005; }
  .settings-dialog::backdrop { background: #0006; }
  .settings-dialog[open] { display: flex; flex-direction: column; gap: 18px; }
  .settings-dialog.expanded { width: calc(100vw - 24px); height: calc(100dvh - 24px); }
  .settings-dialog > header { display: flex; align-items: center; gap: 8px; }
  .settings-dialog h1 { font-size: 20px; margin: 0; flex: 1; }
  .settings-dialog > section { flex: 1; min-height: 0; }
  .settings-dialog [hidden] { display: none !important; }
  @media (max-width: 640px) { .settings-dialog { width: calc(100vw - 16px); padding: 16px; } }
`

export function createSettingsDialog(id: string, title: string, content: string, options: { onClose?: () => void; expandable?: boolean } = {}) {
  const dialog = document.createElement('dialog')
  dialog.id = id
  dialog.className = 'settings-dialog'
  dialog.setAttribute('aria-labelledby', `${id}-title`)
  const expansion = options.expandable === false ? '' : `<button class="chrome-button" type="button" data-expand aria-label="Expand ${title}" aria-expanded="false">↔</button>`
  dialog.innerHTML = `<header><h1 id="${id}-title">${title}</h1>${expansion}<button class="chrome-button" type="button" data-close aria-label="Close ${title}">×</button></header>${content}`
  document.body.append(dialog)
  let opener: HTMLElement | undefined
  function close() {
    options.onClose?.()
    dialog.close()
    if (opener?.tagName === 'BUTTON') opener.setAttribute('aria-expanded', 'false')
    // A resolved warning disappears while Settings is open.
    if (opener && !opener.hidden) opener.focus()
    else document.getElementById('settings-toggle')?.focus()
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close() })
  dialog.addEventListener('keydown', event => event.stopPropagation())
  dialog.querySelector('[data-close]')!.addEventListener('click', close)
  const expand = dialog.querySelector<HTMLButtonElement>('[data-expand]')
  expand?.addEventListener('click', () => {
    const expanded = dialog.classList.toggle('expanded')
    expand.setAttribute('aria-expanded', String(expanded))
    expand.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${title}`)
  })
  return { dialog, close, open(button: HTMLElement) { opener = button; dialog.showModal(); if (button.tagName === 'BUTTON') button.setAttribute('aria-expanded', 'true') } }
}
