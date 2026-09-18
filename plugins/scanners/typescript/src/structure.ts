import path from 'node:path'

import { API } from 'typescript/unstable/async'
import { SyntaxKind } from 'typescript/unstable/ast'

import type { CodeFile, SourceReference } from '@groma/scanner'
import { outlineSource } from '../../typescript-outline.ts'

/** Outline each referenced file from the native SDK's project snapshot under the shared TypeScript-family rules. */
export async function readCodeStructure(
  repositoryRoot: string,
  references: readonly SourceReference[],
): Promise<CodeFile[]> {
  if (references.length === 0) return []
  const filenames = references.map(reference => path.join(repositoryRoot, reference.file))
  const api = new API({ cwd: repositoryRoot })
  try {
    const snapshot = await api.updateSnapshot({ openFiles: filenames })
    const files: CodeFile[] = []
    for (const [index, filename] of filenames.entries()) {
      const project = await snapshot.getDefaultProjectForFile(filename)
      const source = await project?.program.getSourceFile(filename)
      if (source === undefined) throw new Error(`TypeScript source not found: ${references[index]?.file}`)
      const reference = references[index]!
      const declarations = outlineSource({ SyntaxKind }, source, { symbols: reference.symbols })
      if (declarations.length > 0) files.push({ file: reference.file, declarations })
    }
    return files
  } finally {
    await api.close()
  }
}
