import { cp, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import type { ScanObservation } from '@groma/scanner'

import { loadArchitecture } from '../src/architecture-reader.ts'
import { buildArchitectureModel } from '../src/architecture-model.ts'
import { reconcileScanObservations } from '../src/scan-reconciler.ts'
import { writeScannerConfig } from '../src/scanner/modules/config.ts'
import { loadScannerRegistry } from '../src/scanner/registry.ts'
import type { ArchitectureElement } from '../src/types.ts'

// Build packages with: bun scripts/scanner-release.ts stage <packages>
// Run with: bun scripts/reproduce-scanner-boundaries.ts <packages> <new-output-directory>
// The output is retained for inspecting the real scans. A reproduced defect exits with status 1.
const examples = {
  angular: ['angular/label.ts', 'angular/format.ts'],
  csharp: ['csharp/Render.cs', 'csharp/Format.cs'],
  go: ['go/render.go', 'go/format.go'],
  java: ['java/src/main/java/Render.java', 'java/src/main/java/Format.java'],
  javascript: ['javascript/render.js', 'javascript/format.js'],
  php: ['php/render.php', 'php/format.php'],
  python: ['python/render.py', 'python/format.py'],
  react: ['react/label.tsx', 'react/format.tsx'],
  rust: ['rust/src/lib.rs', 'rust/src/format.rs'],
  swift: ['swift/Render.swift', 'swift/Format.swift'],
  typescript: ['typescript/render.ts', 'typescript/format.ts'],
  vue: ['vue/Label.vue', 'vue/format.ts'],
}

async function applySources(root: string, suffix: '.fixture' | '.connected'): Promise<void> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'groma') continue
    const file = path.join(root, entry.name)
    if (entry.isDirectory()) await applySources(file, suffix)
    else if (entry.name.endsWith(suffix)) await rename(file, file.slice(0, -suffix.length))
  }
}

async function project(output: string, name: string, packages: string): Promise<string> {
  // Identical basenames keep repository-name evidence identical in both histories.
  const root = path.join(output, name, 'boundary-lab')
  await cp(path.resolve(import.meta.dir, '../test/fixtures/scanner-boundaries'), root, { recursive: true })
  await applySources(root, '.fixture')
  const git = Bun.spawn(['git', 'init', '--quiet', root], { stderr: 'pipe' })
  const [code, error] = await Promise.all([git.exited, new Response(git.stderr).text()])
  if (code !== 0) throw new Error(error)
  await writeScannerConfig(root, { scanners: Object.keys(examples).map(id => ({
    id, source: path.join(packages, id),
  })) })
  return root
}

async function save(output: string, name: string, value: unknown): Promise<void> {
  await writeFile(path.join(output, name), `${JSON.stringify(value, null, 2)}\n`)
}

async function scan(root: string, output: string, stage: string) {
  console.log(`Scanning ${stage} with all ${Object.keys(examples).length} scanners...`)
  const registry = await loadScannerRegistry(root)
  const batch = await registry.collectObservations(root)
  if (batch.failures.length) throw new Error(JSON.stringify(batch.failures, null, 2))
  const actual = batch.observations.map(observation => observation.scanner.id).sort()
  if (!isDeepStrictEqual(actual, Object.keys(examples))) {
    throw new Error(`Incomplete scanner coverage: ${actual.join(', ')}`)
  }
  const summary = await reconcileScanObservations(root, batch.observations)
  const model = buildArchitectureModel((await loadArchitecture(root)).documents)
  await save(output, `${stage}-observations.json`, batch.observations)
  await save(output, `${stage}-architecture.json`, model)
  await save(output, `${stage}-summary.json`, summary)
  return { observations: batch.observations, model }
}

function ownedFiles(elements: ArchitectureElement[]) {
  return new Map(elements.flatMap(element => element.code.map(reference => [reference.file, element] as const)))
}

