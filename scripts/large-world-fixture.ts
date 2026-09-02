/**
 * Writes the large world the terminal map is checked against: four internal systems,
 * twenty containers, three hundred components and more than five hundred relationships.
 * Deterministic: the same call always writes the same files.
 *
 *   bun scripts/large-world-fixture.ts            # regenerates test/fixtures/large-world
 */
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SYSTEMS = [
  { id: 'storefront', containers: ['web-app', 'mobile-api', 'search', 'cdn-edge', 'session-store'] },
  { id: 'orders', containers: ['checkout', 'cart', 'order-service', 'order-db', 'events'] },
  { id: 'catalog', containers: ['catalog-api', 'pricing', 'product-db', 'import', 'media'] },
  { id: 'identity', containers: ['accounts', 'auth', 'directory', 'sessions', 'audit'] },
]
const EXTERNAL = { id: 'payments', title: 'Payments' }
const ACTORS = [
  { id: 'shopper', title: 'Shopper', uses: 0 },
  { id: 'merchant', title: 'Merchant', uses: 1 },
]
const PARTS = [
  'Gateway', 'Router', 'Session', 'Cache', 'Validator', 'Mapper', 'Reader', 'Writer',
  'Queue', 'Worker', 'Scheduler', 'Metrics', 'Config', 'Logger', 'Client',
]
const COMPONENTS_PER_CONTAINER = PARTS.length
const CONTAINERS_PER_SYSTEM = SYSTEMS[0]!.containers.length

interface Container { system: (typeof SYSTEMS)[number]; id: string; index: number }
interface Relationship { target: string; description: string }

const title = (id: string): string => id.split('-').map(word => word[0]!.toUpperCase() + word.slice(1)).join(' ')

function record(type: string, name: string, groma: Record<string, unknown>, body: string, relationships: Relationship[] = []): string {
  const meta = Object.entries(groma).map(([key, value]) => `  ${key}:${String(value).startsWith('\n') ? '' : ' '}${value}`).join('\n')
  const table = relationships.length === 0
    ? ''
    : '\n\n## Relationships\n\n| Target | Description | Technology |\n| --- | --- | --- |\n'
      + relationships.map(link => `| [${link.target.split('/').at(-1)!.replace('.md', '')}](${link.target}) | ${link.description} | HTTP |`).join('\n')
  return `---\ntype: ${type}\ntitle: ${name}\nstatus: stable\ngroma:\n${meta}\n---\n\n${body}${table}\n`
}

function componentRecord(container: Container, index: number, containers: Container[]): string {
  const part = PARTS[index]!
  const id = `${container.id}-${part.toLowerCase()}`
  const name = `${title(container.id)} ${part.toLowerCase()}`
  const files = Array.from({ length: (index % 5) + 1 }, (_, file) => {
    const stem = file === 0 ? part.toLowerCase() : `${part.toLowerCase()}-${file}`
    return `    - scanner: typescript\n      file: src/${container.system.id}/${container.id}/${stem}.ts\n      symbol: ${part.toLowerCase()}`
  }).join('\n')
  const group = index < 5 ? 'Core' : index < 10 ? 'Support' : undefined
  const relationships: Relationship[] = []
  const sibling = (offset: number): string => `${container.id}-${PARTS[index + offset]!.toLowerCase()}.md`
  const across = (other: Container, part: number): string =>
    `../../../../${other.system.id}/containers/${other.id}/components/${other.id}-${PARTS[part]!.toLowerCase()}.md`
  if (index + 1 < COMPONENTS_PER_CONTAINER) relationships.push({ target: sibling(1), description: `Calls ${PARTS[index + 1]!.toLowerCase()}` })
  if (index + 2 < COMPONENTS_PER_CONTAINER) relationships.push({ target: sibling(2), description: `Reads ${PARTS[index + 2]!.toLowerCase()}` })
  if (index === 0) relationships.push({ target: across(containers[(container.index + 1) % containers.length]!, 0), description: 'Forwards requests' })
  // Cross-system links stay with the container chain: extra long routes into a slab defeat the sheet router's shared-path safety check.
  const lastOfSystem = container.index % CONTAINERS_PER_SYSTEM === CONTAINERS_PER_SYSTEM - 1 && index === COMPONENTS_PER_CONTAINER - 1
  if (lastOfSystem) relationships.push({ target: `../../../../${EXTERNAL.id}/system.md`, description: 'Charges cards' })
  return record('C4 Component', name, {
    id,
    parent: container.id,
    ...(group === undefined ? {} : { group }),
    code: `\n${files}`,
  }, `${name} of ${title(container.id)}.`, relationships)
}

/** Writes the whole fixture under root, replacing what was there. */
export async function writeLargeWorld(root: string): Promise<void> {
  const groma = path.join(root, 'groma')
  await rm(groma, { recursive: true, force: true })
  const files = new Map<string, string>()
  files.set('project.md', '---\ntype: Groma Project\ntitle: Large world architecture\ngroma:\n  profile: architecture\n---\n\nA generated world large enough to test the terminal map at scale.\n')
  files.set('index.md', '---\nokf_version: "0.2"\n---\n')
  files.set('observed/index.md', '# Observed\n')
  files.set('missing/index.md', '# Missing\n')
  files.set('plans/index.md', '# Plans\n')
  const containers: Container[] = SYSTEMS.flatMap(system => system.containers.map((id, index) => ({ system, id, index: SYSTEMS.indexOf(system) * CONTAINERS_PER_SYSTEM + index })))
  for (const actor of ACTORS) {
    files.set(`observed/actors/${actor.id}.md`, record('C4 Actor', actor.title, { id: actor.id }, `${actor.title} of the shop.`,
      SYSTEMS.map(system => ({ target: `../systems/${system.id}/containers/${system.containers[actor.uses]}/container.md`, description: `Uses ${system.containers[actor.uses]}` }))))
  }
  files.set(`observed/systems/${EXTERNAL.id}/system.md`, record('C4 System', EXTERNAL.title, { id: EXTERNAL.id, external: true }, 'Takes the money.'))
  for (const system of SYSTEMS) {
    files.set(`observed/systems/${system.id}/system.md`, record('C4 System', title(system.id), { id: system.id }, `${title(system.id)} of the shop.`))
  }
  for (const container of containers) {
    const base = `observed/systems/${container.system.id}/containers/${container.id}`
    files.set(`${base}/container.md`, record('C4 Container', title(container.id), { id: container.id, parent: container.system.id }, `${title(container.id)} of ${title(container.system.id)}.`))
    for (let index = 0; index < COMPONENTS_PER_CONTAINER; index += 1) {
      files.set(`${base}/components/${container.id}-${PARTS[index]!.toLowerCase()}.md`, componentRecord(container, index, containers))
    }
  }
  for (const [relative, content] of files) {
    const target = path.join(groma, relative)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, content)
  }
}

if (import.meta.main) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures', 'large-world')
  await writeLargeWorld(root)
  console.log(`wrote ${root}`)
}
