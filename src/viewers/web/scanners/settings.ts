import type { WebDataSource } from '../data.ts'
import { escaped } from '../atoms/escape.ts'
import { scannerGroups, scannerSettingAction, scannerMatchReason, scannerSettingLabel, type ScannerSetting, type ScannerSettings, type ScannerSettingsAction } from '../../../scanner/modules/settings-model.ts'

export const scannerSettingsCss = `
  #scanners { white-space: nowrap; }
  #scanners[data-tone="hint"] { color: var(--syntax-type); }
  #scanners[data-tone="warning"], #scanners[data-tone="error"] { color: var(--syntax-number); }
  #scanner-notice { position: absolute; top: 74px; left: 12px; right: 12px; z-index: 21; padding: 8px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--paper); border: 1px solid var(--syntax-number); border-radius: var(--control-radius); color: var(--syntax-number); }
  #scanner-notice[hidden] { display: none; }
  body.scanner-warning #hierarchy, body.scanner-warning #details { top: 124px; }
  #scanner-settings { width: min(840px, calc(100vw - 48px)); max-height: calc(100dvh - 80px); padding: 22px; color: var(--ink); background: var(--paper); border: 1px solid var(--hairline); border-radius: var(--chrome-radius); box-shadow: 0 16px 48px color-mix(in srgb, var(--ink) 15%, transparent); }
  #scanner-settings::backdrop { background: color-mix(in srgb, var(--paper) 45%, transparent); }
  #scanner-settings[open] { display: flex; flex-direction: column; }
  #scanner-settings [data-rows] { overflow: auto; min-height: 0; }
  #scanner-settings .scanner-search { margin-bottom: 14px; }
  #scanner-settings header { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
  #scanner-settings h1 { font-size: 18px; margin: 0; flex: 1; }
  #scanner-settings button { border: 1px solid var(--hairline); border-radius: var(--control-radius); padding: 6px 10px; }
  #scanner-settings button:disabled { opacity: .5; cursor: not-allowed; }
  #scanner-settings [data-action="install"], #scanner-settings [data-action="restore"] { color: var(--accent-text); }
  #scanner-settings table { width: 100%; border-collapse: collapse; }
  #scanner-settings th { font-weight: 400; text-align: left; padding: 10px 8px; background: var(--hover); color: var(--muted); }
  #scanner-settings td { padding: 14px 8px; border-bottom: 1px solid var(--hairline); vertical-align: top; }
  #scanner-settings td:last-child { text-align: right; white-space: nowrap; }
  #scanner-settings .scanner-group th { padding-top: 20px; background: transparent; color: var(--ink); font-weight: 600; }
  #scanner-settings .scanner-origin, #scanner-settings .scanner-message { color: var(--muted); font-size: 11px; }
  #scanner-settings .scanner-match { overflow-wrap: anywhere; margin-top: 5px; }
  #scanner-settings .scanner-ready { color: var(--accent-text); }
  #scanner-settings .scanner-blocked, #scanner-settings .scanner-missing { color: var(--syntax-number); }
  #scanner-settings details { margin-top: 6px; }
  #scanner-settings summary { cursor: pointer; color: var(--muted); }
  #scanner-settings details p { white-space: pre-wrap; overflow-wrap: anywhere; margin: 8px 0; }
  #scanner-settings footer { margin-top: 18px; color: var(--muted); font-size: 11px; }
  #scanner-settings form { display: flex; gap: 10px; align-items: end; margin-bottom: 18px; }
  #scanner-settings form[hidden] { display: none; }
  #scanner-settings label { display: grid; gap: 8px; flex: 1; }
  #scanner-settings input { width: 100%; border: 1px solid var(--hairline); background: var(--paper); color: var(--ink); padding: 9px; font: inherit; }
  #scanner-settings .scanner-error { color: var(--diff-removed); white-space: pre-wrap; overflow-wrap: anywhere; }
  #scanner-settings .scanner-error:empty { display: none; }
  @media (max-width: 1400px) { #scanners .scanner-hint { display: none; } #header { grid-template-columns: minmax(0, 1fr) minmax(120px, 180px) auto; gap: 8px; } }
`

export function scannerSettingsControl(): string {
  return '<button id="scanners" class="chrome-button" type="button" aria-haspopup="dialog">Scanners</button>'
}

function settingRow(scanner: ScannerSetting): string {
  const id = escaped(scanner.id)
  const button = (action: string, title: string) => `<button type="button" data-action="${action}" data-id="${id}">${title}</button>`
  const action = scannerSettingAction(scanner)
  const primary = action ? button(action.action, action.action === 'retry' ? 'Retry' : 'Install') : scanner.source ? button('remove', 'Remove from project') : '<button type="button" disabled>Install</button>'
  const more = scanner.source ? button('update', 'Update') + (action?.action === 'retry' ? button('remove', 'Remove from project') : '') : ''
  const reason = scanner.source ? '' : `<div class="scanner-match">${escaped(scannerMatchReason(scanner))}</div>`
  return `<tr data-scanner-id="${id}"><td><strong>${id}</strong><div class="scanner-origin">${scanner.official ? 'Official' : 'Third-party'}${scanner.version ? ` · ${escaped(scanner.version)}` : ''}</div>${reason}<details><summary>Details</summary><p>${escaped(scanner.source ?? scanner.installSource ?? scanner.name)}</p><p>${escaped(scanner.message)}</p><p>${escaped(scanner.matches.join('\n'))}</p>${more}</details></td>`
    + `<td class="scanner-${scanner.status}">${escaped(scannerSettingLabel(scanner))}</td><td>${primary}</td></tr>`
}

