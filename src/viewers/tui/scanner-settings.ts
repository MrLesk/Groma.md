import { createCliRenderer, FrameBufferRenderable, RGBA, type CliRenderer, type KeyEvent, type PasteEvent } from '@opentui/core'
import { watchArchitecture } from '../../architecture-watch.ts'
import { createScannerSession, type ScannerSession } from '../../scanner/session.ts'
import { scannerSettingLabel, type ScannerSetting, type ScannerSettingsAction } from '../../scanner/modules/settings-model.ts'
import { loadWelcomeModel, welcomeSheet } from '../../welcome/model.ts'
import { paintShell } from '../../welcome/view.ts'
import { wrap } from './panes/text.ts'
import { text } from './atoms/text.ts'

/** A keyboard-only settings page, shared by the launcher and the live terminal map. */
export async function mountScannerSettings(renderer: CliRenderer, session: ScannerSession, root: string): Promise<void> {
  const model = await loadWelcomeModel(root)
  const sheet = welcomeSheet(model)
  const green = RGBA.fromHex('#1D9E75'), amber = RGBA.fromHex('#D8A652'), blue = RGBA.fromHex('#7AAFC5')
  const foreground = RGBA.defaultForeground(), background = RGBA.defaultBackground()
  let selected = 0, busy = false, closed = false
  let input: { action: 'add' | 'update'; value: string; id?: string } | undefined
  let message = ''
  const done = Promise.withResolvers<void>()
  const frame = new FrameBufferRenderable(renderer, {
    id: 'scanner-settings', width: renderer.width, height: renderer.height, position: 'absolute', left: 0, top: 0, zIndex: 100,
    onSizeChange: () => paint(),
  })
  frame.width = '100%'
  frame.height = '100%'
  renderer.root.add(frame)
  function line(value: string, y: number, color = foreground) {
    text(frame.frameBuffer, value, 4, y, frame.width - 8, color, background)
  }
  function primaryAction(scanner: ScannerSetting): ScannerSettingsAction | undefined {
    if (scanner.source) return scanner.status === 'missing' ? { action: 'restore', id: scanner.id } : { action: 'check' }
    if (scanner.installSource) return { action: 'install', id: scanner.id }
    return undefined
  }
  function paintDetails(scanner: ScannerSetting | undefined, y: number) {
    if (!scanner) return
    const details = [
      `Source: ${scanner.source ?? scanner.installSource ?? scanner.name}`,
      `Matches: ${scanner.matches.join(', ') || (scanner.match === 'unknown' ? 'Unknown' : 'No project files')}`,
      scanner.message,
    ].flatMap(value => wrap(value, frame.width - 8))
    details.slice(0, frame.height - y - 4).forEach((value, index) => { line(value, y + index) })
  }
  function paintRow(scanner: ScannerSetting, index: number, y: number) {
    const action = primaryAction(scanner)?.action
    const label = action ? `[${action[0]!.toUpperCase()}${action.slice(1)}]` : 'Details'
    line(`${index === selected ? '> ' : '  '}${scanner.id.padEnd(24)}│ ${scannerSettingLabel(scanner).padEnd(27)}│ ${label}`, y, index === selected ? green : foreground)
  }
  function paint() {
    if (closed || frame.isDestroyed) return
    const { contentY: y } = paintShell(frame.frameBuffer, model, sheet)
    const state = session.state
    selected = Math.min(selected, Math.max(0, state.scanners.length - 1))
    const count = Math.max(1, Math.min(state.scanners.length, Math.floor((frame.height - y - 8) / 2)))
    const first = Math.max(0, selected - count + 1)
    line('Scanners                                      [a] Add scanner  [r] Check again', y, green)
    line('Scanner                   │ Status                     │ Action', y + 2)
    line('──────────────────────────┼────────────────────────────┼────────────────', y + 3)
    state.scanners.slice(first, first + count).forEach((scanner, index) => { paintRow(scanner, first + index, y + 4 + index) })
    const bottom = y + count + 5
    paintDetails(state.scanners[selected], bottom)
    line(message || state.notice.message, frame.height - 3, state.notice.tone === 'hint' ? blue : amber)
    line(input ? `${input.action === 'add' ? 'Scanner source' : 'New version source'}: ${input.value}▌` : '[↑↓] Select  [Enter] Action  [x] Remove  [u] Update  [Esc] Back', frame.height - 2)
    line(busy ? 'Working…' : 'Removing a scanner keeps saved architecture.', frame.height - 1)
    frame.requestRender()
  }
  async function change(action: ScannerSettingsAction) {
    busy = true; message = ''; paint()
    try { await session.change(action) }
    catch (error) { message = error instanceof Error ? error.message : String(error) }
    finally { busy = false; paint() }
  }
  function close() {
    if (closed) return
    closed = true
    unsubscribe()
    renderer.keyInput.off('keypress', onKey)
    renderer.keyInput.off('paste', onPaste)
    renderer.off('destroy', close)
    frame.destroy()
    done.resolve()
  }
  function inputKey(key: KeyEvent) {
    if (!input) return
    if (key.name === 'escape') input = undefined
    else if (key.name === 'backspace') input.value = input.value.slice(0, -1)
    else if (key.name === 'return' && input.value.trim()) {
      const action: ScannerSettingsAction = input.action === 'add' ? { action: 'add', source: input.value } : { action: 'update', id: input.id!, source: input.value }
      input = undefined; void change(action)
    } else if (!key.ctrl && !key.meta && key.sequence && !key.sequence.includes('\x1b')) input.value += key.sequence
    paint()
  }
  function onPaste(event: PasteEvent) {
    if (!input || busy) return
    input.value += new TextDecoder().decode(event.bytes).replace(/[\r\n]/g, '')
    paint()
  }
  function scannerKey(key: KeyEvent, scanner: ScannerSetting) {
    if (key.name === 'u' && scanner.source) input = { action: 'update', id: scanner.id, value: scanner.source }
    if (key.name === 'x' && scanner.source) void change({ action: 'remove', id: scanner.id })
    if (key.name === 'return') {
      const action = primaryAction(scanner)
      if (action) void change(action)
    }
  }
  function navigationKey(key: KeyEvent) {
    switch (key.name) {
      case 'escape': case 'q': close(); return
      case 'up': selected = Math.max(0, selected - 1); break
      case 'down': selected = Math.min(session.state.scanners.length - 1, selected + 1); break
      case 'a': input = { action: 'add', value: '' }; break
      case 'r': void change({ action: 'check' }); break
      default: {
        const scanner = session.state.scanners[selected]
        if (scanner) scannerKey(key, scanner)
      }
    }
    paint()
  }
  function onKey(key: KeyEvent) {
    if (key.eventType === 'release') return
    key.preventDefault()
    if (key.ctrl && key.name === 'c') { renderer.destroy(); return }
    if (key.name === 'escape' && !input) { close(); return }
    if (busy) return
    if (input) inputKey(key)
    else navigationKey(key)
  }
  const unsubscribe = session.subscribe(paint)
  renderer.keyInput.on('keypress', onKey)
  renderer.keyInput.on('paste', onPaste)
  renderer.once('destroy', close)
  paint()
  await done.promise
}

export async function startScannerSettings(root: string): Promise<void> {
  const session = await createScannerSession(root, { scan: false })
  const renderer = await createCliRenderer({ clearOnShutdown: true, consoleMode: 'disabled', exitOnCtrlC: true, screenMode: 'alternate-screen', useMouse: false })
  const architecture = await watchArchitecture(root, { onChange: () => session.reconfigure() })
  try { await mountScannerSettings(renderer, session, root) }
  finally { await architecture.close(); await session.close(); renderer.destroy() }
}
