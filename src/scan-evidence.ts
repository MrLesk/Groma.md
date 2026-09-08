import type { ScanDiagnostic, ScanInvocation, ScanObservation, ScanOperation } from '@groma/scanner'

export interface InvocationEvidence {
  invocation: ScanInvocation
  operations: ReadonlyMap<string, ScanOperation>
  languages: string[]
}

/** Positions identify source declarations; scanner-local IDs only link facts within one observation. */
function operationKey(operation: ScanOperation | undefined): string | undefined {
  return operation?.position === undefined ? undefined : JSON.stringify([operation.file, operation.position])
}

function targetKeys(evidence: InvocationEvidence): string[] | undefined {
  const keys = evidence.invocation.targets.map(id => operationKey(evidence.operations.get(id)))
  if (keys.some(key => key === undefined)) return undefined
  return [...new Set(keys as string[])].sort()
}

function claimKey(evidence: InvocationEvidence): string | undefined {
  const { invocation, operations } = evidence
  const source = operationKey(operations.get(invocation.source))
  if (source === undefined || invocation.position === undefined) return undefined
  const binding = invocation.binding
  if (binding && binding.position === undefined) return undefined
  if (targetKeys(evidence) === undefined) return undefined
  return JSON.stringify([source, invocation.position, invocation.member,
    binding ? [binding.file, binding.position] : null])
}

function conflictFor(claims: InvocationEvidence[]): ScanDiagnostic {
  const first = claims[0]!
  const source = first.operations.get(first.invocation.source)!
  const providers = claims.map(claim => {
    const targets = claim.invocation.targets.map(id => {
      const target = claim.operations.get(id)!
      return `${target.file}:${target.position}`
    }).sort()
    return `${claim.languages.join(', ')} -> ${[...new Set(targets)].join(', ')}`
  })
  const binding = first.invocation.binding
  const context = binding ? ` (binding ${binding.file}:${binding.position})` : ''
  return {
    severity: 'warning',
    code: 'conflicting-providers',
    message: `${source.file}:${first.invocation.line} at offset ${first.invocation.position}${context}: incompatible certain providers: ${[...new Set(providers)].sort().join('; ')}`,
  }
}

/** Equal certain claims agree. An unresolved observation does not contradict a supported binding. */
function combineGroup(
  group: InvocationEvidence[],
  claims: InvocationEvidence[],
  conflicts: ScanDiagnostic[],
): void {
  const certain = group.filter(evidence => !evidence.invocation.unresolved)
  if (!certain.length) return
  const alternatives = new Set(certain.map(evidence => JSON.stringify(targetKeys(evidence))))
  if (alternatives.size > 1) {
    conflicts.push(conflictFor(certain))
    return
  }
  claims.push({
    ...certain[0]!,
    languages: [...new Set(certain.flatMap(evidence => evidence.languages))].sort(),
  })
}

/** Combine only source-addressed claims; evidence without positions remains observation-local. */
export function composeInvocations(observations: readonly ScanObservation[]): {
  claims: InvocationEvidence[]
  conflicts: ScanDiagnostic[]
} {
  const groups = new Map<string, InvocationEvidence[]>()
  const claims: InvocationEvidence[] = []
  const conflicts: ScanDiagnostic[] = []
  for (const observation of observations) {
    const operations = new Map(observation.operations?.map(operation => [operation.id, operation]))
    for (const invocation of observation.invocations ?? []) {
      const evidence = { invocation, operations, languages: [observation.scanner.language] }
      const key = claimKey(evidence)
      if (key === undefined) {
        claims.push(evidence)
        continue
      }
      const group = groups.get(key) ?? []
      group.push(evidence)
      groups.set(key, group)
    }
  }
  for (const group of groups.values()) combineGroup(group, claims, conflicts)
  conflicts.sort((left, right) => left.message.localeCompare(right.message))
  return { claims, conflicts }
}
