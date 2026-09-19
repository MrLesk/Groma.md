import type { WebDataSource } from '../data.ts'
import { escaped } from '../atoms/escape.ts'
import { scannerName } from './name.ts'
import { isNpmPackageName } from '../../../scanner/modules/published.ts'
import { scannerGroups, scannerSettingAction, scannerUpgradeAction, scannerMatchReason, type ScannerSetting, type ScannerSettings, type ScannerSettingsAction } from '../../../scanner/modules/settings-model.ts'

export const scannerSettingsCss = `
  #scanner-settings { min-height: 0; display: flex; flex-direction: column; gap: 16px; }
  #scanner-settings .scanner-tools { display: flex; gap: 12px; }
  #scanner-settings .scanner-tools input { flex: 1; min-width: 0; }
  #scanner-settings [data-rows] { overflow: auto; min-height: 0; }
  #scanner-settings button { white-space: nowrap; }
  #scanner-settings button:disabled { opacity: .5; cursor: not-allowed; }
  #scanner-settings [data-action="install"], #scanner-settings [data-action="restore"], #scanner-settings [data-action="update"], #scanner-settings [data-group] { color: var(--accent-text); }
  #scanner-settings .scanner-group { display: grid; gap: 8px; margin-bottom: 20px; }
  #scanner-settings .scanner-group:last-child { margin-bottom: 0; }
  #scanner-settings .scanner-group-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
  #scanner-settings h2 { flex: 1; margin: 0; font-size: 12px; }
  #scanner-settings .scanner-count { color: var(--muted); font-weight: 400; margin-left: 8px; }
  #scanner-settings .scanner-row { min-width: 0; border: 1px solid var(--hairline); border-radius: var(--control-radius); overflow: hidden; }
  #scanner-settings .scanner-header { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 10px 14px; }
  #scanner-settings .scanner-heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 12px; flex: 1; min-width: 120px; overflow-wrap: anywhere; }
  #scanner-settings .scanner-heading strong { font-size: 14px; font-weight: 600; }
  #scanner-settings .scanner-version { color: var(--muted); font-size: 11px; }
  #scanner-settings .scanner-status { font-size: 11px; color: var(--muted); }
  #scanner-settings .scanner-status.attention { color: var(--syntax-number); }
  #scanner-settings .scanner-primary:has(button) { display: flex; }
  #scanner-settings .scanner-primary button { border-color: color-mix(in srgb, var(--accent) 45%, var(--hairline)); background: var(--hover); color: var(--accent-text); }
  #scanner-settings summary { padding: 0 14px 10px; cursor: pointer; color: var(--muted); font-size: 12px; }
  #scanner-settings summary:hover { color: var(--ink); }
  #scanner-settings .scanner-body { padding: 12px 14px; border-top: 1px solid var(--hairline); display: grid; gap: 12px; }
  #scanner-settings .scanner-body p, #scanner-settings pre { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; margin: 0; }
  #scanner-settings .scanner-package { overflow-wrap: anywhere; color: var(--muted); font: inherit; font-size: 11px; }
  #scanner-settings .scanner-evidence { list-style: none; margin: 0; padding: 0; max-height: 240px; overflow: auto; }
  #scanner-settings .scanner-evidence li { padding: 12px 0; border-top: 1px solid var(--hairline); overflow-wrap: anywhere; font-size: 11px; }
  #scanner-settings .scanner-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  #scanner-settings [data-action="remove"] { color: var(--diff-removed); }
  #scanner-settings .scanner-notice { margin: 0; color: var(--muted); }
  #scanner-settings .scanner-notice[data-tone="error"], #scanner-settings .scanner-notice[data-tone="warning"] { color: var(--syntax-number); }
  #scanner-settings form { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; }
  #scanner-settings label { display: grid; gap: 8px; flex: 1; min-width: 0; }
  #scanner-settings input { width: 100%; box-sizing: border-box; border: 1px solid var(--hairline); border-radius: var(--control-radius); background: var(--paper); color: var(--ink); padding: 9px; font: inherit; }
  #scanner-settings .scanner-error { color: var(--diff-removed); }
  #scanner-settings .scanner-error summary { color: inherit; }
  #scanner-settings [hidden] { display: none; }
  @media (max-width: 640px) {
    #scanner-settings .scanner-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 10px; }
    #scanner-settings .scanner-heading { grid-column: 1; grid-row: 1; min-width: 0; }
    #scanner-settings .scanner-status { grid-column: 1; grid-row: 2; }
    #scanner-settings .scanner-primary { grid-column: 2; grid-row: 1 / span 2; }
    #scanner-settings form label { flex-basis: 100%; }
  }
`