function placement(elements: ArchitectureElement[], file: string): string[] {
  const byId = new Map(elements.map(element => [element.id, element]))
  const chain: string[] = []
  let element = ownedFiles(elements).get(file)
  while (element) {
    chain.push(`${element.kind}:${element.id}`)
    element = element.parentId === null ? undefined : byId.get(element.parentId)
  }
  return chain
}

function containers(elements: ArchitectureElement[], observation: ScanObservation): string[] {
  return [...new Set(observation.files.flatMap(file => placement(elements, file.file)
    .filter(ancestor => ancestor.startsWith('container:'))))].sort()
}

function rows(added: Awaited<ReturnType<typeof scan>>, connected: Awaited<ReturnType<typeof scan>>,
  fresh: Awaited<ReturnType<typeof scan>>) {
  return Object.entries(examples).map(([id, files]) => {
    const current = connected.observations.find(observation => observation.scanner.id === id)!
    const clean = fresh.observations.find(observation => observation.scanner.id === id)!
    for (const file of files) {
      if (![current, clean].every(observation => observation.files.some(source => source.file === file))) {
        throw new Error(`${id} did not observe its supported example source: ${file}`)
      }
    }
    return {
      scanner: id,
      filesBeforeUse: added.observations.find(observation => observation.scanner.id === id)!.files.length,
      filesAfterUse: current.files.length,
      stagedContainers: containers(connected.model.elements, current),
      freshContainers: containers(fresh.model.elements, clean),
      historyDependentFiles: current.files.filter(file => !isDeepStrictEqual(
        placement(connected.model.elements, file.file), placement(fresh.model.elements, file.file),
      )).map(file => file.file),
    }
  })
}

async function reproduce(packages: string, output: string): Promise<void> {
  await mkdir(output)
  const staged = await project(output, 'staged', packages)
  const added = await scan(staged, output, 'helper-added')
  await applySources(staged, '.connected')
  const connected = await scan(staged, output, 'helper-connected')
  const repeated = await scan(staged, output, 'repeated')
  const freshRoot = await project(output, 'fresh', packages)
  await applySources(freshRoot, '.connected')
  const fresh = await scan(freshRoot, output, 'fresh-completed')
  for (const file of new Set(fresh.observations.flatMap(observation => observation.files.map(file => file.file)))) {
    if (!isDeepStrictEqual(await readFile(path.join(staged, file)), await readFile(path.join(freshRoot, file)))) {
      throw new Error(`The two completed projects have different source: ${file}`)
    }
  }
  const languages = rows(added, connected, fresh)
  const unexpectedSystems = connected.model.elements.filter(element =>
    element.kind === 'system' && element.id !== 'boundary-lab').map(element => element.id)
  const stableOnRepetition = isDeepStrictEqual(connected.model, repeated.model)
  const reproduced = languages.filter(row => row.stagedContainers.length || row.freshContainers.length
    || row.historyDependentFiles.length)
  const versions = Object.fromEntries(await Promise.all(Object.keys(examples).map(async id =>
    [id, JSON.parse(await readFile(path.join(packages, id, 'package.json'), 'utf8')).version])))
  await save(output, 'report.json', { versions, stableOnRepetition, unexpectedSystems, languages })
  console.table(languages.map(row => ({
    scanner: row.scanner, observed: row.filesAfterUse,
    stagedContainers: row.stagedContainers.length, freshContainers: row.freshContainers.length,
    changedOwners: row.historyDependentFiles.length,
  })))
  console.log(`Unexpected systems: ${unexpectedSystems.length}; repeat scan stable: ${stableOnRepetition}`)
  console.log(`Full evidence and both repositories: ${output}`)
  if (reproduced.length || unexpectedSystems.length || !stableOnRepetition) {
    console.error(`Boundary failure reproduced for ${reproduced.length}/${languages.length} scanners.`)
    process.exitCode = 1
  }
}

const [packages, output] = process.argv.slice(2)
if (!packages || !output) {
  throw new Error('Usage: bun scripts/reproduce-scanner-boundaries.ts <packages> <new-output-directory>')
}
await reproduce(path.resolve(packages), path.resolve(output))
