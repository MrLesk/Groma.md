import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { CodeDeclaration, CodeFile, SourceReference } from '@groma/scanner'
import { parse as parseSfc } from '@vue/language-core'
import ts from 'typescript'
import { outlineDeclarations, type OutlineBlock } from '../../typescript-outline.ts'

/** Vue also owns templates and stylesheets, which declare nothing. */
const SCRIPT = /\.(?:vue|[cm]?[jt]sx?)$/

interface ScriptBlock {
  content: string
  lang?: string
  loc: { start: { offset: number } }
  /** A `<script setup>` block exports nothing; its bindings are the component's own API. */
  setup: boolean
}

/**
 * Keep the block inside the file's own text, blanking everything around it except line breaks,
 * so every declaration reports the line it occupies in the `.vue` file.
 */
function blockInFile(text: string, block: ScriptBlock): string {
  const before = text.slice(0, block.loc.start.offset).replace(/[^\n]/g, ' ')
  return before + block.content
}

function scriptBlocks(text: string): ScriptBlock[] {
  const { descriptor } = parseSfc(text)
  const blocks = [
    ...(descriptor.script ? [{ ...descriptor.script, setup: false }] : []),
    ...(descriptor.scriptSetup ? [{ ...descriptor.scriptSetup, setup: true }] : []),
  ]
  return blocks.sort((left, right) => left.loc.start.offset - right.loc.start.offset)
}

function componentDeclarations(file: string, text: string, symbols: readonly string[]): CodeDeclaration[] {
  return scriptBlocks(text).flatMap(block => outlineDeclarations(ts, {
    fileName: `${file}.${block.lang ?? 'js'}`,
    text: blockInFile(text, block),
    symbols,
    topLevelPrivate: block.setup,
  } satisfies OutlineBlock))
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
