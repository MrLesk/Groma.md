import type { AnnotatedElement } from '../../../types.ts'
import type { SourcePayload } from './read.ts'
import { leaveSource, paintSource } from './view.ts'

export interface SourceControl {
  readonly file: string | undefined
  back(): void
  clear(): void
  open(file: string): void
  paint(element: AnnotatedElement | undefined): boolean
  restore(): void
}

interface SourceControlOptions {
  host: HTMLElement
  initialFile?: string
  element(): AnnotatedElement | undefined
  revision(): string | undefined
  repaint(): void
}

function ownsFile(element: AnnotatedElement | undefined, file: string): element is AnnotatedElement {
  return element?.kind === 'component' && element.code.some(reference => reference.file === file)
}

function sameRequest(
  options: SourceControlOptions,
  request: number,
  activeRequest: number,
  revision: string | undefined,
  elementId: string,
): boolean {
  return request === activeRequest
    && options.revision() === revision
    && options.element()?.representationId === elementId
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error && reason.message !== '' ? reason.message : 'Source unavailable'
}

/** Owns the one-level source drill-down without changing the architecture selection beneath it. */
export function createSourceControl(options: SourceControlOptions): SourceControl {
  let file = options.initialFile
  let payload: SourcePayload | undefined
  let error: string | undefined
  let request = 0

  function clear(): void {
    request += 1
    file = undefined
    payload = undefined
    error = undefined
  }

  function back(): void {
    clear()
    options.repaint()
  }

  async function load(nextFile: string): Promise<void> {
    const element = options.element()
    if (!ownsFile(element, nextFile)) return
    const elementId = element.representationId
    const revision = options.revision()
    const activeRequest = ++request
    file = nextFile
    payload = undefined
    error = undefined
    options.repaint()
    const query = new URLSearchParams({ element: elementId, file: nextFile })
    if (revision !== undefined) query.set('revision', revision)
    try {
      const response = await fetch(`/source.json?${query}`)
      if (!response.ok) throw new Error(await response.text())
      const loaded = await response.json() as SourcePayload
      if (!sameRequest(options, request, activeRequest, revision, elementId)) return
      payload = loaded
    } catch (reason) {
      if (activeRequest !== request) return
      error = errorMessage(reason)
    }
    options.repaint()
  }

  return {
    get file() {
      return file
    },
    back,
    clear,
    open(nextFile) {
      void load(nextFile)
    },
    paint(element) {
      if (file === undefined) {
        leaveSource(options.host)
        return false
      }
      if (!ownsFile(element, file)) {
        clear()
        leaveSource(options.host)
        return false
      }
      paintSource(options.host, element, file, payload, error, back)
      return true
    },
    restore() {
      if (file !== undefined) void load(file)
    },
  }
}
