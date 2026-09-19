import { revisionSettings, revisionSettingsCss } from './revisions.ts'
import type { WebDataSource } from '../data.ts'
import { createSettingsDialog } from '../atoms/settings-dialog.ts'
import { bindScannerSettings } from '../scanners/settings.ts'
import { bindPopover } from '../atoms/popover.ts'
import { scannerWarning } from './model.ts'

export const settingsControl = (theme: string) => '<button id="scanner-warning" class="chrome-button" type="button" aria-label="Scanning needs attention" title="Scanning needs attention" aria-haspopup="dialog" aria-expanded="false" aria-controls="project-settings" hidden><svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3h.01"/></svg></button>'
  + '<details id="settings-menu"><summary id="settings-toggle" class="chrome-button" aria-label="Settings" title="Settings" aria-controls="settings-options"><svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--paper)"/><circle cx="15" cy="17" r="3" fill="var(--paper)"/></svg></summary><div id="settings-options" class="anchored-popover"><button id="plugins-settings" class="anchored-option" type="button" aria-haspopup="dialog" aria-controls="project-settings" hidden>Plugins</button>' + theme + '</div></details>'

export const settingsCss = revisionSettingsCss + `
  #plugins-settings[hidden], #scanner-warning[hidden] { display: none; }
  #settings-menu { position: relative; --popover-width: 190px; }
  #settings-menu::details-content, #settings-menu #theme::details-content {
    transition: content-visibility 180ms allow-discrete;
  }
  #settings-options, #settings-menu .theme-menu {
    opacity: 0; transform: translateY(-5px) scale(.97); transform-origin: top right; pointer-events: none;
    transition: opacity 140ms ease, transform 180ms cubic-bezier(.22, 1, .36, 1);
  }
  #settings-options { overflow: visible; }
  #settings-menu .theme-menu { transform: translateX(6px) scale(.97); }
  #settings-menu[open] > #settings-options, #settings-menu[open] #theme[open] > .theme-menu {
    opacity: 1; transform: none; pointer-events: auto;
  }
  @starting-style {
    #settings-menu[open] > #settings-options { opacity: 0; transform: translateY(-5px) scale(.97); }
    #settings-menu[open] #theme[open] > .theme-menu { opacity: 0; transform: translateX(6px) scale(.97); }
  }
  @media (prefers-reduced-motion: reduce) {
    #settings-menu::details-content, #settings-menu #theme::details-content,
    #settings-options, #settings-menu .theme-menu { transition: none; }
  }
  #settings-toggle { list-style: none; width: 32px; height: 32px; padding: 0; justify-content: center; }
  #settings-toggle::-webkit-details-marker { display: none; }
  #settings-options > .anchored-option { font: inherit; cursor: pointer; }
  #scanner-warning { width: 32px; height: 32px; padding: 0; justify-content: center; color: var(--syntax-number); }
  #project-settings > h2 { margin: 0; font-size: 13px; }
`

export function createProjectSettings(data: WebDataSource) {
  const toggle = document.getElementById('settings-toggle')!
  const menu = document.getElementById('settings-menu') as HTMLDetailsElement
  const theme = document.getElementById('theme') as HTMLDetailsElement
  const plugins = document.getElementById('plugins-settings')!
  const dismiss = () => { menu.open = false; theme.open = false }
  bindPopover(menu, { dismiss })
  menu.addEventListener('toggle', () => { if (!menu.open) theme.open = false })
  menu.addEventListener('keydown', event => {
    event.stopPropagation()
    if (event.key !== 'Escape') return
    event.preventDefault()
    if (theme.open) { theme.open = false; theme.querySelector('summary')!.focus() }
    else { dismiss(); toggle.focus() }
  })
  if (!data.readScanners || !data.changeScanners) return
  const warning = document.getElementById('scanner-warning')!
  plugins.hidden = false
  let target: ReturnType<typeof scannerWarning>
  const popup = createSettingsDialog('project-settings', 'Settings', '<h2 id="plugins-title">Plugins</h2><section id="scanner-settings" aria-labelledby="plugins-title"></section><section id="revision-settings"></section>')
  const revisions = revisionSettings(data, popup.dialog.querySelector<HTMLElement>('#revision-settings')!)
  const settings = bindScannerSettings(data, popup.dialog.querySelector<HTMLElement>('#scanner-settings')!, state => {
    target = scannerWarning(state)
    warning.hidden = !target
    const label = target?.scannerId ? `${target.scannerId} needs attention` : 'Scanning needs attention'
    warning.title = label
    warning.setAttribute('aria-label', label)
  })
  plugins.addEventListener('click', () => { dismiss(); popup.open(toggle); settings.focus(); void settings.refresh(); void revisions.refresh() })
  warning.addEventListener('click', () => { dismiss(); popup.open(warning); settings.focus(target?.scannerId); void settings.refresh(); void revisions.refresh() })
}
