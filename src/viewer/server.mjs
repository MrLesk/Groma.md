import { watch } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildArchitectureModel } from '../architecture-model.mjs'
import { loadRevision } from '../architecture-reader.mjs'
import index from './index.html'

const defaultRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
)
const testRepositoryRoot = process.env.NODE_ENV === 'test'
  ? process.env.GROMA_TEST_REPOSITORY_ROOT
  : undefined
const repositoryRoot = testRepositoryRoot
  ? path.resolve(testRepositoryRoot)
  : defaultRepositoryRoot
const eventEncoder = new TextEncoder()
const reloadClients = new Set()

function argumentValue(name) {
  const index = Bun.argv.indexOf(name)
  return index === -1 ? undefined : Bun.argv[index + 1]
}

function revisionDescriptor(value) {
  if (value === 'observed') {
    return {
      descriptor: { kind: 'observed' },
      label: 'observed',
    }
  }
  if (value.startsWith('plan:') && value.length > 'plan:'.length) {
    const name = value.slice('plan:'.length)
    return {
      descriptor: { kind: 'plan', name },
      label: `plan / ${name}`,
    }
  }

  throw new TypeError(
    'Revision must be "observed" or "plan:<directory-name>".',
  )
}

const selectedRevision = revisionDescriptor(
  argumentValue('--revision')
    ?? process.env.GROMA_REVISION
    ?? 'plan:02-live-viewer',
)
const requestedSystemId = argumentValue('--system')
  ?? process.env.GROMA_SYSTEM_ID
  ?? 'groma'

function nodeText(node) {
  if (typeof node === 'string') return node
  if (!Array.isArray(node)) return ''

  const children = typeof node[0] === 'string' ? node.slice(2) : node
  return children.map(nodeText).join('')
}

function revisionContext(contextDocument) {
  const titleIndex = contextDocument.nodes.findIndex(node => node[0] === 'h1')
  const description = contextDocument.nodes
    .slice(titleIndex + 1)
    .find(node => node[0] === 'p')

  return {
    title: nodeText(contextDocument.nodes[titleIndex]).trim(),
    description: nodeText(description).trim(),
  }
}

async function buildPayload(generation) {
  const [loadedRevision, loadedObservedRevision] = await Promise.all([
    loadRevision(repositoryRoot, selectedRevision.descriptor),
    loadRevision(repositoryRoot, { kind: 'observed' }),
  ])
  const model = buildArchitectureModel(loadedRevision)
  const observedModel = buildArchitectureModel(loadedObservedRevision)
  const focalSystem = model.elements.find(element => {
    return element.id === requestedSystemId && element.kind === 'system'
  })

  if (!focalSystem) {
    throw new TypeError(
      `Focal system "${requestedSystemId}" does not exist in ${selectedRevision.label}.`,
    )
  }

  return {
    generation,
    revisionLabel: selectedRevision.label,
    revisionContext: revisionContext(loadedRevision.context),
    focalSystemId: focalSystem.id,
    model,
    observedModel,
  }
}

let payload = await buildPayload(1)

const port = Number(
  argumentValue('--port')
    ?? process.env.GROMA_PORT
    ?? 3000,
)
if (!Number.isInteger(port) || port < 0 || port > 65_535) {
  throw new TypeError('Port must be an integer from 0 through 65535.')
}

function sendReloadEvent(event, data) {
  const message = eventEncoder.encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  )

  for (const client of reloadClients) {
    try {
      client.enqueue(message)
    } catch {
      reloadClients.delete(client)
    }
  }
}

const server = Bun.serve({
  hostname: '127.0.0.1',
  port,
  development: false,
  routes: {
    '/': index,
    '/api/model': {
      GET() {
        return Response.json(payload, {
          headers: {
            'Cache-Control': 'no-store',
          },
        })
      },
    },
    '/api/events': {
      GET(request) {
        let controller
        const stream = new ReadableStream({
          start(streamController) {
            controller = streamController
            reloadClients.add(controller)
            controller.enqueue(eventEncoder.encode(': connected\n\n'))
          },
          cancel() {
            reloadClients.delete(controller)
          },
        })
        request.signal.addEventListener(
          'abort',
          () => reloadClients.delete(controller),
          { once: true },
        )

        return new Response(stream, {
          headers: {
            'Cache-Control': 'no-cache',
            'Content-Type': 'text/event-stream',
          },
        })
      },
    },
  },
  fetch() {
    return new Response('Not found', { status: 404 })
  },
})

let settleTimer
let reloadQueue = Promise.resolve()
function scheduleReload() {
  clearTimeout(settleTimer)
  settleTimer = setTimeout(() => {
    reloadQueue = reloadQueue.then(async () => {
      try {
        payload = await buildPayload(payload.generation + 1)
        sendReloadEvent('architecture-changed', {
          generation: payload.generation,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        sendReloadEvent('architecture-error', { message })
        console.error(`Groma reload kept generation ${payload.generation}: ${message}`)
      }
    })
  }, 120)
}

for (const relativeDirectory of ['groma/observed', 'groma/plans']) {
  watch(
    path.join(repositoryRoot, relativeDirectory),
    { recursive: true },
    (_eventType, filename) => {
      if (
        typeof filename === 'string'
        && (filename.endsWith('.md') || path.extname(filename) === '')
      ) {
        scheduleReload()
      }
    },
  )
}

console.log(
  `Groma viewer: ${selectedRevision.label} at ${server.url}`,
)
