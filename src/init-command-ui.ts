import {
  ConfirmPrompt,
  SelectPrompt,
  TextPrompt,
} from '@clack/core'
import type { State } from '@clack/core'
import {
  S_BAR,
  S_BAR_END,
  S_BAR_H,
  S_BAR_START,
  S_CONNECT_LEFT,
  S_CORNER_BOTTOM_RIGHT,
  S_CORNER_TOP_RIGHT,
  S_RADIO_ACTIVE,
  S_RADIO_INACTIVE,
  S_STEP_ACTIVE,
  S_STEP_CANCEL,
  S_STEP_ERROR,
  S_STEP_SUBMIT,
  limitOptions,
  spinner,
} from '@clack/prompts'
import {
  createTerminalPalette,
  normalizeTerminalPalette,
} from '@opentui/core'
import { styleText, stripVTControlCharacters } from 'node:util'

import { GROMA_ACCENT, GROMA_ACCENT_ON_LIGHT } from './brand.ts'
import type {
  InitCommandUi,
  InitViewer,
  PackageInstaller,
} from './init-command.ts'
import type { GromaDirectory } from './groma-filesystem.ts'

const output = process.stdout

interface SelectChoice<T extends string> {
  hint?: string
  label: string
  value: T
}

function foreground(hex: string, value: string): string {
  const [red, green, blue] = [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16))
  return `\u001B[38;2;${red};${green};${blue}m${value}\u001B[39m`
}

export function accentForBackground(red: number, green: number, blue: number): string {
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
  return luminance > 0.55 ? GROMA_ACCENT_ON_LIGHT : GROMA_ACCENT
}

async function detectAccent(): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return GROMA_ACCENT
  const detector = createTerminalPalette({ stdin: process.stdin, stdout: process.stdout })
  try {
    const palette = normalizeTerminalPalette(await detector.detect({ timeout: 100 }))
    const [red, green, blue] = palette.defaultBackground.toInts()
    return accentForBackground(red, green, blue)
  } finally {
    detector.cleanup()
  }
}

function promptSymbol(state: State, accent: (value: string) => string): string {
  if (state === 'cancel') return styleText('red', S_STEP_CANCEL)
  if (state === 'error') return styleText('yellow', S_STEP_ERROR)
  return accent(state === 'submit' ? S_STEP_SUBMIT : S_STEP_ACTIVE)
}

async function textPrompt(
  message: string,
  accent: (value: string) => string,
  current?: string,
): Promise<string | symbol | undefined> {
  return new TextPrompt({
    defaultValue: current,
    placeholder: current,
    validate: candidate => (candidate ?? current)?.trim()
      ? undefined
      : 'Project name is required.',
    render() {
      const heading = `${promptSymbol(this.state, accent)}  ${message}\n`
      const placeholder = current
        ? styleText('dim', current)
        : styleText(['inverse', 'hidden'], '_')
      const value = this.userInput ? this.userInputWithCursor : placeholder
      if (this.state === 'error') {
        return `${heading.trim()}\n${styleText('yellow', S_BAR)}  ${value}\n${styleText('yellow', S_BAR_END)}  ${styleText('yellow', this.error)}\n`
      }
      if (this.state === 'submit') {
        return `${heading}${styleText('gray', S_BAR)}  ${styleText('dim', this.value ?? '')}`
      }
      if (this.state === 'cancel') {
        return `${heading}${styleText('gray', S_BAR)}  ${styleText(['strikethrough', 'dim'], this.value ?? '')}`
      }
      return `${heading}${accent(S_BAR)}  ${value}\n${accent(S_BAR_END)}\n`
    },
  }).prompt()
}

async function confirmPrompt(
  message: string,
  accent: (value: string) => string,
): Promise<boolean | symbol | undefined> {
  const active = 'Yes'
  const inactive = 'No'
  return new ConfirmPrompt({
    active,
    inactive,
    initialValue: true,
    render() {
      const heading = `${promptSymbol(this.state, accent)}  ${message}\n`
      const selected = this.value ? active : inactive
      if (this.state === 'submit') {
        return `${heading}${styleText('gray', S_BAR)}  ${styleText('dim', selected)}`
      }
      if (this.state === 'cancel') {
        return `${heading}${styleText('gray', S_BAR)}  ${styleText(['strikethrough', 'dim'], selected)}\n${styleText('gray', S_BAR)}`
      }
      const yes = this.value
        ? `${accent(S_RADIO_ACTIVE)} ${active}`
        : `${styleText('dim', S_RADIO_INACTIVE)} ${styleText('dim', active)}`
      const no = this.value
        ? `${styleText('dim', S_RADIO_INACTIVE)} ${styleText('dim', inactive)}`
        : `${accent(S_RADIO_ACTIVE)} ${inactive}`
      return `${heading}${accent(S_BAR)}  ${yes} ${styleText('dim', '/')} ${no}\n${accent(S_BAR_END)}\n`
    },
  }).prompt()
}

