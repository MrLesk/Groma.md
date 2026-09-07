import type { AnnotatedElement } from '../../../types.ts'
import type { SourcePayload } from '../../source/read.ts'
import type { CodeFile } from '../../source/structure.ts'
import { leaveSource, paintSource } from './view.ts'

export interface SourceControl {
  readonly file: string | undefined
  readonly line: number | undefined
  back(): void
  clear(): void
  code(): readonly CodeFile[]
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
  readCode(element: string, revision?: string): Promise<readonly CodeFile[]>
  readSource(element: string, file: string, revision?: string): Promise<SourcePayload>
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
  let structureElement: AnnotatedElement | undefined
  let structureRevision: string | undefined
  let codeFiles: readonly CodeFile[] = []
  let structureRequest = 0
  let openedBy: string | undefined
  let detailsScrollTop = 0

  function closeSource(): void {
    request += 1
    file = undefined
    line = undefined
    payload = undefined
    error = undefined
  }

  function clear(): void {
    closeSource()
    openedBy = undefined
    structureRequest += 1
    structureElement = undefined
    structureRevision = undefined
    codeFiles = []
  }

  function back(): void {
    closeSource()
    const elementId = options.element()?.representationId
    options.repaint()
    const restore = (): void => {
      if (file === undefined && options.element()?.representationId === elementId) {
        options.host.scrollTop = detailsScrollTop
      }
    }
    restore()
    // The wider source pane can clamp How it's built scroll until its width settles.
    void Promise.all(options.host.getAnimations().map(animation => animation.finished)).then(restore, () => {})
  }

  async function load(nextFile: string, nextLine?: number): Promise<void> {
    const element = options.element()
    if (element?.kind !== 'component') return
    const elementId = element.representationId
    const revision = options.revision()
    const activeRequest = ++request
    openedBy = elementId
    file = nextFile
    line = nextLine
    payload = undefined
    error = undefined
    options.repaint()
    try {
      const loaded = await options.readSource(elementId, nextFile, revision)
      if (!sameRequest(options, request, activeRequest, revision, elementId)) return
      payload = loaded
    } catch (reason) {
      if (activeRequest !== request) return
      error = errorMessage(reason)
    }
    options.repaint()
  }

  async function loadStructure(element: AnnotatedElement, revision: string | undefined): Promise<void> {
    const activeRequest = ++structureRequest
    try {
      const loaded = await options.readCode(element.representationId, revision)
      if (activeRequest !== structureRequest || structureElement !== element || structureRevision !== revision) return
      codeFiles = loaded
    } catch {
      if (activeRequest !== structureRequest || structureElement !== element || structureRevision !== revision) return
      codeFiles = []
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
    code() {
      const element = options.element()
      if (element?.kind !== 'component') return []
      const revision = options.revision()
      if (structureElement === element && structureRevision === revision) return codeFiles
      structureElement = element
      structureRevision = revision
      codeFiles = []
      if (element.code.some(reference => reference.scanner === 'typescript')) {
        void loadStructure(element, revision)
      }
      return codeFiles
    },
    open(nextFile, nextLine) {
      if (file === undefined) detailsScrollTop = options.host.scrollTop
      void load(nextFile, nextLine)
    },
    paint(element) {
      if (file === undefined) {
        leaveSource(options.host)
        return false
      }
      if (element === undefined || (element.representationId !== openedBy && !ownsFile(element, file))) {
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
