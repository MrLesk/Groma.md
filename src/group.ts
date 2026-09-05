import { buildArchitectureModel } from './architecture-model.ts'
import { loadArchitecture } from './architecture-reader.ts'
import { readDocument, withGromaField, writeDocument } from './markdown-emitter.ts'
import { groupAddress, requireText } from './naming.ts'
import type { ArchitectureElement } from './types.ts'
import type { StructuralResult } from './curate.ts'

async function loadElements(repositoryRoot: string): Promise<ArchitectureElement[]> {
  return buildArchitectureModel((await loadArchitecture(repositoryRoot)).documents).elements
}

/** The sibling components that carry the addressed group. */
async function loadMembers(repositoryRoot: string, address: string): Promise<ArchitectureElement[]> {
  const members = (await loadElements(repositoryRoot)).filter(element => {
    return element.group !== undefined && element.parentId !== null && groupAddress(element.parentId, element.group) === address
  })
  if (members.length === 0) throw new Error(`no group "${address}"`)
  return members
}

async function writeGroup(repositoryRoot: string, members: ArchitectureElement[], name: string | undefined, id: string): Promise<StructuralResult> {
  const changed: string[] = []
  const affectedIds: string[] = []
  for (const member of members) {
    const source = await readDocument(repositoryRoot, member.sourceFilename)
    await writeDocument(repositoryRoot, member.sourceFilename, withGromaField(source, 'group', name))
    changed.push(member.sourceFilename)
    affectedIds.push(member.id)
  }
  return { id, created: [], changed: [...new Set(changed)], removed: [], affectedIds: [...new Set(affectedIds)], replacements: [] }
}

/** Names a group on sibling components of one container. */
export async function addGroup(repositoryRoot: string, input: { name: string; members: string[] }): Promise<StructuralResult> {
  const name = requireText(input.name, 'name').trim()
  if (input.members.length === 0) throw new Error('a group takes at least one member id')
  const elements = await loadElements(repositoryRoot)
  const members = input.members.map(id => {
    const element = elements.find(candidate => candidate.id === id)
    if (element === undefined) throw new Error(`unknown id "${id}"`)
    if (element.kind !== 'component') throw new Error(`"${id}" is a ${element.kind}; only components form a group`)
    return element
  })
  const containers = new Set(members.map(member => member.parentId))
  if (containers.size > 1) throw new Error('group members must be sibling components of one container')
  return writeGroup(repositoryRoot, members, name, groupAddress(members[0]!.parentId!, name))
}

/** Renames the group on every member. */
export async function editGroup(repositoryRoot: string, input: { address: string; title?: string }): Promise<StructuralResult> {
  const title = requireText(input.title, '--title').trim()
  const members = await loadMembers(repositoryRoot, input.address)
  return writeGroup(repositoryRoot, members, title, groupAddress(members[0]!.parentId!, title))
}

/** Takes the named members out of the group, or dissolves it when none is named. */
export async function removeGroup(repositoryRoot: string, input: { address: string; members?: string[] }): Promise<StructuralResult> {
  const members = await loadMembers(repositoryRoot, input.address)
  const leaving = (input.members ?? []).map(id => {
    const member = members.find(candidate => candidate.id === id)
    if (member === undefined) throw new Error(`"${id}" is not in group "${input.address}"`)
    return member
  })
  return writeGroup(repositoryRoot, leaving.length === 0 ? members : leaving, undefined, input.address)
}