function rowActions(scanner: ScannerSetting, upgrades: ScannerSettings['upgrades']) {
  const id = escaped(scanner.id)
  const button = (action: string, title: string) => `<button class="chrome-button" type="button" data-action="${action}" data-id="${id}">${title}</button>`
  const action = scannerUpgradeAction(scanner, upgrades) ?? scannerSettingAction(scanner)
  const primary = action ? button(action.action, action.action === 'update' ? 'Update' : action.action === 'retry' ? 'Retry' : 'Install') : ''
  const npm = scanner.source && isNpmPackageName(scanner.source.slice(0, scanner.source.lastIndexOf('@')))
  const update = npm ? button('version', 'Choose version') : button('version', 'Update')
  const retry = action?.action === 'update' && scanner.status === 'blocked' ? button('retry', 'Retry scan') : ''
  const more = scanner.source ? retry + update + button('remove', 'Remove from project') : ''
  return { primary, more }
}

function detectionDetails(scanner: ScannerSetting): string {
  if (!scanner.matches.length) return ''
  return `<input type="search" data-evidence-search aria-label="Search ${escaped(scannerName(scanner.id))} detection details" placeholder="Filter by path…">`
    + `<ul class="scanner-evidence">${scanner.matches.map(file => `<li>${escaped(file)}</li>`).join('')}</ul><p data-no-matches hidden>No matching paths</p>`
}

function settingRow(scanner: ScannerSetting, upgrades: ScannerSettings['upgrades']): string {
  const { primary, more } = rowActions(scanner, upgrades)
  const upgrade = scanner.source ? upgrades?.[scanner.source] : undefined
  const attention = scanner.status === 'blocked' || scanner.status === 'missing'
  const status = { blocked: 'Needs attention', missing: 'Needs attention', ready: 'Installed', unchecked: 'Installed', available: '' }[scanner.status]
  const badge = status ? `<span class="scanner-status${attention ? ' attention' : ''}">${status}</span>` : ''
  const reason = scanner.match === 'matched' ? '' : `<p>${escaped(scannerMatchReason(scanner))}</p>`
  const version = [scanner.version, upgrade?.version].filter(Boolean).join(' → ')
  const metadata = [version, scanner.official ? 'Official' : 'Third-party'].filter(Boolean).join(' · ')
  const updateError = upgrade?.error ? `<p>Could not check for updates. ${escaped(upgrade.error)}</p>` : ''
  const count = scanner.matches.length
  const matchingFiles = `${count} matching ${count === 1 ? 'file' : 'files'}`
  const details = attention || !count ? 'Scanner details' : matchingFiles
  return `<section class="scanner-row" data-scanner-id="${escaped(scanner.id)}"><div class="scanner-header"><div class="scanner-heading"><strong>${escaped(scannerName(scanner.id))}</strong><span class="scanner-version">${escaped(metadata)}</span></div>${badge}<div class="scanner-primary">${primary}</div></div>`
    + `<details><summary>${details}</summary><div class="scanner-body"><code class="scanner-package">${escaped(scanner.source ?? scanner.installSource ?? scanner.name)}</code>`
    + `${reason}${scanner.message ? `<p>${escaped(scanner.message)}</p>` : ''}${detectionDetails(scanner)}${updateError}<div class="scanner-actions">${more}</div></div></details></section>`
}

function filterEvidence(input: HTMLInputElement): void {
  const body = input.closest('.scanner-body')!
  const query = input.value.trim().toLocaleLowerCase()
  const items = [...body.querySelectorAll<HTMLElement>('.scanner-evidence li')]
  for (const item of items) item.hidden = !item.textContent.toLocaleLowerCase().includes(query)
  body.querySelector<HTMLElement>('[data-no-matches]')!.hidden = items.some(item => !item.hidden)
}

