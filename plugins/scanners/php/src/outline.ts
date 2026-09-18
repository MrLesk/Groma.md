import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { CodeDeclaration, CodeFile, CodeSymbol, CodeVisibility, SourceReference } from '@groma/scanner'
import { field, list, nameOf, parsePhp, symbolName, typeKinds, type Fields, type Syntax } from './syntax.ts'

interface OutlineScope {
  /** Symbols the Code reference names, spelled as the scan names them. */
  symbols: readonly string[]
  namespace: string
}

function lineOf(node: Syntax): number {
  return node.loc!.start.line
}

function memberVisibility(method: Fields): CodeVisibility {
  return method.visibility === 'private' || method.visibility === 'protected' ? method.visibility : 'public'
}

/** Every method, including static, abstract and interface signatures; properties, constants and cases are not listed. */
function members(scope: OutlineScope, type: Fields, typeSymbol: string): CodeSymbol[] {
  return list(type, 'body').filter(member => member.kind === 'method').map(method => {
    const name = nameOf(method.name)!
    return {
      name,
      line: lineOf(field(method, 'name')!),
      visibility: memberVisibility(method),
      entry: scope.symbols.includes(symbolName(scope.namespace, name, typeSymbol)),
    }
  })
}

/** The variable of a statement such as `$format = fn () => ...;`, which binds a function literal directly. */
function closureVariable(statement: Fields): Fields | undefined {
  const assignment = statement.kind === 'expressionstatement' ? field(statement, 'expression') : undefined
  if (assignment?.kind !== 'assign' || assignment.operator !== '=') return undefined
  const variable = field(assignment, 'left')!
  const value = field(assignment, 'right')!
  if (value.kind !== 'closure' && value.kind !== 'arrowfunc') return undefined
  return variable.kind === 'variable' && typeof variable.name === 'string' ? variable : undefined
}

/**
 * The name guarded by `if (!function_exists('name')) { ... }`, the PHP idiom for declaring a top-level function once.
 * PHP reads the string as a fully qualified name, so the leading backslash is optional.
 */
function guardedName(statement: Fields): string | undefined {
  const test = statement.kind === 'if' && field(statement, 'body')?.kind === 'block' ? field(statement, 'test') : undefined
  const call = test?.kind === 'unary' && test.type === '!' ? field(test, 'what') : undefined
  if (call?.kind !== 'call' || nameOf(call.what)?.replace(/^\\/, '') !== 'function_exists') return undefined
  const [argument] = list(call, 'arguments')
  return argument?.kind === 'string' ? String(argument.value).replace(/^\\/, '') : undefined
}

/** Inside such a guard, only the function the guard names by its namespace-qualified symbol name is top-level. */
function guardedFunctions(scope: OutlineScope, statement: Fields): Fields[] {
  const name = guardedName(statement)
  if (name === undefined) return []
  return list(field(statement, 'body')!, 'children')
    .filter(child => child.kind === 'function' && symbolName(scope.namespace, nameOf(child.name)!) === name)
}

function declarationsOf(scope: OutlineScope, statement: Fields): CodeDeclaration[] {
  if (statement.kind === 'if') return guardedFunctions(scope, statement).flatMap(guarded => declarationsOf(scope, guarded))
  const variable = closureVariable(statement)
  // A closure has no scan symbol, so no Code reference can name it.
  if (variable) return [{ kind: 'function', name: `$${variable.name}`, line: lineOf(variable), visibility: 'public', entry: false }]
  if (statement.kind !== 'function' && !typeKinds.has(statement.kind)) return []
  const name = nameOf(statement.name)!
  const qualified = symbolName(scope.namespace, name)
  const symbol = { name, line: lineOf(field(statement, 'name')!), visibility: 'public' as const, entry: scope.symbols.includes(qualified) }
  if (statement.kind === 'function') return [{ kind: 'function', ...symbol }]
  return [{ kind: 'type', ...symbol, members: members(scope, statement, qualified) }]
}

/** Braced and unbraced namespace blocks are transparent: their declarations are top-level too. */
function declarationsIn(scope: OutlineScope, statements: Fields[]): CodeDeclaration[] {
  return statements.flatMap(statement => statement.kind === 'namespace'
    ? declarationsIn({ ...scope, namespace: nameOf(statement.name) ?? '' }, list(statement, 'children'))
    : declarationsOf(scope, statement))
}

/** Top-level functions and types with their methods, parsed from source only. Parser errors fail the request. */
export async function readCodeStructure(repositoryRoot: string, references: readonly SourceReference[]): Promise<CodeFile[]> {
  const files: CodeFile[] = []
  for (const reference of references) {
    const tree = parsePhp(reference.file, await readFile(path.join(repositoryRoot, reference.file), 'utf8'))
    const declarations = declarationsIn({ symbols: reference.symbols, namespace: '' }, list(tree, 'children'))
    if (declarations.length > 0) files.push({ file: reference.file, declarations })
  }
  return files
}
