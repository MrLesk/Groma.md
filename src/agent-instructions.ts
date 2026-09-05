import { readFile, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'

const instructionFiles = ['AGENTS.md', 'CLAUDE.md'] as const
const managedBlockPattern = /<!-- groma:start -->[\s\S]*?<!-- groma:end -->/g

const managedAgentInstructions = `<!-- groma:start -->
## Groma

This project uses Groma. Run \`groma agent-instructions\` when scanning or curating architecture, or changing scanner or architecture-model behavior. Do not edit Groma-owned architecture files directly.

When the \`backlog\` CLI is available and you work on a Backlog task, immediately record each changed repository-relative file through \`backlog task edit <task-id> --modified-file <path>\`, preserving the full existing modified-file list. Add exact affected \`groma.id\` values to that task's references through \`backlog task edit <task-id> --add-ref <groma-id>\`. After a structural command, record all reported paths and replace absorbed references with surviving IDs through the Backlog CLI before another change. Run \`groma agent-instructions\` for the full procedure.
<!-- groma:end -->`

export const agentInstructionGuides = [
  {
    id: 'curation',
    source: new URL('../docs/agent-instructions/index.md', import.meta.url),
  },
] as const

export async function agentInstructionGuide(id: string | undefined) {
  const selected = id ?? 'curation'
  const guide = agentInstructionGuides.find(candidate => candidate.id === selected)
  if (guide === undefined) return undefined
  return {
    id: guide.id,
    content: (await readFile(guide.source, 'utf8')).trimEnd(),
  }
}

function missingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

async function existingInstructionFiles(repositoryRoot: string): Promise<string[]> {
  const files = await Promise.all(instructionFiles.map(async name => {
    const file = path.join(repositoryRoot, name)
    try {
      return { file, target: await realpath(file) }
    } catch (error) {
      if (missingFile(error)) return undefined
      throw error
    }
  }))
  const targets = new Set<string>()
  return files.flatMap(candidate => {
    if (candidate === undefined || targets.has(candidate.target)) return []
    targets.add(candidate.target)
    return [candidate.file]
  })
}

function reconcileManagedBlock(content: string): string {
  let found = false
  const reconciled = content.replace(managedBlockPattern, () => {
    if (found) return ''
    found = true
    return managedAgentInstructions
  })
  if (found) return reconciled
  if (content.length === 0) return `${managedAgentInstructions}\n`
  return `${content}${content.endsWith('\n') ? '\n' : '\n\n'}${managedAgentInstructions}\n`
}

export async function initializeAgentInstructions(repositoryRoot: string): Promise<void> {
  const existing = await existingInstructionFiles(repositoryRoot)
  const files = existing.length > 0
    ? existing
    : [path.join(repositoryRoot, 'AGENTS.md')]
  await Promise.all(files.map(async file => {
    const content = await readFile(file, 'utf8').catch(error => {
      if (missingFile(error)) return ''
      throw error
    })
    const reconciled = reconcileManagedBlock(content)
    if (reconciled !== content) await writeFile(file, reconciled)
  }))
}
