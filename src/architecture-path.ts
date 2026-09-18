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
  external?: boolean
  parentSourceFilename?: string
}): string {
  const { root, kind, id, external, parentSourceFilename } = input
  if (kind === 'actor') return `${root}/actors/${id}.md`
  if (kind === 'system') {
    return external === true ? `${root}/externals/${id}.md` : `${root}/systems/${id}/system.md`
  }
  if (parentSourceFilename === undefined) {
    throw new Error(`missing parent for ${id}`)
  }
  const parentDir = posixDirname(parentSourceFilename)
  if (kind === 'container') return `${parentDir}/containers/${id}/container.md`
  return `${parentDir}/components/${id}.md`
}

export function draftRecordPath(root: string, id: string): string {
  return `${root}/drafts/${id}.md`
}

/** A system stored under externals/ is outside the architecture boundary. */
export function isExternalPath(sourceFilename: string): boolean {
  return sourceFilename.split('/')[1] === 'externals'
}

/** Names no element may take, since Markdown tooling reserves them. */
export function isReservedDocument(filename: string): boolean {
  const basename = filename.slice(filename.lastIndexOf('/') + 1)
  return basename === 'index.md' || basename === 'log.md' || basename === 'project.md'
}

/** The words the CLI reads as a relation or group address, so an element with such an ID could not be edited. */
export const commandWords = { relation: 'relation', group: 'group' } as const

/** IDs no element may take: a reserved document name, or a word the CLI reads as an address. */
export function isReservedId(id: string): boolean {
  return isReservedDocument(`${id}.md`) || Object.values<string>(commandWords).includes(id)
}