/** A live-only settings surface. Published exports have neither controls nor scanner operations. */
export function bindScannerSettings(data: WebDataSource): void {
  const control = document.getElementById('scanners')
  if (!control || !data.readScanners || !data.changeScanners) return
  const dialog = document.createElement('dialog')
  dialog.id = 'scanner-settings'
  dialog.setAttribute('aria-labelledby', 'scanner-settings-title')
  dialog.innerHTML = '<header><h1 id="scanner-settings-title">Scanners</h1><button type="button" data-add>Add scanner</button><button type="button" data-close aria-label="Close scanner settings">×</button></header>'
    + '<input class="scanner-search" type="search" aria-label="Search scanners" placeholder="Search scanners">'
    + '<form hidden><label>Scanner source<input name="source" placeholder="package@version, Git URL, or local path" required></label><button type="submit">Add</button><button type="button" data-cancel>Cancel</button></form>'
    + '<div class="scanner-error" role="alert"></div><div data-rows></div><footer>Removing a scanner keeps saved architecture.</footer>'
  const notice = document.createElement('div')
  notice.id = 'scanner-notice'; notice.hidden = true
  const noticeText = document.createElement('span')
  const open = document.createElement('button'); open.type = 'button'; open.className = 'chrome-button'; open.textContent = 'Open scanners'
  notice.append(noticeText, open)
  document.body.append(notice, dialog)
  const rows = dialog.querySelector<HTMLElement>('[data-rows]')!
  const error = dialog.querySelector<HTMLElement>('.scanner-error')!
  const form = dialog.querySelector('form')!
  const source = form.querySelector('input')!
  const search = dialog.querySelector<HTMLInputElement>('.scanner-search')!
  let updateId: string | undefined
  let state: ScannerSettings | undefined
  let busy = false

  function paintRows(next: ScannerSettings): void {
    const expanded = new Set([...rows.querySelectorAll<HTMLDetailsElement>('details[open]')].map(item => item.closest('tr')?.querySelector('strong')?.textContent))
    const focused = document.activeElement?.closest<HTMLElement>('[data-scanner-id]')?.dataset.scannerId
    const groups = scannerGroups(next.scanners, search.value)
    rows.innerHTML = groups.length ? `<table><thead><tr><th>Scanner</th><th>Status</th><th></th></tr></thead>${groups.map(group => `<tbody><tr class="scanner-group"><th colspan="3" scope="rowgroup">${group.title}</th></tr>${group.scanners.map(settingRow).join('')}</tbody>`).join('')}</table>` : '<p>No scanners match.</p>'
    for (const detail of rows.querySelectorAll('details')) detail.open = expanded.has(detail.closest('tr')?.querySelector('strong')?.textContent)
    if (focused) rows.querySelector<HTMLElement>(`[data-scanner-id="${CSS.escape(focused)}"] button`)?.focus()
  }
  function setBusy() {
    for (const button of dialog.querySelectorAll<HTMLButtonElement>('button[data-action], header button, form button')) {
      button.disabled = busy && !button.hasAttribute('data-close')
    }
  }
  function paint(next: ScannerSettings): void {
    state = next
    const tone = next.notice.tone
    control!.dataset.tone = tone
    control!.innerHTML = tone === 'hint' ? `● Scanners<span class="scanner-hint"> · ${next.notice.message.startsWith('More') ? 'More available' : 'Review scanners'}</span>` : 'Scanners'
    control!.setAttribute('title', next.notice.message || 'Project scanner settings')
    notice.hidden = tone !== 'warning' && tone !== 'error'
    noticeText.textContent = next.notice.message
    document.body.classList.toggle('scanner-warning', !notice.hidden)
    paintRows(next)
    setBusy()
    error.textContent = tone === 'error' ? next.notice.message : next.limits.join('\n')
  }
  async function read() {
    try { paint(await data.readScanners!()) }
    catch (cause) { error.textContent = String(cause) }
  }
  async function change(action: ScannerSettingsAction) {
    busy = true
    if (state) paint(state)
    try { paint(await data.changeScanners!(action)) }
    catch (cause) { error.textContent = cause instanceof Error ? cause.message : String(cause) }
    finally {
      busy = false; setBusy()
      if ('id' in action) rows.querySelector<HTMLElement>(`[data-scanner-id="${CSS.escape(action.id)}"] button`)?.focus()
    }
  }
  function show() { dialog.showModal(); void read() }
  function sourceForm(id?: string) {
    updateId = id
    form.hidden = false
    source.value = state?.scanners.find(scanner => scanner.id === id)?.source ?? ''
    form.querySelector('button')!.textContent = id ? 'Update' : 'Add'
    source.focus()
  }
  control.addEventListener('click', show)
  open.addEventListener('click', show)
  dialog.querySelector('[data-close]')!.addEventListener('click', () => dialog.close())
  dialog.querySelector('[data-add]')!.addEventListener('click', () => sourceForm())
  dialog.querySelector('[data-cancel]')!.addEventListener('click', () => { form.hidden = true })
  search.addEventListener('input', () => { if (state) paintRows(state); rows.scrollTop = 0 })
  rows.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-action]') : null
    if (!button) return
    const id = button.dataset.id!, action = button.dataset.action!
    if (action === 'retry') void change({ action })
    else if (action === 'update') sourceForm(id)
    else if (action === 'install' || action === 'restore' || action === 'remove') void change({ action, id })
  })
  form.addEventListener('submit', event => {
    event.preventDefault()
    form.hidden = true
    void change(updateId ? { action: 'update', id: updateId, source: source.value } : { action: 'add', source: source.value })
  })
  // Keep map shortcuts from consuming keys while a modal form owns focus.
  dialog.addEventListener('keydown', event => event.stopPropagation())
  data.onScanners = paint
  void read()
}
