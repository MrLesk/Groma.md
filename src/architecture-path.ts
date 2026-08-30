import type { C4Kind } from './types.ts'

export function architectureRelative(sourceFilename: string): string {
  if (sourceFilename.startsWith('groma/plans/')) {
    const slash = sourceFilename.indexOf('/', 'groma/plans/'.length)
    return sourceFilename.slice(slash + 1)
  }
  if (sourceFilename.startsWith('groma/observed/')) {
    return sourceFilename.slice('groma/observed/'.length)
  }
  return sourceFilename
}

function posixDirname(filename: string): string {
  const separator = filename.lastIndexOf('/')
  return separator === -1 ? '' : filename.slice(0, separator)
}

export function architectureElementPath(input: {
  root: string
  kind: C4Kind
  id: string
  parentSourceFilename?: string
}): string {
  const { root, kind, id, parentSourceFilename } = input
  if (kind === 'actor') return `${root}/actors/${id}.md`
  if (kind === 'system') return `${root}/systems/${id}/system.md`
  if (parentSourceFilename === undefined) {
    throw new Error(`missing parent for ${id}`)
  }
  const parentDir = posixDirname(architectureRelative(parentSourceFilename))
  if (kind === 'container') {
    return `${root}/${parentDir}/containers/${id}/container.md`
  }
  return `${root}/${parentDir}/components/${id}.md`
}
