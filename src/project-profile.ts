import { parse, parseFrontmatter } from 'comark'
import { renderFrontmatter } from 'comark/render'

import { GromaFileSystem } from './groma-filesystem.ts'
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

export async function parseProjectProfile(
  source: string,
  sourceFilename = 'project.md',
): Promise<ProjectProfile> {
  const { frontmatter, nodes } = await parse(source)
  const { content } = parseFrontmatter(source)
  const metadata = requireProjectMetadata(frontmatter, sourceFilename)
  const overview = requireProjectOverview(nodes, content, sourceFilename)
  const overviewBlocks = await parseProjectMarkdown(overview)
  if (overviewBlocks.length === 0) throw new Error('project overview is required')
  return { ...metadata, overview, overviewBlocks }
}

export async function renderProjectProfile(input: unknown): Promise<string> {
  const profile = requireProfileInput(input)
  const source = `---\n${renderFrontmatter({
    type: 'Groma Project',
    title: profile.title,
    groma: { profile: 'architecture' },
  })}\n---\n\n${profile.overview}\n`
  await parseProjectProfile(source)
  return source
}

export async function loadProjectProfile(repositoryRoot: string): Promise<ProjectProfile | undefined> {
  const filesystem = GromaFileSystem.find(repositoryRoot)
  if (filesystem === undefined) return undefined
  try {
    return await parseProjectProfile(
      await filesystem.read('project.md'),
      filesystem.sourceFilename('project.md'),
    )
  } catch {
    return undefined
  }
}

export async function saveProjectProfile(
  repositoryRoot: string,
  input: unknown,
): Promise<ProjectProfile> {
  const profile = requireProfileInput(input)
  const filesystem = GromaFileSystem.open(repositoryRoot)
  const sourceFilename = filesystem.sourceFilename('project.md')
  const source = await filesystem.read('project.md')
  const { data } = parseFrontmatter(source)
  requireProjectMetadata(data, sourceFilename)
  const nextMetadata: Record<string, unknown> = { ...data, title: profile.title }
  if (profile.description !== undefined) {
    if (profile.description === '') delete nextMetadata.description
    else nextMetadata.description = profile.description
  }
  const next = `---\n${renderFrontmatter(nextMetadata)}\n---\n\n${profile.overview}\n`
  const saved = await parseProjectProfile(next, sourceFilename)
  await filesystem.write('project.md', next)
  return saved
}
