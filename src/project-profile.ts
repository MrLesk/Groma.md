import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { parse } from 'comark'
import { renderMarkdown } from 'comark/render'

import { parseProjectMarkdown } from './project-markdown.ts'
import type { MarkdownBlock } from './project-markdown.ts'

export interface ProjectProfileInput {
  name: string
  description: string
}

export interface ProjectProfile extends ProjectProfileInput {
  descriptionBlocks: MarkdownBlock[]
}

const profileFilename = (repositoryRoot: string): string =>
  path.join(repositoryRoot, 'groma', 'README.md')

function nodeText(node: unknown): string {
  if (typeof node === 'string') return node
  if (!Array.isArray(node)) return ''
  return node.slice(2).map(nodeText).join('')
}

function requireProfileInput(input: unknown): ProjectProfileInput {
  const candidate = input as Partial<ProjectProfileInput> | null
  const name = typeof candidate?.name === 'string' ? candidate.name.trim() : ''
  const description = typeof candidate?.description === 'string' ? candidate.description.trim() : ''
  if (name === '' || name.includes('\n')) throw new Error('project name is required on one line')
  if (description === '') throw new Error('project description is required')
  return { name, description }
}

async function projectProfile(input: unknown): Promise<ProjectProfile> {
  const profile = requireProfileInput(input)
  const descriptionBlocks = await parseProjectMarkdown(profile.description)
  if (descriptionBlocks.length === 0) throw new Error('project description is required')
  return { ...profile, descriptionBlocks }
}

export async function parseProjectProfile(source: string): Promise<ProjectProfile> {
  const { nodes } = await parse(source)
  const heading = nodes.findIndex(node => Array.isArray(node) && node[0] === 'h1')
  if (heading === -1) throw new Error('groma/README.md requires a project name heading')
  const description = (await renderMarkdown({
    nodes: nodes.slice(heading + 1),
    frontmatter: {},
    meta: {},
  })).trim()
  return projectProfile({
    name: nodeText(nodes[heading]).trim(),
    description,
  })
}

export async function loadProjectProfile(repositoryRoot: string): Promise<ProjectProfile | undefined> {
  try {
    return await parseProjectProfile(await readFile(profileFilename(repositoryRoot), 'utf8'))
  } catch {
    return undefined
  }
}

export async function saveProjectProfile(
  repositoryRoot: string,
  input: unknown,
): Promise<ProjectProfile> {
  const profile = await projectProfile(input)
  await writeFile(profileFilename(repositoryRoot), `# ${profile.name}\n\n${profile.description}\n`)
  return profile
}
