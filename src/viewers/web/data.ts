import type { AddInput, DraftElementInput, EditArchitectureInput, RemoveInput } from '../../authoring.ts'
import type { WorkItemDetails } from '../../types.ts'
import { PUBLISHED_EVENT, PUBLISHED_VERSION_EVENT } from './payload.ts'
import type { WebBootPayload, WebPayload, WebWorkPayload } from './payload.ts'
import type { SourcePayload } from '../source/read.ts'
import type { CodeFile } from '../source/structure.ts'
import type { TaskDiffPayload } from '../source/diff.ts'

export interface WebDataSource {
  readWorld(revision?: string): Promise<WebPayload>
  readCode(element: string, revision?: string): Promise<readonly CodeFile[]>
  readSource(element: string, file: string, revision?: string): Promise<SourcePayload>
  readTask(id: string): Promise<WorkItemDetails>
  readTaskDiff(id: string): Promise<TaskDiffPayload>
  /** The writers, absent in the published delivery, which has none. */
  draft?(input: DraftElementInput): Promise<void>
  add?(input: AddInput): Promise<void>
  remove?(input: RemoveInput): Promise<void>
  edit?(input: EditArchitectureInput): Promise<void>
  subscribe(handlers: {
    world(payload: WebPayload): void
    work(payload: WebWorkPayload): void
  }): { close(): void }
}

async function responseJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(await response.text())
  return response.json() as Promise<T>
}

async function send(path: string, body: unknown): Promise<void> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
}

function selected(path: string, values: Record<string, string | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) query.set(key, value)
  }
  return `${path}?${query}`
}

function liveDataSource(): WebDataSource {
  return {
    readWorld(revision) {
      return responseJson(revision === undefined ? '/world.json' : `/world.json?revision=${revision}`)
    },
    readCode(element, revision) {
      return responseJson(selected('/code.json', { element, revision }))
    },
    readSource(element, file, revision) {
      return responseJson(selected('/source.json', { element, file, revision }))
    },
    readTask(id) {
      return responseJson(selected('/task.json', { task: id }))
    },
    readTaskDiff(id) {
      return responseJson(selected('/task-diff.json', { task: id }))
    },
    draft: input => send('/draft', input),
    add: input => send('/add', input),
    remove: input => send('/remove', input),
    edit: input => send('/edit', input),
    subscribe(handlers) {
      const events = new EventSource('/events')
      events.addEventListener('world', event => {
        handlers.world(JSON.parse(event.data) as WebPayload)
      })
      events.addEventListener('work', event => {
        handlers.work(JSON.parse(event.data) as WebWorkPayload)
      })
      return { close: () => events.close() }
    },
  }
}

function publishedDataSource(boot: WebBootPayload): WebDataSource {
  let snapshot = boot

  function reads() {
    if (snapshot.delivery.kind !== 'published') throw new Error('Published snapshot unavailable')
    return snapshot.delivery.reads
  }

  return {
    async readWorld() {
      return snapshot
    },
    async readCode(element) {
      return reads().code.find(item => item.element === element)?.files ?? []
    },
    async readSource(element, file) {
      const found = reads().sources.find(item => item.element === element && item.file === file)
      if (found === undefined) throw new Error('Source file not found')
      return found.source
    },
    async readTask(id) {
      const found = reads().tasks.find(item => item.id === id)
      if (found === undefined) throw new Error('Task not found')
      return found.details
    },
    async readTaskDiff(id) {
      const found = reads().taskDiffs.find(item => item.id === id)
      if (found === undefined) throw new Error('Diff unavailable')
      if ('error' in found) throw new Error(found.error)
      return found.diff
    },
    subscribe(handlers) {
      let checking = false
      let loadingSnapshot = false
      const load = (name: string, done: () => void): void => {
        const script = document.createElement('script')
        script.src = new URL(name, document.baseURI).toString()
        const finish = (): void => {
          done()
          script.remove()
        }
        script.addEventListener('load', finish, { once: true })
        script.addEventListener('error', finish, { once: true })
        document.head.append(script)
      }
      const receive = (event: Event): void => {
        const next = (event as CustomEvent<WebBootPayload>).detail
        if (next.delivery.kind !== 'published' || next.generation <= snapshot.generation) return
        snapshot = next
        handlers.world(next)
      }
      const receiveVersion = (event: Event): void => {
        const generation = (event as CustomEvent<number>).detail
        if (generation <= snapshot.generation || loadingSnapshot) return
        loadingSnapshot = true
        load(`snapshot.js?${generation}`, () => { loadingSnapshot = false })
      }
      const poll = (): void => {
        if (checking) return
        checking = true
        load(`version.js?${Date.now()}`, () => { checking = false })
      }
      window.addEventListener(PUBLISHED_EVENT, receive)
      window.addEventListener(PUBLISHED_VERSION_EVENT, receiveVersion)
      const timer = window.setInterval(poll, 1000)
      return {
        close() {
          window.clearInterval(timer)
          window.removeEventListener(PUBLISHED_EVENT, receive)
          window.removeEventListener(PUBLISHED_VERSION_EVENT, receiveVersion)
        },
      }
    },
  }
}

export function createWebDataSource(boot: WebBootPayload): WebDataSource {
  return boot.delivery.kind === 'live' ? liveDataSource() : publishedDataSource(boot)
}
