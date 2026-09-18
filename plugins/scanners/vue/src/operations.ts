import ts from 'typescript'
import type { ScanOperation } from '@groma/scanner'
import { typeScriptOperations } from '../../typescript-operations.ts'
import { relative, type VueProject } from './project.ts'
import { sfcScripts } from './sfc.ts'

const { comparedOperation } = typeScriptOperations(ts)

/**
 * Every named operation in the single-file component's scripts, with the lines it occupies in the `.vue`
 * file and its body tokens. Core applies the minimum body sizes, so no body is filtered out here.
 */
function comparedOperations(file: string, text: string): ScanOperation[] {
  const operations: ScanOperation[] = []
  for (const script of sfcScripts(file, text)) {
    const source = ts.createSourceFile(script.fileName, script.text, ts.ScriptTarget.Latest, true)
    const visit = (node: ts.Node): void => {
      const compared = comparedOperation(node)
      if (compared !== undefined) {
        const position = node.getStart(source)
        operations.push({ id: `${file}#${position}`, file, position, ...compared })
      }
      node.forEachChild(visit)
    }
    source.forEachChild(visit)
  }
  return operations
}

/** Report every compared body of the project's single-file components; one entry per function, shared with its binding evidence. */
export function addComparedOperations(project: VueProject, operations: Map<string, ScanOperation>): void {
  for (const source of project.files) {
    if (!project.sfc(source.fileName)) continue
    const file = relative(project.root, source.fileName)
    // The id is the file and the declaration position, so binding evidence for the same function is this entry.
    for (const operation of comparedOperations(file, project.text(source.fileName))) {
      operations.set(operation.id, operation)
    }
  }
}
