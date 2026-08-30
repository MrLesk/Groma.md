import path from 'node:path'

import { API } from 'typescript/unstable/async'
import {
  isArrowFunction,
  isFunctionDeclaration,
  isFunctionExpression,
  isIdentifier,
  isVariableStatement,
  ModifierFlags,
  type SourceFile,
} from 'typescript/unstable/ast'

import { withGitRevision } from '../../../history/git.ts'
import type { ArchitectureGraph } from '../../../types.ts'
import type { WebRevision } from '../payload.ts'

export interface CodeMethod {
  name: string
  file: string
  line: number
}

function isExported(modifierFlags: ModifierFlags): boolean {
  return (modifierFlags & ModifierFlags.Export) !== 0
}

function methodAt(file: string, source: SourceFile, name: string, position: number): CodeMethod {
  return {
    name,
    file,
    line: source.getLineAndCharacterOfPosition(position).line + 1,
  }
}

function functionMethod(file: string, source: SourceFile, statement: SourceFile['statements'][number]) {
  if (!isFunctionDeclaration(statement) || statement.name === undefined) return undefined
  if (!isExported(statement.modifierFlags)) return undefined
  return methodAt(file, source, statement.name.text, statement.name.getStart(source))
}

function variableMethods(file: string, source: SourceFile, statement: SourceFile['statements'][number]) {
  if (!isVariableStatement(statement) || !isExported(statement.modifierFlags)) return []
  return statement.declarationList.declarations.flatMap(declaration => {
    const initializer = declaration.initializer
    if (!isIdentifier(declaration.name) || initializer === undefined) return []
    if (!isArrowFunction(initializer) && !isFunctionExpression(initializer)) return []
    return [methodAt(file, source, declaration.name.text, declaration.name.getStart(source))]
  })
}

function methodsIn(file: string, source: SourceFile): CodeMethod[] {
  return source.statements.flatMap(statement => {
    const method = functionMethod(file, source, statement)
    return method === undefined ? variableMethods(file, source, statement) : [method]
  })
}

function typeScriptFiles(world: ArchitectureGraph, elementId: string): string[] | undefined {
  const element = world.elements.find(candidate => (
    candidate.kind === 'component'
    && candidate.representationId === elementId
  ))
  if (element === undefined) return undefined
  return [...new Set(element.code
    .filter(reference => reference.scanner === 'typescript')
    .map(reference => reference.file))]
}

async function sourceMethods(
  repositoryRoot: string,
  files: readonly string[],
): Promise<CodeMethod[]> {
  if (files.length === 0) return []
  const filenames = files.map(file => path.join(repositoryRoot, file))
  const api = new API({ cwd: repositoryRoot })
  try {
    const snapshot = await api.updateSnapshot({ openFiles: filenames })
    const methods: CodeMethod[] = []
    for (const [index, filename] of filenames.entries()) {
      const project = await snapshot.getDefaultProjectForFile(filename)
      const source = await project?.program.getSourceFile(filename)
      if (source === undefined) throw new Error(`TypeScript source not found: ${files[index]}`)
      methods.push(...methodsIn(files[index]!, source))
    }
    return methods
  } finally {
    await api.close()
  }
}

/** Reads callable public evidence only from the selected component's TypeScript Code files. */
export async function readCodeMethods(
  repositoryRoot: string,
  world: ArchitectureGraph,
  revision: WebRevision | null,
  elementId: string,
): Promise<CodeMethod[] | undefined> {
  const files = typeScriptFiles(world, elementId)
  if (files === undefined) return undefined
  const load = (root: string) => sourceMethods(root, files)
  return revision === null
    ? load(repositoryRoot)
    : withGitRevision(repositoryRoot, revision.id, load)
}
