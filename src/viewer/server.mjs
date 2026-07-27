import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildArchitectureModel } from '../architecture-model.mjs'
import { loadRevision } from '../architecture-reader.mjs'
import index from './index.html'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
)

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
const loadedRevision = await loadRevision(
  repositoryRoot,
  selectedRevision.descriptor,
)
const model = buildArchitectureModel(loadedRevision)
const requestedSystemId = argumentValue('--system')
  ?? process.env.GROMA_SYSTEM_ID
  ?? 'groma'
const focalSystem = model.elements.find(element => {
  return element.id === requestedSystemId && element.kind === 'system'
})

if (!focalSystem) {
  throw new TypeError(
    `Focal system "${requestedSystemId}" does not exist in ${selectedRevision.label}.`,
  )
}

const port = Number(
  argumentValue('--port')
    ?? process.env.GROMA_PORT
    ?? 3000,
)
if (!Number.isInteger(port) || port < 0 || port > 65_535) {
  throw new TypeError('Port must be an integer from 0 through 65535.')
}

const payload = {
  revisionLabel: selectedRevision.label,
  focalSystemId: focalSystem.id,
  model,
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
  },
  fetch() {
    return new Response('Not found', { status: 404 })
  },
})

console.log(
  `Groma viewer: ${selectedRevision.label} at ${server.url}`,
)
