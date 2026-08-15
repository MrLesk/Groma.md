import type { ScanResult } from './types.ts'

export async function scanTypeScriptSource(
  _repositoryRoot: string,
): Promise<ScanResult> {
  return { candidates: [] }
}
