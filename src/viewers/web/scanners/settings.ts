import type { WebDataSource } from '../data.ts'
import { escaped } from '../atoms/escape.ts'
import { isNpmPackageName } from '../../../scanner/modules/published.ts'
import { scannerGroups, scannerSettingAction, scannerMatchReason, type ScannerSetting, type ScannerSettings, type ScannerSettingsAction } from '../../../scanner/modules/settings-model.ts'

export const scannerSettingsCss = `
  #scanner-settings { min-height: 0; display: flex; flex-direction: column; gap: 16px; }
  #scanner-settings .scanner-tools { display: flex; gap: 12px; }
  #scanner-settings .scanner-tools input { flex: 1; min-width: 0; }
  #scanner-settings [data-rows] { overflow: auto; min-height: 0; }
  #scanner-settings button { white-space: nowrap; }
  #scanner-settings button:disabled { opacity: .5; cursor: not-allowed; }
  #scanner-settings [data-action="install"], #scanner-settings [data-action="restore"], #scanner-settings [data-group] { color: var(--accent-text); }
  #scanner-settings .scanner-group { margin-bottom: 20px; }
  #scanner-settings .scanner-group-heading { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
  #scanner-settings h2 { flex: 1; margin: 0; font-size: 12px; }
  #scanner-settings .scanner-count { color: var(--muted); font-weight: 400; margin-left: 8px; }
  #scanner-settings .scanner-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--hairline); }
  #scanner-settings .scanner-row > div { min-width: 0; }
  #scanner-settings .scanner-row > button { align-self: start; }
  #scanner-settings .scanner-name { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; }
  #scanner-settings .scanner-origin, #scanner-settings .scanner-version { color: var(--muted); font-size: 11px; }
  #scanner-settings .scanner-origin { border: 1px solid var(--hairline); border-radius: 4px; padding: 1px 5px; }
  #scanner-settings .scanner-match { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); margin-top: 5px; }
  #scanner-settings .scanner-status { color: var(--syntax-number); }
  #scanner-settings details { margin-top: 6px; }
  #scanner-settings summary { cursor: pointer; color: var(--muted); }
  #scanner-settings details p, #scanner-settings pre { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; margin: 8px 0; }
  #scanner-settings .scanner-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  #scanner-settings .scanner-notice { margin: 0; color: var(--muted); }
  #scanner-settings .scanner-notice[data-tone="error"], #scanner-settings .scanner-notice[data-tone="warning"] { color: var(--syntax-number); }
  #scanner-settings form { display: flex; gap: 10px; align-items: end; }
  #scanner-settings label { display: grid; gap: 8px; flex: 1; min-width: 0; }
  #scanner-settings input { width: 100%; box-sizing: border-box; border: 1px solid var(--hairline); border-radius: var(--control-radius); background: var(--paper); color: var(--ink); padding: 9px; font: inherit; }
  #scanner-settings .scanner-error { color: var(--diff-removed); }
  #scanner-settings .scanner-error summary { color: inherit; }
  #scanner-settings [hidden] { display: none; }
`

function settingRow(scanner: ScannerSetting): string {
  const id = escaped(scanner.id)
  const button = (action: string, title: string) => `<button class="chrome-button" type="button" data-action="${action}" data-id="${id}">${title}</button>`
  const action = scannerSettingAction(scanner)
  const primary = action ? button(action.action, action.action === 'retry' ? 'Retry' : 'Install') : scanner.source ? button('remove', 'Remove') : ''
  const npm = scanner.source && isNpmPackageName(scanner.source.slice(0, scanner.source.lastIndexOf('@')))
  const update = npm ? button('update', 'Update') + button('version', 'Choose version') : button('version', 'Update')
  const more = scanner.source ? update + (action ? button('remove', 'Remove from project') : '') : ''
  const reason = scanner.source && scanner.match !== 'none' ? '' : `<div class="scanner-match" title="${escaped(scannerMatchReason(scanner))}">${escaped(scannerMatchReason(scanner))}</div>`
  const status = scanner.status === 'blocked' ? '<span class="scanner-status">Needs attention</span>' : ''
  return `<div class="scanner-row" data-scanner-id="${id}"><div><div class="scanner-name"><strong>${id}</strong><span class="scanner-origin">${scanner.official ? 'Official' : 'Third-party'}</span><span class="scanner-version">${escaped(scanner.version ?? '')}</span>${status}</div>${reason}`
    + `<details><summary>${scanner.status === 'blocked' ? 'Error details' : 'Details'}</summary><p>${escaped(scanner.source ?? scanner.installSource ?? scanner.name)}</p><p>${escaped(scanner.message)}</p><p>${escaped(scanner.matches.join('\n'))}</p><div class="scanner-actions">${more}</div></details></div>${primary}</div>`
}

