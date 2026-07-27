import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const fixtureRoot = await mkdtemp(
  path.join(os.tmpdir(), 'groma-comparison-browser-'),
)
const portIndex = process.argv.indexOf('--port')
const port = portIndex === -1 ? '4179' : process.argv[portIndex + 1]

function frontmatter(fields) {
  return [
    '---',
    ...Object.entries(fields).map(([key, value]) => `${key}: ${value}`),
    '---',
  ].join('\n')
}

function relationshipTable(rows) {
  if (rows.length === 0) return ''

  return [
    '\n## Relationships\n',
    '| Target | Description | Technology |',
    '| --- | --- | --- |',
    ...rows.map(row => {
      return `| [${row.target}](${row.href}) | ${row.description} | ${row.technology} |`
    }),
    '',
  ].join('\n')
}

async function writeDocument(
  revisionRoot,
  relativeFilename,
  fields,
  title,
  description,
  relationships = '',
) {
  const filename = path.join(revisionRoot, relativeFilename)
  await mkdir(path.dirname(filename), { recursive: true })
  await writeFile(
    filename,
    `${frontmatter(fields)}\n\n# ${title}\n\n${description}\n${relationships}`,
  )
}

async function writeRevision(kind) {
  const isPlan = kind === 'plan'
  const revisionRoot = isPlan
    ? path.join(fixtureRoot, 'groma', 'plans', 'browser-comparison')
    : path.join(fixtureRoot, 'groma', 'observed')
  await mkdir(revisionRoot, { recursive: true })
  await writeFile(path.join(revisionRoot, 'README.md'), `# ${kind}\n`)
  await writeDocument(
    revisionRoot,
    'people/architect.md',
    { id: 'architect', kind: 'person' },
    'Architect',
    'Studies the comparison.',
    relationshipTable([
      {
        target: 'Groma',
        href: '../systems/groma/system.md',
        description: isPlan ? 'Studies planned Groma' : 'Studies current Groma',
        technology: isPlan ? 'Events' : 'HTTP',
      },
      {
        target: 'Stable container',
        href: '../systems/groma/containers/stable-container/container.md',
        description: 'Uses stable container',
        technology: 'Browser',
      },
      ...(isPlan ? [{
        target: 'Added container',
        href: '../systems/groma/containers/added-container/container.md',
        description: 'Uses planned container',
        technology: 'Browser',
      }] : [{
        target: 'Removed container',
        href: '../systems/groma/containers/removed-container/container.md',
        description: 'Uses observed container',
        technology: 'Browser',
      }, {
        target: 'Other system',
        href: '../systems/other-system/system.md',
        description: 'Sends current signal',
        technology: 'Events',
      }]),
    ]),
  )
  await writeDocument(
    revisionRoot,
    'systems/groma/system.md',
    { id: 'groma', kind: 'system' },
    'Groma',
    'Keeps architecture readable.',
  )
  await writeDocument(
    revisionRoot,
    'systems/other-system/system.md',
    { id: 'other-system', kind: 'system', external: true },
    'Other system',
    'Receives and sends moved architecture.',
    relationshipTable(isPlan ? [{
      target: 'Architect',
      href: '../../people/architect.md',
      description: 'Sends planned signal',
      technology: 'Events',
    }] : []),
  )

  const containers = [
    {
      id: 'stable-container',
      title: 'Stable container',
      description: 'Stays architecturally equivalent.',
      include: true,
    },
    {
      id: 'modified-container',
      title: 'Modified container',
      description: isPlan
        ? 'Carries the planned responsibility.'
        : 'Carries the current responsibility.',
      include: true,
    },
    {
      id: 'removed-container',
      title: 'Removed container',
      description: 'Exists only in observed architecture.',
      include: !isPlan,
    },
    {
      id: 'added-container',
      title: 'Added container',
      description: 'Exists only in planned architecture.',
      include: isPlan,
    },
    {
      id: 'moved-out-container',
      title: 'Moved out container',
      description: 'Moves from Groma to the other system.',
      parent: isPlan ? 'other-system' : 'groma',
      include: true,
    },
    {
      id: 'moved-in-container',
      title: 'Moved in container',
      description: 'Moves from the other system to Groma.',
      parent: isPlan ? 'groma' : 'other-system',
      include: true,
    },
  ]

  for (const container of containers.filter(candidate => candidate.include)) {
    const parent = container.parent ?? 'groma'
    const containerRoot = `systems/${parent}/containers/${container.id}`
    await writeDocument(
      revisionRoot,
      `${containerRoot}/container.md`,
      { id: container.id, kind: 'container', parent },
      container.title,
      container.description,
    )
    await writeDocument(
      revisionRoot,
      `${containerRoot}/components/worker.md`,
      {
        id: `${container.id}-worker`,
        kind: 'component',
        parent: container.id,
      },
      `${container.title} worker`,
      `Makes ${container.title.toLowerCase()} selectable.`,
    )
  }

  const travellingParent = isPlan ? 'modified-container' : 'stable-container'
  await writeDocument(
    revisionRoot,
    `systems/groma/containers/${travellingParent}/components/travelling-worker.md`,
    {
      id: 'travelling-worker',
      kind: 'component',
      parent: travellingParent,
    },
    'Travelling worker',
    'Moves between stable and modified containers.',
  )
}

await Promise.all([writeRevision('observed'), writeRevision('plan')])

const child = Bun.spawn({
  cmd: [
    process.execPath,
    'run',
    path.join(projectRoot, 'src/viewer/server.mjs'),
    '--port',
    port,
    '--revision',
    'plan:browser-comparison',
  ],
  cwd: projectRoot,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    GROMA_TEST_REPOSITORY_ROOT: fixtureRoot,
  },
  stdin: 'ignore',
  stdout: 'inherit',
  stderr: 'inherit',
})

let stopping = false
async function stopFixtureServer(signal = 'SIGTERM') {
  if (stopping) return
  stopping = true
  child.kill(signal)
  await child.exited
  await rm(fixtureRoot, { recursive: true, force: true })
  process.exit(0)
}

process.on('SIGINT', () => void stopFixtureServer('SIGINT'))
process.on('SIGTERM', () => void stopFixtureServer('SIGTERM'))

const exitCode = await child.exited
await rm(fixtureRoot, { recursive: true, force: true })
process.exit(exitCode)
