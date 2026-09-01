import { initializeAgentInstructions } from './agent-instructions.ts'
import {
  GromaFileSystem,
  type GromaDirectory,
} from './groma-filesystem.ts'
import {
  parseProjectProfile,
  renderProjectProfile,
} from './project-profile.ts'

export interface GromaInitInput {
  projectName?: string
  directory?: string
}

export interface GromaInitPrompts {
  projectName(): Promise<string>
  directory(): Promise<string>
}

export interface GromaInitResult {
  directory: GromaDirectory
  projectName: string
}

async function existingProjectName(
  filesystem: GromaFileSystem | undefined,
): Promise<string | undefined> {
  if (filesystem === undefined || !filesystem.exists('project.md')) return undefined
  const sourceFilename = filesystem.sourceFilename('project.md')
  return (await parseProjectProfile(
    await filesystem.read('project.md'),
    sourceFilename,
  )).title
}

async function requiredProjectName(
  supplied: string | undefined,
  prompts: GromaInitPrompts | undefined,
): Promise<string> {
  const projectName = (supplied ?? await prompts?.projectName())?.trim()
  if (!projectName) {
    throw new Error('project name is required when Groma is not initialized')
  }
  return projectName
}

async function requiredDirectory(
  supplied: string | undefined,
  prompts: GromaInitPrompts | undefined,
): Promise<string> {
  const directory = (supplied ?? await prompts?.directory())?.trim()
  if (!directory) {
    throw new Error('--directory is required when Groma is not initialized')
  }
  return directory
}

async function writeMissing(
  filesystem: GromaFileSystem,
  relative: string,
  source: string,
): Promise<void> {
  if (!filesystem.exists(relative)) await filesystem.write(relative, source)
}

export async function initializeGroma(
  repositoryRoot: string,
  input: GromaInitInput = {},
  prompts?: GromaInitPrompts,
): Promise<GromaInitResult> {
  const existing = GromaFileSystem.find(repositoryRoot)
  const storedProjectName = await existingProjectName(existing)
  const projectName = storedProjectName
    ?? await requiredProjectName(input.projectName, prompts)
  const requestedDirectory = existing?.directory
    ?? await requiredDirectory(input.directory, prompts)
  const filesystem = GromaFileSystem.initialize(
    repositoryRoot,
    existing === undefined ? requestedDirectory : input.directory,
  )
  const projectSource = await renderProjectProfile({
    title: projectName,
    overview: `Architecture for ${projectName}.`,
  })

  await writeMissing(filesystem, 'index.md', '---\nokf_version: "0.2"\n---\n')
  await writeMissing(filesystem, 'project.md', projectSource)
  await writeMissing(filesystem, 'observed/index.md', '# Observed architecture\n')
  await writeMissing(filesystem, 'missing/index.md', '# Missing architecture\n')
  await writeMissing(filesystem, 'plans/index.md', '# Plans\n')
  await initializeAgentInstructions(repositoryRoot)

  return { directory: filesystem.directory, projectName }
}
