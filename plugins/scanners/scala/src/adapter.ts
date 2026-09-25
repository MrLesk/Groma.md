import type { CodeFile, CodeSymbol, SourceReference } from '@groma/scanner'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { run } from './process.ts'

const worker = fileURLToPath(new URL('../dist/worker.jar', import.meta.url))

export function workerJar(): string {
  return worker
}

export async function checkWorkerReadiness(): Promise<void> {
  if (!existsSync(worker)) {
    throw new Error('SCALA_WORKER_MISSING: Install the packaged Scala scanner, or build it with bun plugins/scanners/scala/build.ts.')
  }
}

export async function scanWithWorker(root: string, files: readonly string[]): Promise<string> {
  await checkWorkerReadiness()
  const java = process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
    : 'java'
  return run(java, ['-jar', worker, 'scan', root], root, `${files.join('\n')}\n`)
}

export async function outlineWithWorker(root: string, files: readonly string[]): Promise<string> {
  await checkWorkerReadiness()
  const java = process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
    : 'java'
  return run(java, ['-jar', worker, 'outline', root], root, `${files.join('\n')}\n`)
}

type WorkerSymbol = Omit<CodeSymbol, 'entry'>
type WorkerOutline = { file: string; declarations: (WorkerSymbol & { kind: 'type'; members: WorkerSymbol[] })[] }

/** Outlines Scala files with the bundled scalameta worker. */
export async function readScalaOutline(repositoryRoot: string, references: readonly SourceReference[]): Promise<CodeFile[]> {
  const present = references.filter(reference => existsSync(path.join(repositoryRoot, reference.file)))
  if (present.length === 0) return []
  const stdout = await outlineWithWorker(repositoryRoot, present.map(reference => reference.file))
  const symbols = new Map(present.map(reference => [reference.file, reference.symbols]))
  return (JSON.parse(stdout) as WorkerOutline[]).filter(file => file.declarations.length > 0).map(({ file, declarations }) => {
    const named = symbols.get(file) ?? []
    return { file, declarations: declarations.map(type => ({
      ...type, entry: named.includes(type.name),
      members: type.members.map(member => ({ ...member, entry: named.includes(`${type.name}.${member.name}`) })),
    })) }
  })
}
