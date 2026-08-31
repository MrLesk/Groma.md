import { readFile } from 'node:fs/promises'

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
