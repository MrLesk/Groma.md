import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { CodeDeclaration, CodeFile, SourceReference } from '@groma/scanner'
import ts from 'typescript'
import { outlineDeclarations } from '../../typescript-outline.ts'
import { sfcScripts } from './sfc.ts'

/** Vue also owns templates and stylesheets, which declare nothing. */
const SCRIPT = /\.(?:vue|ts|js)$/

function componentDeclarations(fileName: string, text: string, symbols: readonly string[]): CodeDeclaration[] {
  return sfcScripts(fileName, text).flatMap(script => outlineDeclarations(ts, {
    fileName: script.fileName,
    text: script.text,
    symbols,
    topLevelPrivate: script.setup,
  }))
}

/** Outline each owned script, reading single-file components with the Vue single-file component parser. */
export async function readVueOutline(repositoryRoot: string, references: readonly SourceReference[]): Promise<CodeFile[]> {
  const files: CodeFile[] = []
  for (const reference of references.filter(reference => SCRIPT.test(reference.file))) {
    const fileName = path.join(repositoryRoot, reference.file)
    const text = await readFile(fileName, 'utf8')
    const declarations = reference.file.endsWith('.vue')
      ? componentDeclarations(fileName, text, reference.symbols)
      : outlineDeclarations(ts, { fileName, text, symbols: reference.symbols })
    if (declarations.length > 0) files.push({ file: reference.file, declarations })
  }
  return files
}
