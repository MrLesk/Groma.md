import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildArchitectureModel } from '../architecture-model.mjs'
import { loadRevision } from '../architecture-reader.mjs'
import index from './index.html'
import { startMarkdownWatcher } from './markdown-watcher.mjs'

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
const testIoAudit = process.env.NODE_ENV === 'test'
  && process.env.GROMA_TEST_IO_AUDIT === '1'
  ? []
  : null
const eventEncoder = new TextEncoder()
const reloadClients = new Set()

function recordFilesystemAccess({ operation, filename }) {
  if (!testIoAudit) return

  testIoAudit.push({
    operation,
    path: path.relative(repositoryRoot, path.resolve(filename))
      .split(path.sep)
      .join('/'),
  })
}

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
    ?? 'plan:02-live-viewer',
)

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
  const readOptions = testIoAudit
    ? { onFilesystemAccess: recordFilesystemAccess }
    : undefined
  const [loadedRevision, loadedObservedRevision] = await Promise.all([
    loadRevision(
      repositoryRoot,
      selectedRevision.descriptor,
      readOptions,
    ),
    loadRevision(
      repositoryRoot,
      { kind: 'observed' },
      readOptions,
    ),
  ])
  const model = buildArchitectureModel(loadedRevision)
  const observedModel = buildArchitectureModel(loadedObservedRevision)
  const focalSystem = model.elements.find(element => {
    return element.id === 'groma' && element.kind === 'system'
  })

  if (!focalSystem) {
    throw new TypeError(
      `Focal system "groma" does not exist in ${selectedRevision.label}.`,
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
let reloadError = null

const port = Number(
  argumentValue('--port')
    ?? 3000,
)
if (!Number.isInteger(port) || port < 0 || port > 65_535) {
  throw new TypeError('Port must be an integer from 0 through 65535.')
}

function reloadEventMessage(event, data) {
  return eventEncoder.encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  )
}

function sendReloadEvent(event, data) {
  const message = reloadEventMessage(event, data)
  for (const client of reloadClients) {
    try {
      client.enqueue(message)
    } catch {
      reloadClients.delete(client)
    }
  }
}

function publishCurrentReloadError() {
  sendReloadEvent('architecture-error', {
    generation: payload.generation,
    message: reloadError,
  })
  console.error(`Groma kept generation ${payload.generation}: ${reloadError}`)
}

const server = Bun.serve({
  hostname: '127.0.0.1',
  port,
  development: false,
  routes: {
    '/': index,
    '/api/model': {
      GET() {
        return Response.json({
          ...payload,
          reloadError,
          ...(testIoAudit ? {
            testIoAudit: [...testIoAudit],
          } : {}),
        }, {
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
            controller.enqueue(reloadError
              ? reloadEventMessage('architecture-error', {
                  generation: payload.generation,
                  message: reloadError,
                })
              : reloadEventMessage('architecture-changed', {
                  generation: payload.generation,
                }))
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
        reloadError = null
        sendReloadEvent('architecture-changed', {
          generation: payload.generation,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        reloadError = message
        publishCurrentReloadError()
      }
    })
  }, 120)
}

const markdownWatcher = await startMarkdownWatcher(repositoryRoot, {
  ...(testIoAudit ? {
    onFilesystemAccess: recordFilesystemAccess,
  } : {}),
  onMarkdownChange: scheduleReload,
  onError(error) {
    const detail = error instanceof Error ? error.message : String(error)
    reloadError = `Architecture Markdown watcher failed: ${detail}.`
    publishCurrentReloadError()
  },
})

let shutdownPromise
function shutdown() {
  if (shutdownPromise) return shutdownPromise

  shutdownPromise = (async () => {
    clearTimeout(settleTimer)
    await markdownWatcher.close()
    await reloadQueue
    for (const client of reloadClients) {
      try {
        client.close()
      } catch {
        // The browser may already have closed its event stream.
      }
    }
    reloadClients.clear()
    await server.stop(true)
  })()
  return shutdownPromise
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    void shutdown().then(
      () => process.exit(0),
      error => {
        console.error(`Groma viewer shutdown failed: ${error.message}`)
        process.exit(1)
      },
    )
  })
}

console.log(
  `Groma viewer: ${selectedRevision.label} at ${server.url}`,
)
