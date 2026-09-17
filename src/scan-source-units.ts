import type { ScanDiagnostic, ScanObservation, ScanSourceUnit } from '@groma/scanner'

function conflict(code: string, file: string, message: string): ScanDiagnostic {
  return { severity: 'warning', code, file, message }
}

/**
 * Returns the multi-file units that are safe to group. It drops units that share a file or whose files have different
 * existing owners. Existing ownership is authoritative and is never checked against units.
 */
export function sourceUnitGroups<Owner extends { id: string }>(
  observations: readonly ScanObservation[],
  ownerByFile: ReadonlyMap<string, Owner>,
): { units: { unit: ScanSourceUnit; owner?: Owner }[]; diagnostics: ScanDiagnostic[] } {
  const proposed = observations.flatMap(observation => observation.sourceUnits ?? [])
    .filter(unit => unit.files.length > 1)
    .sort((a, b) => a.primary.localeCompare(b.primary))
  const unique = new Map(proposed.map(unit => [JSON.stringify([...unit.files].sort()), unit]))
  const memberships = new Map<string, number>()
  for (const unit of unique.values()) {
    for (const file of unit.files) memberships.set(file, (memberships.get(file) ?? 0) + 1)
  }
  const diagnostics: ScanDiagnostic[] = []
  const units: { unit: ScanSourceUnit; owner?: Owner }[] = []
  for (const unit of unique.values()) {
    if (unit.files.some(file => memberships.get(file)! > 1)) {
      diagnostics.push(conflict('shared-source-unit-file', unit.primary,
        `Overlapping source units need review; ownership retained: ${unit.files.join(', ')}`))
      continue
    }
    const owners = unit.files.flatMap(file => ownerByFile.get(file) ?? [])
    if (new Set(owners.map(owner => owner.id)).size > 1) {
      diagnostics.push(conflict('conflicting-source-unit-owners', unit.primary,
        `Source unit has different existing owners; ownership retained: ${unit.files.join(', ')}`))
      continue
    }
    units.push({ unit, owner: owners[0] })
  }
  return { units, diagnostics: diagnostics.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) }
}