function settingGroup(group: ReturnType<typeof scannerGroups>[number], showBulk: boolean): string {
  const missing = group.scanners.every(scanner => scanner.status === 'missing')
  const recommended = group.scanners.every(scanner => !scanner.source)
  const title = missing ? 'Set up for this project' : group.title
  const action = missing ? 'install-missing' : recommended ? 'install-recommended' : undefined
  const installable = group.scanners.some(scanner => scanner.status === 'missing' || scanner.installSource)
  const bulk = showBulk && action && installable ? `<button class="chrome-button" type="button" data-group="${action}">${missing ? 'Install missing' : 'Install recommended'}</button>` : ''
  return `<section class="scanner-group"><div class="scanner-group-heading"><h2>${title}<span class="scanner-count">${group.scanners.length}</span></h2>${bulk}</div>${group.scanners.map(settingRow).join('')}</section>`
}

/** Plugin management uses the live data source inside Settings. */
export function bindScannerSettings(data: WebDataSource, host: HTMLElement, onState: (state: ScannerSettings) => void) {
  host.innerHTML = '<p class="scanner-notice" hidden></p><div class="scanner-tools"><input type="search" aria-label="Search scanners" placeholder="Search scanners"><button class="chrome-button" type="button" data-add>Add scanner</button></div>'
    + '<form hidden><label>Scanner source<input name="source" placeholder="package name, package@version, Git URL, or local path" required></label><button class="chrome-button" type="submit">Add</button><button class="chrome-button" type="button" data-cancel>Cancel</button></form>'
    + '<details class="scanner-error" hidden><summary></summary><pre></pre></details><button class="chrome-button" type="button" data-retry hidden>Retry installation</button><div data-rows></div>'
  const rows = host.querySelector<HTMLElement>('[data-rows]')!
  const error = host.querySelector<HTMLDetailsElement>('.scanner-error')!
  const form = host.querySelector('form')!
  const source = form.querySelector('input')!
  const search = host.querySelector<HTMLInputElement>('input[type="search"]')!
  const notice = host.querySelector<HTMLElement>('.scanner-notice')!
  const retry = host.querySelector<HTMLButtonElement>('[data-retry]')!
  let updateId: string | undefined
  let state: ScannerSettings | undefined
  let busy: ScannerSettingsAction | undefined
  let failedAction: ScannerSettingsAction | undefined

  function showError(title: string, message: string) {
    error.hidden = !message
    error.querySelector('summary')!.textContent = title
    error.querySelector('pre')!.textContent = message
  }
  function paintRows(next: ScannerSettings): void {
    const expanded = new Set([...rows.querySelectorAll<HTMLDetailsElement>('details[open]')].map(item => item.closest<HTMLElement>('[data-scanner-id]')?.dataset.scannerId))
    const focused = document.activeElement?.closest<HTMLElement>('[data-scanner-id]')?.dataset.scannerId
    const groups = scannerGroups(next.scanners, search.value)
    rows.innerHTML = groups.length ? groups.map(group => settingGroup(group, !search.value.trim())).join('') : '<p>No scanners match.</p>'
    for (const detail of rows.querySelectorAll('details')) detail.open = expanded.has(detail.closest<HTMLElement>('[data-scanner-id]')?.dataset.scannerId)
    if (focused) rows.querySelector<HTMLElement>(`[data-scanner-id="${CSS.escape(focused)}"] button`)?.focus()
  }
  function setBusy() {
    for (const button of host.querySelectorAll<HTMLButtonElement>('button')) button.disabled = busy !== undefined
    if (busy && 'id' in busy) {
      const button = rows.querySelector<HTMLButtonElement>(`[data-scanner-id="${CSS.escape(busy.id)}"] > button`)
      if (button) button.textContent = busy.action === 'remove' ? 'Removing…' : busy.action === 'update' ? 'Updating…' : 'Installing…'
    }
  }
  function paint(next: ScannerSettings): void {
    state = next
    onState(next)
    const tone = next.notice.tone
    notice.dataset.tone = tone
    notice.textContent = tone === 'warning' ? 'Showing saved architecture. Install scanners to update it from code.'
      : tone === 'error' ? 'Scanning needs attention. Showing saved architecture.' : next.notice.message
    notice.hidden = !notice.textContent
    paintRows(next)
    setBusy()
    const diagnostic = tone === 'error' && !next.scanners.some(scanner => scanner.status === 'blocked') ? next.notice.message : next.limits.join('\n')
    if (!failedAction) showError('Scanner details', diagnostic)
  }
  async function read() {
    try { paint(await data.readScanners!()) }
    catch (cause) {
      showError('Could not load scanners', String(cause))
      onState({ scanners: [], notice: { tone: 'error', message: String(cause) }, limits: [] })
    }
  }
  async function change(action: ScannerSettingsAction) {
    if (busy) return
    busy = action; failedAction = undefined; retry.hidden = true
    if (state) paint(state)
    try { paint(await data.changeScanners!(action)) }
    catch (cause) {
      showError('Scanner action failed', cause instanceof Error ? cause.message : String(cause))
      failedAction = action; retry.hidden = false
    } finally {
      busy = undefined
      if (state) paintRows(state)
      setBusy()
      const next = 'id' in action ? rows.querySelector<HTMLElement>(`[data-scanner-id="${CSS.escape(action.id)}"] > button`) : undefined
      ;(next ?? search).focus()
    }
  }
  function sourceForm(id?: string) {
    updateId = id
    form.hidden = false
    source.value = state?.scanners.find(scanner => scanner.id === id)?.source ?? ''
    form.querySelector('button')!.textContent = id ? 'Update' : 'Add'
    source.focus()
  }
  host.querySelector('[data-add]')!.addEventListener('click', () => sourceForm())
  host.querySelector('[data-cancel]')!.addEventListener('click', () => { form.hidden = true })
  retry.addEventListener('click', () => { if (failedAction) void change(failedAction) })
  search.addEventListener('input', () => { if (state) paintRows(state); setBusy(); rows.scrollTop = 0 })
  rows.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null
    if (!button) return
    if (button.dataset.group) { void change({ action: button.dataset.group as 'install-recommended' | 'install-missing' }); return }
    const id = button.dataset.id!, action = button.dataset.action
    if (action === 'retry') void change({ action })
    else if (action === 'update') void change({ action, id })
    else if (action === 'version') sourceForm(id)
    else if (action === 'install' || action === 'restore' || action === 'remove') void change({ action, id })
  })
  form.addEventListener('submit', event => {
    event.preventDefault()
    form.hidden = true
    void change(updateId ? { action: 'update', id: updateId, source: source.value } : { action: 'add', source: source.value })
  })
  data.onScanners = paint
  void read()
  return { refresh: read, focus(id?: string) {
    if (!id) { search.focus(); return }
    search.value = ''
    if (state) paintRows(state)
    setBusy()
    const row = rows.querySelector<HTMLElement>(`[data-scanner-id="${CSS.escape(id)}"]`)
    if (!row) { search.focus(); return }
    row.querySelector('details')!.open = true
    row.scrollIntoView({ block: 'nearest' })
    row.querySelector<HTMLElement>('summary')!.focus()
  } }
}
