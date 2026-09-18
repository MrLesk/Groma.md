import path from 'node:path'
import { createScanObservation, type ScannerPlugin } from '@groma/scanner'
import ts from 'typescript'
import { javaScriptEvidence } from './evidence.ts'
import { javaScriptHttpFacts } from './http.ts'
import { readJavaScriptOutline } from './outline.ts'
import { javaScriptSources, type JavaScriptSource } from './sources.ts'

/** Each file is parsed alone, so no project configuration, dependency or build tool is needed. */
function parse(source: JavaScriptSource): ts.SourceFile {
  return ts.createSourceFile(source.file, source.text, ts.ScriptTarget.Latest, true)
}

export default {
  id: 'javascript',
  watch: {
    include: ['**/*.js', '**/*.mjs', '**/*.cjs', '**/*.jsx'],
    exclude: ['**/*.min.js', '**/*.min.mjs', '**/*.min.cjs', '**/*.min.jsx'],
  },
  /** The same authored selection `scan` makes, so a minified bundle is never listed. */
  listSourceFiles: async root => (await javaScriptSources(root)).map(source => source.file),
  async checkReadiness(root) {
    if (!(await javaScriptSources(root)).length) {
      throw new Error('javascript: No authored JavaScript source files were found in the Git repository.')
    }
  },
  async scan(root) {
    const sources = await javaScriptSources(root)
    if (!sources.length) return undefined
    // The HTTP facts name operations, so they are read before the observation collects them.
    const scanned = sources.map(source => {
      const parsed = parse(source)
      const evidence = javaScriptEvidence(source.file, parsed)
      return { file: source.file, evidence, facts: javaScriptHttpFacts(parsed, evidence) }
    })
    return createScanObservation({
      scanner: { id: 'javascript', technology: 'javascript', engine: 'typescript-sdk', engineVersion: ts.version },
      roots: [{ id: 'javascript-source', kind: 'source-group', name: path.basename(root) }],
      files: scanned.map(({ file, evidence }) => ({ file, symbols: evidence.symbols, roots: ['javascript-source'] })),
      operations: scanned.flatMap(({ evidence }) => evidence.operations),
      invocations: scanned.flatMap(({ evidence }) => evidence.invocations),
      httpEndpoints: scanned.flatMap(({ facts }) => facts.httpEndpoints),
      httpRequests: scanned.flatMap(({ facts }) => facts.httpRequests),
      diagnostics: [{ severity: 'info', code: 'JAVASCRIPT_SOURCE_SCOPE',
        message: 'Source syntax only. Module loading, dynamic dispatch, framework wiring and external symbols remain unresolved.' }],
    })
  },
  // Every file this scanner owns is a JavaScript source, so no reference is filtered out here.
  readCodeStructure: readJavaScriptOutline,
} satisfies ScannerPlugin
