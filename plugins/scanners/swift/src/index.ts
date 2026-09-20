import { execFile } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createScanObservation, type CodeDeclaration, type CodeFile, type CodeVisibility, type ScannerPlugin,
  type ScanInvocation, type ScanOperation, type ScanSymbol, type SourceReference } from '@groma/scanner'
import { projectFiles } from '../../projects.ts'

interface FileEvidence {
  file: string
  symbols: ScanSymbol[]
  operations: ScanOperation[]
  invocations: ScanInvocation[]
  declarations: { kind: 'function' | 'type'; name: string; line: number; visibility: CodeVisibility;
    members?: { name: string; line: number; visibility: CodeVisibility }[] }[]
}

const assets = fileURLToPath(new URL('../dist/', import.meta.url))
const worker = path.join(assets, `${process.platform}-${process.arch}`, process.platform === 'win32' ? 'worker.exe' : 'worker')
const exclude = ['**/.build/**', '**/Pods/**', '**/Carthage/**']
const exclusions = exclude.map(pattern => new Bun.Glob(pattern))

async function files(root: string) {
  return projectFiles(root, file => file.endsWith('.swift') && path.posix.basename(file) !== 'Package.swift'
    && !exclusions.some(pattern => pattern.match(file)))
}

function readEvidence(root: string, files: string[]): Promise<FileEvidence[]> {
  return new Promise((resolve, reject) => {
    const child = execFile(worker, [], { cwd: root, maxBuffer: 128 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || error.message))
      else {
        try { resolve(JSON.parse(stdout)) } catch (error) { reject(error) }
      }
    })
    child.stdin!.on('error', () => { /* execFile reports worker exit. */ })
    child.stdin!.end(JSON.stringify({ root, files }))
  })
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
  watch: { include: ['**/*.swift'], exclude },
  listSourceFiles: files,
  async checkReadiness(root) {
    if (!(await files(root)).length) throw new Error('swift: No Swift source files were found in the Git repository.')
    await access(worker)
  },
  async scan(root) {
    const inventory = await files(root)
    if (!inventory.length) return undefined
    const evidence = await readEvidence(root, inventory)
    const engine = JSON.parse(await readFile(path.join(assets, `${process.platform}-${process.arch}`, 'engine.json'), 'utf8'))
    return createScanObservation({
      scanner: { id: 'swift', technology: 'swift', engine: 'SwiftParser/SwiftSyntax', engineVersion: engine.version },
      roots: [{ id: 'swift-source', kind: 'source-group', name: path.basename(root) }],
      files: evidence.map(file => ({ file: file.file, symbols: file.symbols, roots: ['swift-source'] })),
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
    return evidence.map((file, index) => outline(file, selected[index]!.symbols))
  },
} satisfies ScannerPlugin
