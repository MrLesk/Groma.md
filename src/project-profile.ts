import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { parse, parseFrontmatter } from 'comark'
import { renderFrontmatter } from 'comark/render'

import { requireProjectMetadata, requireProjectOverview } from './okf-profile.ts'
import { parseProjectMarkdown } from './project-markdown.ts'
import type { MarkdownBlock } from './project-markdown.ts'

export interface ProjectProfileInput {
  title: string
  overview: string
  description?: string
}

export interface ProjectProfile {
  title: string
  description?: string
  overview: string
  overviewBlocks: MarkdownBlock[]
}

const profileFilename = (repositoryRoot: string): string =>
  path.join(repositoryRoot, 'groma', 'project.md')

function requireProfileInput(input: unknown): ProjectProfileInput {
  const candidate = input as Partial<ProjectProfileInput> | null
  const title = typeof candidate?.title === 'string' ? candidate.title.trim() : ''
  const overview = typeof candidate?.overview === 'string' ? candidate.overview.trim() : ''
  if (title === '' || title.includes('\n')) throw new Error('project title is required on one line')
  if (overview === '') throw new Error('project overview is required')
  if (candidate?.description !== undefined && typeof candidate.description !== 'string') {
    throw new Error('project description must be text')
  }
  return {
    title,
    overview,
    ...(candidate?.description === undefined ? {} : { description: candidate.description }),
  }
}

export async function parseProjectProfile(source: string): Promise<ProjectProfile> {
  const { frontmatter, nodes } = await parse(source)
  const { content } = parseFrontmatter(source)
  const metadata = requireProjectMetadata(frontmatter, 'groma/project.md')
  const overview = requireProjectOverview(nodes, content, 'groma/project.md')
  const overviewBlocks = await parseProjectMarkdown(overview)
  if (overviewBlocks.length === 0) throw new Error('project overview is required')
  return { ...metadata, overview, overviewBlocks }
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
  const profile = requireProfileInput(input)
  const filename = profileFilename(repositoryRoot)
  const source = await readFile(filename, 'utf8')
  const { data } = parseFrontmatter(source)
  requireProjectMetadata(data, 'groma/project.md')
  const nextMetadata: Record<string, unknown> = { ...data, title: profile.title }
  if (profile.description !== undefined) {
    if (profile.description === '') delete nextMetadata.description
    else nextMetadata.description = profile.description
  }
  const next = `---\n${renderFrontmatter(nextMetadata)}\n---\n\n${profile.overview}\n`
  const saved = await parseProjectProfile(next)
  await writeFile(filename, next)
  return saved
}
