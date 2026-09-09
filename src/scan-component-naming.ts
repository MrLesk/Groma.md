import { createHash } from 'node:crypto'

import { isReservedDocument } from './architecture-path.ts'
import { displayName, kebabCase } from './naming.ts'

interface ComponentSource {
  file: string
  parent: string
}

export function sourceStem(file: string): string {
  return kebabCase(file.split('/').at(-1)?.replace(/\.[^.]+$/, '') ?? file) || 'source'
}

function readableNames(source: ComponentSource): string[] {
  const stem = sourceStem(source.file)
  const parents = source.file.split('/').slice(0, -1)
  const names = [stem, `${source.parent}-${stem}`]
  for (let depth = 1; depth <= parents.length; depth += 1) {
    names.push(kebabCase(`${parents.slice(-depth).join('-')}-${source.parent}-${stem}`))
  }
  return [...new Set(names)]
}

function advance(candidate: { position: number; names: string[]; hashLength: number }): void {
  if (candidate.position + 1 < candidate.names.length) candidate.position += 1
  else candidate.hashLength = candidate.hashLength === 0 ? 8 : candidate.hashLength + 1
}

/** Compare the complete new-source batch before choosing any component identity. */
export function componentNames(
  sources: ComponentSource[],
  occupied: ReadonlySet<string>,
): Map<string, { id: string; name: string }> {
  const candidates = sources.map(source => ({
    file: source.file,
    names: readableNames(source),
    position: 0,
    hashLength: 0,
    hash: createHash('sha256').update(source.file).digest('hex'),
  }))
  const idFor = (candidate: typeof candidates[number]) => {
    const name = candidate.names[candidate.position]!
    return candidate.hashLength === 0 ? name : `${name}-${candidate.hash.slice(0, candidate.hashLength)}`
  }
  while (true) {
    const counts = new Map<string, number>()
    for (const candidate of candidates) {
      const id = idFor(candidate)
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    const collisions = candidates.filter(candidate => {
      const id = idFor(candidate)
      return occupied.has(id) || isReservedDocument(`${id}.md`) || counts.get(id)! > 1
    })
    if (collisions.length === 0) break
    for (const candidate of collisions) advance(candidate)
  }
  return new Map(candidates.map(candidate => [candidate.file, {
    id: idFor(candidate),
    name: displayName(candidate.names[candidate.position]!),
  }]))
}