function settingGroup(group: ReturnType<typeof scannerGroups>[number], showBulk: boolean, upgrades: ScannerSettings['upgrades']): string {
  const missing = group.scanners.every(scanner => scanner.status === 'missing')
  const recommended = group.scanners.every(scanner => !scanner.source)
  const title = missing ? 'Set up for this project' : group.title
  const action = missing ? 'install-missing' : recommended ? 'install-recommended' : undefined
  const installable = group.scanners.filter(scanner => scanner.status === 'missing' || scanner.installSource).length
  const bulk = showBulk && action && installable > 1 ? `<button class="chrome-button" type="button" data-group="${action}">${missing ? 'Install missing' : 'Install all'}</button>` : ''
  return `<section class="scanner-group"><div class="scanner-group-heading"><h2>${title}<span class="scanner-count">${group.scanners.length}</span></h2>${bulk}</div>${group.scanners.map(scanner => settingRow(scanner, upgrades)).join('')}</section>`
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
  let upgrades: ScannerSettings['upgrades']
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
    const focusedSelector = document.activeElement?.matches('[data-evidence-search]') ? '[data-evidence-search]' : 'button'
    const filters = new Map([...rows.querySelectorAll<HTMLInputElement>('[data-evidence-search]')].map(input => [input.closest<HTMLElement>('[data-scanner-id]')!.dataset.scannerId, input.value]))
    const groups = scannerGroups(next.scanners, search.value)
    rows.innerHTML = groups.length ? groups.map(group => settingGroup(group, !search.value.trim(), upgrades)).join('') : '<p>No scanners match.</p>'
    for (const detail of rows.querySelectorAll('details')) detail.open = expanded.has(detail.closest<HTMLElement>('[data-scanner-id]')?.dataset.scannerId)
    for (const input of rows.querySelectorAll<HTMLInputElement>('[data-evidence-search]')) {
      input.value = filters.get(input.closest<HTMLElement>('[data-scanner-id]')!.dataset.scannerId) ?? ''
      filterEvidence(input)
    }
    if (focused) rows.querySelector<HTMLElement>(`[data-scanner-id="${CSS.escape(focused)}"] ${focusedSelector}`)?.focus()
  }
  function setBusy() {
    for (const button of host.querySelectorAll<HTMLButtonElement>('button')) button.disabled = busy !== undefined
    if (!busy || !('id' in busy)) return
    const button = rows.querySelector<HTMLButtonElement>(`[data-scanner-id="${CSS.escape(busy.id)}"] .scanner-primary button`)
    if (!button) return
    button.textContent = busy.action === 'remove' ? 'Removing…' : busy.action === 'update' ? 'Updating…' : 'Installing…'
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
  async function read(checkUpdates = false) {
    try {
      const next = await data.readScanners!(checkUpdates)
      if (checkUpdates) upgrades = next.upgrades
      paint(checkUpdates ? state ?? next : next)
    }
    catch (cause) {
      showError('Could not load scanners', String(cause))
      if (!checkUpdates) onState({ scanners: [], notice: { tone: 'error', message: String(cause) }, limits: [] })
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
      const next = 'id' in action ? rows.querySelector<HTMLElement>(`[data-scanner-id="${CSS.escape(action.id)}"] .scanner-primary button`) : undefined
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
  rows.addEventListener('input', event => {
    if (event.target instanceof HTMLInputElement && event.target.matches('[data-evidence-search]')) filterEvidence(event.target)
  })
  rows.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null
    if (!button) return
    if (button.dataset.group) { void change({ action: button.dataset.group as 'install-recommended' | 'install-missing' }); return }
    const id = button.dataset.id!, action = button.dataset.action
    switch (action) {
      case 'retry': void change({ action }); break
      case 'update': {
        const scanner = state?.scanners.find(item => item.id === id)
        const update = scanner && scannerUpgradeAction(scanner, upgrades)
        if (update) void change(update)
        break
      }
      case 'version': sourceForm(id); break
      case 'install': case 'restore': case 'remove': void change({ action, id }); break
    }
  })
  form.addEventListener('submit', event => {
    event.preventDefault()
    form.hidden = true
    void change(updateId ? { action: 'update', id: updateId, source: source.value } : { action: 'add', source: source.value })
  })
  data.onScanners = paint
  void read()
  return { refresh: () => read(true), focus(id?: string) {
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
