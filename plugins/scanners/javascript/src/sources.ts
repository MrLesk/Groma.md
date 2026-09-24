import { readFile } from 'node:fs/promises'
import path from 'node:path'

const SOURCE = /\.(?:js|mjs|cjs|jsx)$/

export interface JavaScriptSource {
  file: string
  text: string
}

/** The JavaScript sources among a scanner's files. */
export function javaScriptFiles(files: readonly string[]): string[] {
  return files.filter(file => SOURCE.test(file))
}

/** The text of each JavaScript source among the files. */
export async function javaScriptSources(root: string, files: readonly string[]): Promise<JavaScriptSource[]> {
  const sources: JavaScriptSource[] = []
  for (const file of javaScriptFiles(files)) sources.push({ file, text: await readFile(path.join(root, file), 'utf8') })
  return sources
}
