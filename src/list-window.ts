import type { Command } from 'commander'

/**
 * Paging for plain lists, named after the options agents already know: `git log --max-count --skip`
 * and `grep --count`. A window applies to an ordered list, so consecutive windows of unchanged
 * output neither overlap nor leave items out.
 */

/** Items one command prints when no `--max-count` is given. */
export const defaultPageSize = 50

export interface ListWindowInput {
  maxCount?: string
  skip?: string
  count?: boolean
  json?: boolean
}

export interface ListWindow {
  skip: number
  /** Items to print; absent only when counting without a chosen count. */
  maxCount?: number
  count: boolean
  /** The typed arguments, repeated with a new `--skip` to name the following items. */
  command: readonly string[]
}

export interface ListPage<Item> {
  items: Item[]
  skip: number
  total: number
  /** The `--skip` value that prints the following items, or null when the page ends the list. */
  nextSkip: number | null
}

export function withListWindowOptions(command: Command): Command {
  return command
    .option('--max-count <n>', `print at most n items (default ${defaultPageSize})`)
    .option('--skip <n>', 'leave out the first n items')
    .option('--count', 'print only the number of items')
}

function positiveInteger(value: string | undefined, option: string): number | undefined {
  if (value === undefined) return undefined
  const text = value.trim()
  if (!/^[1-9]\d*$/.test(text)) throw new Error(`${option} must be a positive integer (1 or greater).`)
  return Number(text)
}

function countingInteger(value: string | undefined, option: string): number | undefined {
  if (value === undefined) return undefined
  const text = value.trim()
  if (!/^\d+$/.test(text)) throw new Error(`${option} must be a non-negative integer (0 or greater).`)
  return Number(text)
}

/** True when the run asked for a window, so an interactive command prints text instead. */
export function listWindowRequested(input: ListWindowInput): boolean {
  return input.count === true || input.maxCount !== undefined || input.skip !== undefined
}

/** Reads the window of one command run; the typed arguments name the command for the following items. */
export function parseListWindow(input: ListWindowInput, command: readonly string[]): ListWindow {
  if (input.count === true && input.json === true) throw new Error('--count cannot be combined with --json.')
  const chosen = positiveInteger(input.maxCount, '--max-count')
  const count = input.count === true
  const maxCount = count ? chosen : chosen ?? defaultPageSize
  return {
    skip: countingInteger(input.skip, '--skip') ?? 0,
    ...(maxCount === undefined ? {} : { maxCount }),
    count,
    command,
  }
}

export function listPage<Item>(items: readonly Item[], window: ListWindow): ListPage<Item> {
  const end = window.maxCount === undefined ? items.length : Math.min(items.length, window.skip + window.maxCount)
  return {
    items: items.slice(window.skip, end),
    skip: window.skip,
    total: items.length,
    nextSkip: end < items.length ? end : null,
  }
}

function quoted(argument: string): string {
  return /^[\w@+:,./-]+$/.test(argument) ? argument : `'${argument.replaceAll("'", "'\\''")}'`
}

/** The typed command with its `--skip` replaced, so running it prints the following items. */
function nextPageCommand(command: readonly string[], nextSkip: number): string {
  const kept: string[] = []
  for (let index = 0; index < command.length; index += 1) {
    const argument = command[index] ?? ''
    if (argument === '--skip') {
      index += 1
      continue
    }
    if (argument.startsWith('--skip=')) continue
    kept.push(argument)
  }
  return ['groma', ...kept, '--skip', String(nextSkip)].map(quoted).join(' ')
}

/** Names the printed range, the total and the command for the following items; nothing for a complete list. */
export function listWindowFooter(page: ListPage<unknown>, command: readonly string[]): string | undefined {
  if (page.items.length === page.total) return undefined
  const range = page.items.length > 0 ? `${page.skip + 1}-${page.skip + page.items.length}` : '0'
  const summary = `Showing ${range} of ${page.total} items.`
  return page.nextSkip === null ? summary : `${summary} Next: ${nextPageCommand(command, page.nextSkip)}`
}

/** Prints one page of items, then any closing lines, then the footer when items were left out. */
export function printListPage(
  items: readonly string[],
  window: ListWindow,
  closing: readonly string[] = [],
): void {
  const page = listPage(items, window)
  if (window.count) {
    console.log(page.items.length)
    return
  }
  for (const item of page.items) console.log(item)
  for (const line of closing) console.log(line)
  const footer = listWindowFooter(page, window.command)
  if (footer !== undefined) console.log(footer)
}
