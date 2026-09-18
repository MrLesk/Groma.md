import { createScanObservation, type ScanObservation } from '@groma/scanner'

const CODE = 'JAVA_MISSING_EXTERNAL_TYPES'
// The worker requests Locale.ROOT, whose text for compiler.err.doesnt.exist is "package {0} does not exist".
const PACKAGE = /^package (\S+) does not exist$/

/**
 * Folds the unresolved-name errors every Java project's worker labels JAVA_MISSING_EXTERNAL_TYPES into one info
 * diagnostic: their count, the first listed diagnostic as the example location, and the five most frequently missing
 * packages across all projects. Identical errors on one line are one observation diagnostic, so they count once.
 */
export function summarizeMissingTypes(observation: ScanObservation | undefined): ScanObservation | undefined {
  if (observation === undefined) return undefined
  const missing = observation.diagnostics.filter(diagnostic => diagnostic.code === CODE)
  if (missing.length === 0) return observation
  const packages = new Map<string, number>()
  for (const { message } of missing) {
    const name = PACKAGE.exec(message)?.[1]
    if (name !== undefined) packages.set(name, (packages.get(name) ?? 0) + 1)
  }
  const frequent = [...packages]
    .sort(([leftName, left], [rightName, right]) => right - left || (leftName < rightName ? -1 : 1))
    .slice(0, 5).map(([name]) => name)
  const count = `${missing.length} symbol and package references are unresolved (project dependencies and generated sources are not loaded).`
  const message = frequent.length === 0 ? count : `${count} Most frequently missing packages: ${frequent.join(', ')}.`
  const others = observation.diagnostics.filter(diagnostic => diagnostic.code !== CODE)
  return createScanObservation({ ...observation, diagnostics: [...others, { ...missing[0]!, message }] })
}
