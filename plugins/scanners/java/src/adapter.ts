import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseScanObservation, type CodeFile, type CodeSymbol, type ScanObservation, type SourceReference } from '@groma/scanner'
import { exists, readJavaInput } from './java-input.ts'
import { run } from './process.ts'

const worker = fileURLToPath(new URL('../dist/worker.jar', import.meta.url))
const runtime = fileURLToPath(new URL(`../dist/${process.platform}-${process.arch}/runtime/bin/java${process.platform === 'win32' ? '.exe' : ''}`, import.meta.url))

export interface JavaScanOptions {
  worker?: string
  timeout?: number
}

export async function checkJavaReadiness(repositoryRoot: string, options: JavaScanOptions = {}) {
  const jar = options.worker ?? worker
  if (!await exists(jar)) throw new Error('JAVA_WORKER_MISSING: Install the packaged Java scanner, or build it with bun plugins/scanners/java/build.ts.')
  const command = runtime
  try {
    const modules = await run(command, ['--list-modules'], repositoryRoot)
    if (!modules.includes('jdk.compiler@')) throw new Error('The selected runtime has no Java compiler module.')
  }
  catch (error) { throw new Error(`JAVA_RUNTIME_MISSING: Reinstall the Java scanner with its bundled compiler runtime. ${error}`) }
  const input = await readJavaInput(repositoryRoot)
  return { input, command, jar }
}

export async function scanJavaSource(repositoryRoot: string, options: JavaScanOptions = {}): Promise<ScanObservation | undefined> {
  const { input, command, jar } = await checkJavaReadiness(repositoryRoot, options)
  if (!input) return undefined
  let stdout: string
  try {
    stdout = await run(command, ['-Xmx1024m', '-jar', jar, input.root, input.release,
      input.encoding], input.root,
    `${input.files.join('\n')}\n`, options.timeout)
  } catch (error) {
    throw new Error(`JAVA_SOURCE_INVALID: No observation was produced. Check the declared Java language version and source syntax. ${error}`)
  }
  const observation = parseScanObservation(stdout)
  // The worker only compiles sources; the project's name, kind and build declaration come from its input.
  const [root] = observation.roots
  observation.roots[0] = { ...root!, name: input.name, kind: input.kind, ...(input.file ? { file: input.file } : {}) }
  return observation
}

type WorkerSymbol = Omit<CodeSymbol, 'entry'>
type WorkerOutline = { file: string; declarations: (WorkerSymbol & { kind: 'type'; members: WorkerSymbol[] })[] }

/** Outlines Java files with the bundled compiler's parser; parsing needs no classpath. */
export async function readJavaOutline(repositoryRoot: string, references: readonly SourceReference[]): Promise<CodeFile[]> {
  // A past revision may lack some of today's Code files.
  const present = references.filter(reference => existsSync(path.join(repositoryRoot, reference.file)))
  if (present.length === 0) return []
  const stdout = await run(runtime, ['-jar', worker, 'outline', repositoryRoot], repositoryRoot,
    `${present.map(reference => reference.file).join('\n')}\n`)
  const symbols = new Map(present.map(reference => [reference.file, reference.symbols]))
  // Code links name a type by its simple name and a member as `Type.member`; constructors share the type's name.
  return (JSON.parse(stdout) as WorkerOutline[]).filter(file => file.declarations.length > 0).map(({ file, declarations }) => {
    const named = symbols.get(file) ?? []
    return { file, declarations: declarations.map(type => ({
      ...type, entry: named.includes(type.name),
      members: type.members.map(member => ({ ...member, entry: named.includes(`${type.name}.${member.name}`) })),
    })) }
  })
}
