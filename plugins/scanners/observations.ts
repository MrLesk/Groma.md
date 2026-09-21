import path from 'node:path'
import { createScanObservation, type ScanObservation, type ScanFile } from '@groma/scanner'

/** Move project-local compiler output into the repository's source coordinate system. */
export function relocateObservation(observation: ScanObservation, directory: string): ScanObservation {
  const file = (value: string) => path.posix.normalize(path.posix.join(directory, value))
  return { ...observation,
    roots: observation.roots.map(root => ({ ...root, ...(root.file ? { file: file(root.file) } : {}) })),
    files: observation.files.map(source => ({ ...source, file: file(source.file) })),
    ...(observation.sourceUnits === undefined ? {} : {
      sourceUnits: observation.sourceUnits.map(unit => ({ primary: file(unit.primary), files: unit.files.map(file) })),
    }),
    ...(observation.entryPoints === undefined ? {} : {
      entryPoints: observation.entryPoints.map(entry => ({ ...entry, file: file(entry.file),
        declaration: file(entry.declaration), files: entry.files.map(file) })),
    }),
    operations: observation.operations?.map(operation => ({ ...operation, file: file(operation.file) })),
    invocations: observation.invocations?.map(call => ({ ...call,
      ...(call.binding ? { binding: { ...call.binding, file: file(call.binding.file) } } : {}) })),
    diagnostics: observation.diagnostics.map(item => ({ ...item, ...(item.file ? { file: file(item.file) } : {}) })),
  }
}

/** Compiler contexts keep distinct IDs, while shared physical files remain one file. */
export function combineObservations(parts: { key: string; observation: ScanObservation }[]): ScanObservation | undefined {
  if (!parts.length) return undefined
  const roots: ScanObservation['roots'] = []
  const files = new Map<string, ScanFile>()
  const operations: NonNullable<ScanObservation['operations']> = []
  const invocations: NonNullable<ScanObservation['invocations']> = []
  const diagnostics: ScanObservation['diagnostics'] = []
  const sourceUnits: NonNullable<ScanObservation['sourceUnits']> = []
  const entryPoints: NonNullable<ScanObservation['entryPoints']> = []
  const httpEndpoints: NonNullable<ScanObservation['httpEndpoints']> = []
  const httpRequests: NonNullable<ScanObservation['httpRequests']> = []
  for (const { key, observation } of parts) {
    const id = (value: string) => JSON.stringify([key, value])
    roots.push(...observation.roots.map(root => ({ ...root, id: id(root.id), ...(root.parent ? { parent: id(root.parent) } : {}) })))
    for (const source of observation.files) {
      const combined = files.get(source.file) ?? { file: source.file, roots: [], symbols: [] }
      combined.roots.push(...source.roots.map(id))
      combined.symbols.push(...source.symbols.map(symbol => ({ ...symbol, id: id(symbol.id) })))
      files.set(source.file, combined)
    }
    operations.push(...(observation.operations ?? []).map(operation => ({ ...operation, id: id(operation.id) })))
    invocations.push(...(observation.invocations ?? []).map(call => ({ ...call, source: id(call.source), targets: call.targets.map(id) })))
    httpEndpoints.push(...(observation.httpEndpoints ?? []).map(endpoint => ({ ...endpoint, operation: id(endpoint.operation) })))
    httpRequests.push(...(observation.httpRequests ?? []).map(request => ({ ...request, operation: id(request.operation) })))
    diagnostics.push(...observation.diagnostics)
    sourceUnits.push(...observation.sourceUnits ?? [])
    entryPoints.push(...observation.entryPoints ?? [])
  }
  return createScanObservation({ scanner: parts[0]!.observation.scanner, roots, files: [...files.values()],
    operations, invocations, diagnostics,
    ...(parts.some(part => part.observation.sourceUnits !== undefined) ? { sourceUnits } : {}),
    ...(parts.some(part => part.observation.entryPoints !== undefined) ? { entryPoints } : {}),
    ...(parts.some(part => part.observation.httpEndpoints !== undefined) ? { httpEndpoints } : {}),
    ...(parts.some(part => part.observation.httpRequests !== undefined) ? { httpRequests } : {}),
  })
}
