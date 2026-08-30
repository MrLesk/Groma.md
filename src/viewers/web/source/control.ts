import type { AnnotatedElement } from '../../../types.ts'
import type { CodeMethod } from './methods.ts'
import type { SourcePayload } from './read.ts'
import { leaveSource, paintSource } from './view.ts'

export interface SourceControl {
  readonly file: string | undefined
  readonly line: number | undefined
  back(): void
  clear(): void
  methods(): readonly CodeMethod[]
  open(file: string, line?: number): void
  paint(element: AnnotatedElement | undefined): boolean
  restore(): void
}

interface SourceControlOptions {
  host: HTMLElement
  initialFile?: string
  initialLine?: number
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
  let line = options.initialLine
  let payload: SourcePayload | undefined
  let error: string | undefined
  let request = 0
  let methodsElement: AnnotatedElement | undefined
  let methodsRevision: string | undefined
  let codeMethods: readonly CodeMethod[] = []
  let methodsRequest = 0

  function closeSource(): void {
    request += 1
    file = undefined
    line = undefined
    payload = undefined
    error = undefined
  }

  function clear(): void {
    closeSource()
    methodsRequest += 1
    methodsElement = undefined
    methodsRevision = undefined
    codeMethods = []
  }

  function back(): void {
    closeSource()
    options.repaint()
  }

  async function load(nextFile: string, nextLine?: number): Promise<void> {
    const element = options.element()
    if (!ownsFile(element, nextFile)) return
    const elementId = element.representationId
    const revision = options.revision()
    const activeRequest = ++request
    file = nextFile
    line = nextLine
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

  async function loadMethods(element: AnnotatedElement, revision: string | undefined): Promise<void> {
    const activeRequest = ++methodsRequest
    const query = new URLSearchParams({ element: element.representationId })
    if (revision !== undefined) query.set('revision', revision)
    try {
      const response = await fetch(`/methods.json?${query}`)
      if (!response.ok) throw new Error(await response.text())
      const loaded = await response.json() as CodeMethod[]
      if (activeRequest !== methodsRequest || methodsElement !== element || methodsRevision !== revision) return
      codeMethods = loaded
    } catch {
      if (activeRequest !== methodsRequest || methodsElement !== element || methodsRevision !== revision) return
      codeMethods = []
    }
    options.repaint()
  }

  return {
    get file() {
      return file
    },
    get line() {
      return line
    },
    back,
    clear,
    methods() {
      const element = options.element()
      if (element?.kind !== 'component') return []
      const revision = options.revision()
      if (methodsElement === element && methodsRevision === revision) return codeMethods
      methodsElement = element
      methodsRevision = revision
      codeMethods = []
      if (element.code.some(reference => reference.scanner === 'typescript')) {
        void loadMethods(element, revision)
      }
      return codeMethods
    },
    open(nextFile, nextLine) {
      void load(nextFile, nextLine)
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
      paintSource(options.host, element, file, line, payload, error, back)
      return true
    },
    restore() {
      if (file !== undefined) void load(file, line)
    },
  }
}
