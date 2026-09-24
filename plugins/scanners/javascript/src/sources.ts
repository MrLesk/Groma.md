import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { repositoryFiles } from '../../projects.ts'

const SOURCE = /\.(?:js|mjs|cjs|jsx)$/

export interface JavaScriptSource {
  file: string
  text: string
}

/** Tracked and unignored JavaScript files outside `excluded`. */
export function javaScriptFiles(root: string, excluded: (file: string) => boolean = () => false): Promise<string[]> {
  return repositoryFiles(root, file => SOURCE.test(file) && !excluded(file))
}

/** The text of each JavaScript file outside `excluded`. */
export async function javaScriptSources(root: string, excluded: (file: string) => boolean): Promise<JavaScriptSource[]> {
  const sources: JavaScriptSource[] = []
  for (const file of await javaScriptFiles(root, excluded)) sources.push({ file, text: await readFile(path.join(root, file), 'utf8') })
  return sources
}
