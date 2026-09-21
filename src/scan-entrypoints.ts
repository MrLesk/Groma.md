import type { ScanObservation } from '@groma/scanner'
import type { World, WorldRecord } from './scan-reconciler.ts'

interface Entry {
  file: string
  names: Set<string>
  files: Set<string>
}

export interface EntryPlacement {
  name: string
  system: WorldRecord
  container?: WorldRecord
  components: WorldRecord[]
}

/** Different compilers and build declarations can describe the same physical execution entry. */
function combinedEntries(observations: readonly ScanObservation[]): Entry[] {
  const entries = new Map<string, Entry>()
  for (const observation of observations) {
    for (const fact of observation.entryPoints ?? []) {
      const entry = entries.get(fact.file) ?? { file: fact.file, names: new Set(), files: new Set() }
      entry.names.add(fact.name)
      for (const file of fact.files) entry.files.add(file)
      entries.set(entry.file, entry)
    }
  }
  return [...entries.values()].sort((a, b) => a.file.localeCompare(b.file))
}

function memberships(entries: Entry[]): Map<string, Set<Entry>> {
  const membership = new Map<string, Set<Entry>>()
  for (const entry of entries) {
    for (const file of entry.files) {
      const programs = membership.get(file) ?? new Set()
      programs.add(entry)
      membership.set(file, programs)
    }
  }
  // A declared entry owns its own source even when one compiler unit contains several entry classes.
  for (const entry of entries) membership.set(entry.file, new Set([entry]))
  return membership
}

function parent(world: World, record: WorldRecord): WorldRecord | undefined {
  return world.byId.get(record.parent ?? '')
}

function system(world: World, record: WorldRecord): WorldRecord | undefined {
  const owner = parent(world, record)
  return owner?.kind === 'container' ? parent(world, owner) : owner
}

/**
 * Groma's application default: positive execution evidence establishes a boundary; roots and imports
 * alone do not. A whole component must belong to one entry's source unit. Existing containers win.
 */
export function entryPointPlacements(world: World, observations: readonly ScanObservation[]): EntryPlacement[] {
  const entries = combinedEntries(observations)
  const membership = memberships(entries)
  const placements: EntryPlacement[] = []
  for (const entry of entries) {
    const owners = [...new Set([...entry.files].flatMap(file => world.byCodeFile.get(file) ?? []))]
    const systems = new Set(owners.map(owner => system(world, owner)))
    const [boundary] = systems
    if (systems.size !== 1 || boundary?.kind !== 'system') continue
    // An entry file is stronger identity evidence than a helper already owned by another application.
    const anchor = world.byCodeFile.get(entry.file)
    if (!anchor) continue
    const container = anchor.kind === 'container' ? anchor : parent(world, anchor)
    const components = owners.filter(owner => owner.kind === 'component' && owner.parent === boundary.id
      && owner.code.every(reference => membership.get(reference.file)?.size === 1
        && membership.get(reference.file)?.has(entry)))
    if (components.length === 0) continue
    placements.push({ name: [...entry.names].sort()[0]!, system: boundary, container: container?.kind === 'container' ? container : undefined, components })
  }
  return placements
}
