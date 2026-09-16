import type { ScanDiagnostic, ScanObservation, ScanSourceUnit } from '@groma/scanner'
import type { CodeReference } from './types.ts'

interface Owner {
  id: string
  code: CodeReference[]
}

function conflict(code: string, file: string, message: string): ScanDiagnostic {
  return { severity: 'warning', code, file, message }
}

/** Compare whole declarations; intersecting declarations are not transitive ownership. */
export function sourceUnitGroups(
  observations: readonly ScanObservation[],
  owners: ReadonlyMap<string, Owner>,
): { units: ScanSourceUnit[]; diagnostics: ScanDiagnostic[] } {
  const proposed = observations.flatMap(observation => observation.sourceUnits ?? [])
    .filter(unit => unit.files.length > 1)
    .sort((a, b) => a.primary.localeCompare(b.primary))
  const unique = new Map(proposed.map(unit => [JSON.stringify([...unit.files].sort()), unit]))
  const memberships = new Map<string, number>()
  for (const unit of unique.values()) {
    for (const file of unit.files) memberships.set(file, (memberships.get(file) ?? 0) + 1)
  }
  const diagnostics: ScanDiagnostic[] = []
  const units = [...unique.values()].filter(unit => {
    if (unit.files.some(file => memberships.get(file)! > 1)) {
      diagnostics.push(conflict('shared-source-unit-file', unit.primary,
        `Overlapping source units need review; ownership retained: ${unit.files.join(', ')}`))
      return false
    }
    const established = new Set(unit.files.flatMap(file => owners.get(file)?.id ?? []))
    if (established.size > 1) {
      diagnostics.push(conflict('conflicting-source-unit-owners', unit.primary,
        `Source unit has different existing owners; ownership retained: ${unit.files.join(', ')}`))
      return false
    }
    return true
  })
  diagnostics.push(...unsupportedMembership(observations, owners))
  return { units, diagnostics: diagnostics.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) }
}

/** Without stored inference history, report current support rather than claiming a past association. */
function unsupportedMembership(
  observations: readonly ScanObservation[],
  owners: ReadonlyMap<string, Owner>,
): ScanDiagnostic[] {
  const diagnostics: ScanDiagnostic[] = []
  for (const observation of observations) {
    if (observation.sourceUnits === undefined) continue
    for (const owner of new Set(owners.values())) {
      const files = [...new Set(owner.code.filter(code => code.scanner === observation.scanner.id)
        .map(code => code.file))].sort()
      if (files.length < 2 || observation.sourceUnits.some(unit => files.every(file => unit.files.includes(file)))) continue
      diagnostics.push(conflict('unconfirmed-source-unit-membership', files[0]!,
        `${observation.scanner.id} does not jointly associate the retained files of ${owner.id}; review if needed, ownership retained: ${files.join(', ')}`))
    }
  }
  return diagnostics
}
