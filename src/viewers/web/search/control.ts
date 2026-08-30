import { createArchitectureSearch } from '../../../search.ts'
import type { AnnotatedElement } from '../../../types.ts'
import { paintSearchResults } from './view.ts'

interface SearchControlOptions {
  root: HTMLElement
  elements: readonly AnnotatedElement[]
  onOpen: () => void
  onPreview: (elementId: string | undefined) => void
  onAccept: (elementId: string) => void
  onCancel: () => void
}

interface ShortcutEvent {
  key: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

function editable(target: EventTarget | null): boolean {
  return target instanceof Element
    && target.closest('input, textarea, select, [contenteditable="true"]') !== null
}

/** The Web-only entry keys; ranking and results remain owned by core search. */
export function opensArchitectureSearch(
  event: ShortcutEvent,
  hasEditableTarget: boolean,
  applePlatform: boolean,
): boolean {
  const commandKey = applePlatform
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey
  const modifiedK = event.key.toLowerCase() === 'k'
    && commandKey
    && !event.altKey
  const slash = event.key === '/'
    && !event.metaKey
    && !event.ctrlKey
    && !event.altKey
    && !hasEditableTarget
  return modifiedK || slash
}

export function createSearchControl(options: SearchControlOptions) {
  const { root, onOpen, onPreview, onAccept, onCancel } = options
  const trigger = root.querySelector<HTMLButtonElement>('.search-trigger')!
  const input = root.querySelector<HTMLInputElement>('input')!
  const clear = root.querySelector<HTMLButtonElement>('.search-clear')!
  const menu = root.querySelector<HTMLElement>('.search-menu')!
  const resultsHost = root.querySelector<HTMLElement>('.search-results')!
  const count = root.querySelector<HTMLElement>('.result-count')!
  const shortcut = root.querySelector<HTMLElement>('.search-shortcut')!
  const applePlatform = /Mac|iPhone|iPad/.test(navigator.platform)
  shortcut.textContent = applePlatform ? '⌘K' : 'Ctrl K'

  let search = createArchitectureSearch(options.elements)
  let results = search.find('')
  let activeIndex = 0
  let opened = false
  let closing = false

  function paint(): void {
    const hasQuery = input.value.trim().length > 0
    root.toggleAttribute('data-has-query', hasQuery)
    menu.hidden = !hasQuery
    if (!hasQuery) return
    paintSearchResults(resultsHost, results, activeIndex)
    count.textContent = results.length === 1 ? '1 result' : `${results.length} results`
    const active = results[activeIndex]
    if (active === undefined) input.removeAttribute('aria-activedescendant')
    else input.setAttribute('aria-activedescendant', `architecture-search-result-${activeIndex}`)
  }

  function preview(): void {
    onPreview(results[activeIndex]?.element.representationId)
  }

  function query(): void {
    results = search.find(input.value)
    activeIndex = 0
    paint()
    resultsHost.scrollTop = 0
    preview()
  }

  function open(): void {
    if (closing) return
    if (opened) {
      input.focus()
      return
    }
    opened = true
    root.setAttribute('data-open', '')
    trigger.setAttribute('aria-expanded', 'true')
    onOpen()
    input.focus()
  }

  function close(accepted: boolean): void {
    if (!opened) return
    const result = results[activeIndex]
    opened = false
    closing = true
    root.setAttribute('data-closing', '')
    trigger.setAttribute('aria-expanded', 'false')
    if (accepted && result !== undefined) onAccept(result.element.representationId)
    else onCancel()
    const finish = () => {
      closing = false
      root.removeAttribute('data-open')
      root.removeAttribute('data-closing')
      root.removeAttribute('data-has-query')
      input.value = ''
      results = []
      menu.hidden = true
      input.removeAttribute('aria-activedescendant')
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) finish()
    else input.closest('.search-field')!.addEventListener('animationend', finish, { once: true })
  }

  function move(step: number): void {
    if (results.length === 0) return
    activeIndex = (activeIndex + step + results.length) % results.length
    paint()
    resultsHost.querySelector(`[data-search-result="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' })
    preview()
  }

  trigger.addEventListener('click', open)
  input.addEventListener('input', query)
  clear.addEventListener('click', () => {
    input.value = ''
    results = []
    activeIndex = 0
    paint()
    preview()
    input.focus()
  })
  resultsHost.addEventListener('click', event => {
    const row = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-search-result]')
      : null
    if (row === null) return
    activeIndex = Number(row.dataset.searchResult)
    close(true)
  })
  document.addEventListener('pointerdown', event => {
    if (opened && event.target instanceof Node && !root.contains(event.target)) close(false)
  })

  function handleOpenedKey(key: string): boolean {
    if (key === 'ArrowDown') move(1)
    else if (key === 'ArrowUp') move(-1)
    else if (key === 'Enter' && results[activeIndex] !== undefined) close(true)
    else if (key === 'Escape') close(false)
    else return false
    return true
  }

  document.addEventListener('keydown', event => {
    if (!opened) {
      if (!opensArchitectureSearch(event, editable(event.target), applePlatform)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      open()
      return
    }
    if (!handleOpenedKey(event.key)) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }, true)

  return {
    update(elements: readonly AnnotatedElement[]) {
      search = createArchitectureSearch(elements)
      if (opened && input.value.trim().length > 0) query()
    },
  }
}
