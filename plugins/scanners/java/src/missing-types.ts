import { createScanObservation, type ScanDiagnostic, type ScanObservation } from '@groma/scanner'

// The worker requests Locale.ROOT, whose text for compiler.err.doesnt.exist is "package {0} does not exist".
const PACKAGE = /^package (\S+) does not exist$/

/**
 * javac's "cannot find symbol" and "package does not exist" errors. The scanner leaves project dependencies and
 * generated sources out on purpose, so these are an expected limitation, not a project defect. javac cannot tell a
 * missing dependency from any other unresolved name, so typos are among them.
 */
function unresolvedName(diagnostic: ScanDiagnostic): boolean {
  return diagnostic.code === 'compiler.err.doesnt.exist' || diagnostic.code.startsWith('compiler.err.cant.resolve')
}

/**
 * Folds the unresolved-name errors of every Java project into one JAVA_MISSING_EXTERNAL_TYPES info diagnostic:
 * their count, the first listed one as the example location, and the five most frequently missing packages across
 * all projects. Identical errors on one line are one observation diagnostic, so they count once.
 */
export function summarizeMissingTypes(observation: ScanObservation | undefined): ScanObservation | undefined {
  if (observation === undefined) return undefined
  const missing = observation.diagnostics.filter(unresolvedName)
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
  const summary = { ...missing[0]!, severity: 'info', code: 'JAVA_MISSING_EXTERNAL_TYPES', message }
  return createScanObservation({ ...observation, diagnostics: [...observation.diagnostics.filter(item => !unresolvedName(item)), summary] })
}
