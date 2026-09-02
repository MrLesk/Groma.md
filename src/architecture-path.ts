import type { C4Kind } from './types.ts'

function posixDirname(filename: string): string {
  const separator = filename.lastIndexOf('/')
  return separator === -1 ? '' : filename.slice(0, separator)
}

/** The folder names the root kind; containers and components nest under their parent's folder. */
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
  const parentDir = posixDirname(parentSourceFilename)
  if (kind === 'container') return `${parentDir}/containers/${id}/container.md`
  return `${parentDir}/components/${id}.md`
}

/** A system stored under externals/ is outside the architecture boundary. */
export function isExternalPath(sourceFilename: string): boolean {
  return sourceFilename.split('/')[1] === 'externals'
}
