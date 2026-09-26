import type { CodeDeclaration, CodeFile, CodeSymbol, SourceReference } from '@groma/scanner'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { run } from './process.ts'

const worker = fileURLToPath(new URL('../dist/worker.jar', import.meta.url))
const gromaSbt = fileURLToPath(new URL('../dist/groma-sbt.jar', import.meta.url))
const sbtLaunch = fileURLToPath(new URL('../dist/sbt-launch.jar', import.meta.url))
const bundledRuntime = fileURLToPath(new URL(
  `../dist/${process.platform}-${process.arch}/runtime/bin/java${process.platform === 'win32' ? '.exe' : ''}`,
  import.meta.url,
))

export function workerJar(): string {
  return worker
}

export function gromaSbtJar(): string {
  return gromaSbt
}

export function sbtLaunchJar(): string {
  return sbtLaunch
}

export function javaCommand(): string {
  if (existsSync(bundledRuntime)) return bundledRuntime
  if (process.env.JAVA_HOME) {
    return path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
  }
  return 'java'
}

export async function checkScalaReadiness(): Promise<void> {
  if (!existsSync(worker)) {
    throw new Error('SCALA_WORKER_MISSING: Install the packaged Scala scanner, or build it with bun plugins/scanners/scala/build.ts.')
  }
  if (!existsSync(gromaSbt)) {
    throw new Error('SCALA_SBT_PLUGIN_MISSING: Install the packaged Scala scanner, or build it with bun plugins/scanners/scala/build.ts.')
  }
  if (!existsSync(sbtLaunch)) {
    throw new Error('SCALA_SBT_LAUNCHER_MISSING: Install the packaged Scala scanner, or build it with bun plugins/scanners/scala/build.ts.')
  }
  if (!existsSync(bundledRuntime)) {
    try {
      await run(javaCommand(), ['-version'], process.cwd())
    } catch (error) {
      throw new Error(`SCALA_RUNTIME_MISSING: Install the packaged Scala scanner runtime, or set JAVA_HOME. ${error}`)
    }
    return
  }
  try {
    await run(bundledRuntime, ['-version'], process.cwd())
  } catch (error) {
    throw new Error(`SCALA_RUNTIME_MISSING: Reinstall the Scala scanner with its bundled runtime. ${error}`)
  }
}

async function runWorker(mode: 'scan' | 'outline', root: string, files: readonly string[]): Promise<string> {
  await checkScalaReadiness()
  return run(javaCommand(), ['-jar', worker, mode, root], root, `${files.join('\n')}\n`)
}

export async function scanWithWorker(root: string, files: readonly string[]): Promise<string> {
  return runWorker('scan', root, files)
}

export async function outlineWithWorker(root: string, files: readonly string[]): Promise<string> {
  return runWorker('outline', root, files)
}

type WorkerSymbol = Omit<CodeSymbol, 'entry'>
type WorkerOutline = { file: string; declarations: (WorkerSymbol & { kind: string; members: WorkerSymbol[] })[] }

/** Outlines Scala files with the bundled scalameta worker. */
export async function readScalaOutline(repositoryRoot: string, references: readonly SourceReference[]): Promise<CodeFile[]> {
  const present = references.filter(reference => existsSync(path.join(repositoryRoot, reference.file)))
  if (present.length === 0) return []
  const stdout = await outlineWithWorker(repositoryRoot, present.map(reference => reference.file))
  const symbols = new Map(present.map(reference => [reference.file, reference.symbols]))
  return (JSON.parse(stdout) as WorkerOutline[]).filter(file => file.declarations.length > 0).map(({ file, declarations }) => {
    const named = symbols.get(file) ?? []
    return {
      file,
      declarations: declarations.map(declaration => {
        const entry = named.includes(declaration.name)
        if (declaration.kind === 'function') {
          return { name: declaration.name, line: declaration.line, visibility: declaration.visibility, kind: 'function' as const, entry } satisfies CodeDeclaration
        }
        return {
          name: declaration.name,
          line: declaration.line,
          visibility: declaration.visibility,
          kind: 'type' as const,
          entry,
          members: declaration.members.map(member => ({
            name: member.name,
            line: member.line,
            visibility: member.visibility,
            entry: named.includes(`${declaration.name}.${member.name}`),
          })),
        } satisfies CodeDeclaration
      }),
    }
  })
}
