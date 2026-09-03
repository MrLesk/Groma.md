export const removeCss = `
  #details .remove { display: grid; gap: 8px; margin-top: 20px; padding-top: 12px; border-top: 1px solid var(--hairline); }
  #details .remove button { justify-self: start; border: 1px solid var(--hairline); border-radius: 6px; padding: 6px 10px; background: transparent; color: var(--muted); }
  #details .remove button:hover { color: var(--ink); background: var(--hover); }
  #details .remove .confirm { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  #details .remove .confirm[hidden] { display: none; }
  #details .remove [data-confirm] { border-color: var(--highlight); color: var(--highlight-text); }
  #details .remove .error { margin: 0; color: var(--highlight-text); font-size: 11px; }
  #details .remove .error:empty { display: none; }
`

/** The Remove control of the details pane: one click asks, the second removes, a refusal shows the server's sentence. */
export function paintRemoveControl(host: Element, title: string, remove: () => Promise<void>): void {
  const box = document.createElement('div')
  box.className = 'remove'
  const ask = document.createElement('button')
  ask.type = 'button'
  ask.textContent = 'Remove'
  const confirm = document.createElement('div')
  confirm.className = 'confirm'
  confirm.hidden = true
  const question = document.createElement('span')
  question.textContent = `Remove ${title}?`
  const yes = document.createElement('button')
  yes.type = 'button'
  yes.dataset.confirm = ''
  yes.textContent = 'Remove'
  const keep = document.createElement('button')
  keep.type = 'button'
  keep.textContent = 'Keep'
  confirm.append(question, yes, keep)
  const error = document.createElement('p')
  error.className = 'error'
  error.setAttribute('role', 'status')
  box.append(ask, confirm, error)
  host.append(box)

  ask.addEventListener('click', () => {
    ask.hidden = true
    confirm.hidden = false
    yes.focus()
  })
  keep.addEventListener('click', () => {
    confirm.hidden = true
    ask.hidden = false
  })
  yes.addEventListener('click', async () => {
    yes.disabled = true
    error.textContent = ''
    try {
      await remove()
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : String(cause)
    } finally {
      yes.disabled = false
    }
  })
}
