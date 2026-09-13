import { diffLines } from 'diff'
import type { ArchitectureFinding, ArchitectureFindingInstance } from '../../../types.ts'

/** Filtering selects whole groups, keeping copies outside the chosen component available. */
export function duplicateGroups(findings: readonly ArchitectureFinding[], owner: string, match: string): ArchitectureFinding[] {
  return findings.filter(finding => (match === '' || finding.match === match)
    && (owner === '' || finding.instances.some(instance => instance.owner === owner)))
}

export interface ComparedLine {
  number: number
  text: string
  changed: boolean
}

export function operationSource(source: string, instance: ArchitectureFindingInstance): string {
  return source.replace(/\r\n/g, '\n').split('\n').slice(instance.startLine - 1, instance.endLine).join('\n')
}

/** Text differences are review evidence, independent of the detector's normalized-token match. */
export function compareOperations(left: string, right: string, starts: [number, number]): [ComparedLine[], ComparedLine[]] {
  const result: [ComparedLine[], ComparedLine[]] = [[], []]
  const numbers = [...starts]
  for (const change of diffLines(left, right)) {
    const lines = change.value.split('\n')
    if (lines.at(-1) === '') lines.pop()
    for (const side of [0, 1] as const) {
      if ((side === 0 && change.added) || (side === 1 && change.removed)) continue
      for (const text of lines) result[side].push({ number: numbers[side]!++, text, changed: !!(change.added || change.removed) })
    }
  }
  return result
}

/** A new comparison or world cancels publication of an older asynchronous read. */
export function comparisonReader<T>() {
  let generation = 0
  return {
    invalidate() { generation++ },
    async read(load: () => Promise<T>, publish: (value: T | Error) => void): Promise<void> {
      const request = ++generation
      try {
        const value = await load()
        if (request === generation) publish(value)
      } catch (error) {
        if (request === generation) publish(error instanceof Error ? error : new Error(String(error)))
      }
    },
  }
}
