import { execFile } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createScanObservation, type CodeDeclaration, type CodeFile, type CodeVisibility, type ScannerPlugin,
  type ScanInvocation, type ScanOperation, type ScanSymbol, type SourceReference } from '@groma/scanner'
import { repositoryFiles } from '../../projects.ts'

interface FileEvidence {
  file: string
  entryType?: string
  symbols: ScanSymbol[]
  operations: ScanOperation[]
  invocations: ScanInvocation[]
  declarations: { kind: 'function' | 'type'; name: string; line: number; visibility: CodeVisibility;
    members?: { name: string; line: number; visibility: CodeVisibility }[] }[]
}

const assets = fileURLToPath(new URL('../dist/', import.meta.url))
const worker = path.join(assets, `${process.platform}-${process.arch}`, process.platform === 'win32' ? 'worker.exe' : 'worker')
// DocC catalogs hold documentation snippets that no build compiles; some are deliberately incomplete.
const catalog = new Bun.Glob('**/*.docc/**')
// SwiftPM reads Package.swift and its version-specific Package@swift-<version>.swift variants.
const manifest = /^Package(@swift-[\d.]+)?\.swift$/

async function files(root: string, excluded?: (file: string) => boolean) {
  return repositoryFiles(root, file => file.endsWith('.swift') && !manifest.test(path.posix.basename(file))
    && !catalog.match(file) && !excluded?.(file))
}

function readEvidence(root: string, files: string[]): Promise<FileEvidence[]> {
  return new Promise((resolve, reject) => {
    // Evidence grows with the source, so its output has no fixed limit.
    const child = execFile(worker, [], { cwd: root, maxBuffer: Infinity }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || (error.signal ? `Swift worker stopped by ${error.signal}` : error.message)))
      else {
        try { resolve(JSON.parse(stdout)) } catch (error) { reject(error) }
      }
    })
    child.stdin!.on('error', () => { /* execFile reports worker exit. */ })
    child.stdin!.end(JSON.stringify({ root, files }))
  })
}

/**
 * Swift runs `main.swift` as its module's top-level code, and `@main` marks an entry type. SwiftPM names a
 * target after its directory under `Sources`, which tells executables apart better than a type name such as
 * `Client`; elsewhere the entry type, or the directory holding `main.swift`, names the entry.
 */
function entryName(root: string, file: FileEvidence): string | undefined {
  const parts = file.file.split('/')
  if (file.entryType === undefined && parts.at(-1) !== 'main.swift') return undefined
  const target = parts.lastIndexOf('Sources')
  if (target >= 0 && target < parts.length - 2) return parts[target + 1]
  return file.entryType ?? parts.at(-2) ?? path.basename(root)
}

function outline(file: FileEvidence, symbols: string[]): CodeFile {
  return { file: file.file, declarations: file.declarations.map((declaration): CodeDeclaration => ({
    ...declaration, entry: symbols.includes(declaration.name),
    ...(declaration.kind === 'type' ? { kind: 'type', members: declaration.members!.map(member => ({
      ...member, entry: symbols.includes(member.name) || symbols.includes(`${declaration.name}.${member.name}`),
    })) } : { kind: 'function' }),
  })) }
}

export default {
  id: 'swift',
  watch: { include: ['**/*.swift'], exclude: [] },
  listSourceFiles: root => files(root),
  async checkReadiness(root, _settings, excluded) {
    if (!(await files(root, excluded)).length) throw new Error('swift: No Swift source files were found in the Git repository.')
    await access(worker)
  },
  async scan(root, _settings, excluded) {
    const inventory = await files(root, excluded)
    if (!inventory.length) return undefined
    const evidence = await readEvidence(root, inventory)
    const engine = JSON.parse(await readFile(path.join(assets, `${process.platform}-${process.arch}`, 'engine.json'), 'utf8'))
    return createScanObservation({
      scanner: { id: 'swift', technology: 'swift', engine: 'SwiftParser/SwiftSyntax', engineVersion: engine.version },
      roots: [{ id: 'swift-source', kind: 'source-group', name: path.basename(root) }],
      files: evidence.map(file => ({ file: file.file, symbols: file.symbols, roots: ['swift-source'] })),
      entryPoints: evidence.flatMap(file => {
        const name = entryName(root, file)
        return name === undefined ? [] : [{ file: file.file, declaration: file.file, name, files: [file.file] }]
      }),
      operations: evidence.flatMap(file => file.operations),
      invocations: evidence.flatMap(file => file.invocations),
      diagnostics: [{ severity: 'info', code: 'SWIFT_SOURCE_SCOPE',
        message: 'Source syntax only. Imports, overloads, dynamic dispatch, macros, build conditions and cross-language calls remain unresolved.' }],
    })
  },
  async readCodeStructure(root: string, references: readonly SourceReference[]) {
    const selected = references.filter(reference => reference.file.endsWith('.swift'))
    if (!selected.length) return []
    const evidence = await readEvidence(root, selected.map(reference => reference.file))
    return evidence.map((file, index) => outline(file, selected[index]!.symbols)).filter(file => file.declarations.length)
  },
} satisfies ScannerPlugin
