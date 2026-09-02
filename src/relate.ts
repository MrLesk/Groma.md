import path from 'node:path'

import { buildArchitectureModel } from './architecture-model.ts'
import { loadArchitecture } from './architecture-reader.ts'
import {
  readDocument,
  withoutRelationship,
  withRelationship,
  writeDocument,
} from './markdown-emitter.ts'

interface RelateInput {
  source: string
  target: string
  description: string
  technology: string
}

async function loadModel(repositoryRoot: string) {
  return buildArchitectureModel((await loadArchitecture(repositoryRoot)).documents)
}

function relationshipHref(sourceFilename: string, targetFilename: string): string {
  return path.posix.relative(path.posix.dirname(sourceFilename), targetFilename)
}

function requireText(value: string, flag: string): string {
  if (value.trim().length === 0) throw new Error(`${flag} must not be empty`)
  return value
}

export async function relateElements(
  repositoryRoot: string,
  input: RelateInput,
): Promise<string> {
  const description = requireText(input.description, '--description')
  const technology = requireText(input.technology, '--technology')
  const model = await loadModel(repositoryRoot)
  const source = model.elements.find(element => element.id === input.source)
  if (source === undefined) throw new Error(`unknown source "${input.source}"`)
  const target = model.elements.find(element => element.id === input.target)
  if (target === undefined) throw new Error(`unknown target "${input.target}"`)
  if (model.relationships.some(relationship => {
    return relationship.sourceId === source.id
      && relationship.targetId === target.id
      && relationship.description === description
      && relationship.technology === technology
  })) {
    throw new Error('relationship already exists')
  }

  const current = await readDocument(repositoryRoot, source.sourceFilename)
  const href = relationshipHref(source.sourceFilename, target.sourceFilename)
  await writeDocument(
    repositoryRoot,
    source.sourceFilename,
    withRelationship(current, {
      targetName: target.title,
      targetHref: href,
      description,
      technology,
    }),
  )
  return source.id
}

export async function removeRelationship(
  repositoryRoot: string,
  sourceId: string,
  targetId: string,
): Promise<string> {
  const model = await loadModel(repositoryRoot)
  const source = model.elements.find(element => element.id === sourceId)
  if (source === undefined) throw new Error(`unknown source "${sourceId}"`)
  const target = model.elements.find(element => element.id === targetId)
  if (target === undefined) throw new Error(`unknown target "${targetId}"`)
  const matches = model.relationships.filter(relationship => {
    return relationship.sourceId === source.id && relationship.targetId === target.id
  })
  if (matches.length === 0) throw new Error('relationship does not exist')
  if (matches.length > 1) throw new Error('relationship removal is ambiguous')
  const relationship = matches[0]!
  const href = relationshipHref(source.sourceFilename, target.sourceFilename)
  const row = `| [${target.title}](${href}) | ${relationship.description} | ${relationship.technology} |`
  const current = await readDocument(repositoryRoot, source.sourceFilename)
  await writeDocument(
    repositoryRoot,
    source.sourceFilename,
    withoutRelationship(current, row),
  )
  return source.id
}
