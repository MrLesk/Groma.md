import { execFile } from 'node:child_process'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import upstreamLicenses from './upstream-licenses.json'

const execute = promisify(execFile)

interface CargoPackage {
  name: string
  version: string
  license: string | null
  manifest_path: string
  repository: string | null
}

// This runs only while building the scanner itself, never while scanning a target repository.
export async function writeNotices(manifest: string, output: string): Promise<void> {
  const { stdout } = await execute('cargo', ['metadata', '--locked', '--format-version', '1', '--manifest-path', manifest])
  const metadata = JSON.parse(stdout) as { packages: CargoPackage[] }
  const sections = ['# Rust scanner third-party notices\n\nDependency versions come from the scanner Cargo.lock.\n']
  const packages = metadata.packages.filter(item => item.name !== 'groma-rust-scanner')
    .sort((left, right) => `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`))
  for (const item of packages) {
    const root = path.dirname(item.manifest_path)
    const names = (await readdir(root)).filter(name => /^(?:LICEN[SC]E|COPYRIGHT|COPYING|NOTICE)(?:[-.]|$)/i.test(name)).sort()
    sections.push(`\n## ${item.name} ${item.version}\n\nDeclared license: ${item.license ?? 'unspecified'}\n`)
    if (!names.length) sections.push(upstreamNotice(item))
    for (const name of names) sections.push(`\n### ${name}\n\n${await readFile(path.join(root, name), 'utf8')}\n`)
  }
  await writeFile(path.join(output, 'THIRD_PARTY_NOTICES.md'), sections.join(''))
}

function upstreamNotice(item: CargoPackage): string {
  const repository = item.repository?.split('/').at(4)
  const license = repository && upstreamLicenses[repository as keyof typeof upstreamLicenses]
  if (!license) throw new Error(`Review missing license texts for ${item.name}@${item.version}`)
  return `\nMIT license text from ${license.source}\n\n${license.text}\n`
}