async function selectPrompt<T extends string>(
  message: string,
  options: SelectChoice<T>[],
  accent: (value: string) => string,
  initialValue?: T,
): Promise<T | symbol | undefined> {
  const label = (option: SelectChoice<T>, active = false): string => {
    const text = option.label
    if (!active) return `${styleText('dim', S_RADIO_INACTIVE)} ${styleText('dim', text)}`
    const hint = option.hint ? ` ${styleText('dim', `(${option.hint})`)}` : ''
    return `${accent(S_RADIO_ACTIVE)} ${text}${hint}`
  }
  return new SelectPrompt<SelectChoice<T>>({
    initialValue,
    options,
    render() {
      const heading = `${promptSymbol(this.state, accent)}  ${message}\n`
      const selected = this.options[this.cursor]
      if (this.state === 'submit') {
        return `${heading}${styleText('gray', S_BAR)}  ${styleText('dim', selected?.label ?? String(selected?.value ?? ''))}`
      }
      if (this.state === 'cancel') {
        return `${heading}${styleText('gray', S_BAR)}  ${styleText(['strikethrough', 'dim'], selected?.label ?? '')}\n${styleText('gray', S_BAR)}`
      }
      const prefix = `${accent(S_BAR)}  `
      const rows = limitOptions({
        columnPadding: 3,
        cursor: this.cursor,
        maxItems: 8,
        options: this.options,
        output,
        rowPadding: 4,
        style: (option, active) => label(option, active),
      })
      const instructions = `${styleText('dim', '↑/↓')} to navigate ${styleText('dim', '• Enter:')} confirm`
      return `${heading}${prefix}${rows.join(`\n${prefix}`)}\n${prefix}${instructions}\n${accent(S_BAR_END)}\n`
    },
  }).prompt()
}

function note(message: string, title: string, accent: (value: string) => string): void {
  const lines = ['', ...message.split('\n'), '']
  const width = Math.max(
    stripVTControlCharacters(title).length,
    ...lines.map(line => stripVTControlCharacters(line).length),
  ) + 2
  output.write(`${styleText('gray', S_BAR)}\n`)
  output.write(`${accent(S_STEP_SUBMIT)}  ${accent(title)} ${styleText('gray', S_BAR_H.repeat(Math.max(width - title.length - 1, 1)) + S_CORNER_TOP_RIGHT)}\n`)
  for (const line of lines) {
    output.write(`${styleText('gray', S_BAR)}  ${line}${' '.repeat(width - stripVTControlCharacters(line).length)}${styleText('gray', S_BAR)}\n`)
  }
  output.write(`${styleText('gray', S_CONNECT_LEFT + S_BAR_H.repeat(width + 2) + S_CORNER_BOTTOM_RIGHT)}\n`)
}

export function createClackInitUi(): InitCommandUi {
  let accentHex = GROMA_ACCENT
  const accent = (value: string) => foreground(accentHex, value)
  const selected = <T>(value: T | symbol | undefined): T | undefined => typeof value === 'symbol' ? undefined : value

  return {
    cancel: message => clackCancel(message),
    confirmBacklogInstall: async () => selected(await confirmPrompt(
      'Backlog.md is not installed. Install it now?',
      accent,
    )),
    confirmInit: async () => selected(await confirmPrompt(
      'Groma is not initialized here. Initialize now? (y/n)',
      accent,
    )),
    confirmScan: async () => selected(await confirmPrompt(
      'Run your first architecture scan now?',
      accent,
    )),
    directory: async () => selected(await selectPrompt<GromaDirectory>(
      'Where should Groma store the architecture?',
      [
        { label: 'groma/ (recommended)', value: 'groma', hint: 'Visible beside the source code' },
        { label: '.groma/', value: '.groma', hint: 'Hidden architecture directory' },
      ],
      accent,
      'groma',
    )),
    error: message => output.write(`${styleText('red', S_STEP_ERROR)}  ${message}\n`),
    install: async (message, operation) => {
      const progress = spinner({ styleFrame: accent })
      progress.start(message)
      const installed = await operation()
      progress.clear()
      const result = installed ? 'Backlog.md installed' : 'Backlog.md installation failed'
      output.write(`${installed ? accent(S_STEP_SUBMIT) : styleText('red', S_STEP_ERROR)}  ${result}\n`)
      return installed
    },
    installer: async () => selected(await selectPrompt<PackageInstaller>(
      'How was Groma installed?',
      [
        { label: 'Bun', value: 'bun' },
        { label: 'npm', value: 'npm' },
        { label: 'Homebrew', value: 'brew' },
      ],
      accent,
    )),
    intro: async () => {
      accentHex = await detectAccent()
      output.write(`${styleText('gray', S_BAR_START)}  ${accent('Groma')} setup\n`)
    },
    note: (message, title) => note(message, title, accent),
    outro: message => output.write(`${styleText('gray', S_BAR)}\n${accent(S_BAR_END)}  ${message}\n\n`),
    projectName: async current => selected(await textPrompt('Project name', accent, current)),
    viewer: async () => selected(await selectPrompt<InitViewer | 'finish'>(
      'Do you want to see your architecture?',
      [
        { label: 'Open in browser', value: 'web', hint: 'Run groma web later' },
        { label: 'Open in terminal', value: 'view', hint: 'Run groma view later' },
        { label: 'Not now', value: 'finish' },
      ],
      accent,
    )),
  }
}

function clackCancel(message: string): void {
  output.write(`${styleText('gray', S_BAR_END)}  ${styleText('red', message)}\n\n`)
}
