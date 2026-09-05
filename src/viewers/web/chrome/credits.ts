import { readFileSync } from 'node:fs'

import { escaped } from '../atoms/escape.ts'

interface ProjectManifest {
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

interface DependencyManifest {
  homepage?: string
  license?: string
  repository?: string | { url: string }
}

interface Credit {
  name: string
  version: string
  license: string
  url: string
}

const projectManifestUrl = new URL('../../../../package.json', import.meta.url)
const projectManifest = readJson<ProjectManifest>(projectManifestUrl)

function readJson<T>(url: URL): T {
  return JSON.parse(readFileSync(url, 'utf8')) as T
}

function packageUrl(name: string, file: string): URL {
  return new URL(`../../../../node_modules/${name}/${file}`, import.meta.url)
}

function licenseOf(name: string, manifest: DependencyManifest): string {
  if (manifest.license !== undefined) return manifest.license
  return readFileSync(packageUrl(name, 'LICENSE'), 'utf8').split(/\r?\n/, 1)[0]!
}

function repositoryUrl(repository: DependencyManifest['repository']): string {
  const raw = typeof repository === 'string' ? repository : repository?.url ?? ''
  return raw
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
}

function creditsFrom(dependencies: Record<string, string>): Credit[] {
  return Object.entries(dependencies)
    .filter(([, version]) => !version.startsWith('workspace:'))
    .map(([name, version]) => {
      const manifest = readJson<DependencyManifest>(packageUrl(name, 'package.json'))
      return {
        name,
        version,
        license: licenseOf(name, manifest),
        url: manifest.homepage ?? repositoryUrl(manifest.repository),
      }
    })
}

const thirdPartyCredits = {
  runtime: creditsFrom(projectManifest.dependencies),
  development: creditsFrom(projectManifest.devDependencies),
}

export const creditsCss = `
  #credits { position: relative; transform: translateY(-1px); --popover-width: 520px; }
  #credits > summary { width: 32px; padding: 0; list-style: none; }
  #credits > summary::-webkit-details-marker { display: none; }
  #credits .credits-menu { right: 0; padding: 0; }
  #credits h1 { margin: 0; padding: 14px 16px; border-bottom: 1px solid var(--hairline); font-size: 16px; }
  #credits .credits-repository { display: block; padding: 12px 16px; border-bottom: 1px solid var(--hairline); }
  #credits section { padding: 12px 16px 14px; }
  #credits section + section { border-top: 1px solid var(--hairline); }
  #credits h2 { margin: 0 0 6px; color: var(--muted); font-size: 10px; font-weight: 400; letter-spacing: 0.14em; text-transform: uppercase; }
  #credits ul { margin: 0; padding: 0; list-style: none; }
  #credits li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: baseline; padding: 6px 0; }
  #credits li + li { border-top: 1px solid color-mix(in srgb, var(--ink) 8%, transparent); }
  #credits a { min-width: 0; overflow: hidden; color: var(--ink); text-overflow: ellipsis; white-space: nowrap; }
  #credits a:hover { color: var(--highlight-text); }
  #credits code { color: var(--muted); font: inherit; white-space: nowrap; }
  #credits .credit-version::after { content: ' · '; }
`

function creditRow(credit: Credit): string {
  return `<li><a href="${escaped(credit.url)}" target="_blank" rel="noreferrer">${escaped(credit.name)}</a>`
    + `<code><span class="credit-version">${escaped(credit.version)}</span>${escaped(credit.license)}</code></li>`
}

function creditSection(title: string, credits: Credit[]): string {
  return `<section><h2>${title}</h2><ul>${credits.map(creditRow).join('')}</ul></section>`
}

/** The header control and its manifest-derived third-party credits. */
export function creditsControl(infoIcon: string): string {
  const runtime = creditSection('Runtime libraries', thirdPartyCredits.runtime)
  const development = creditSection('Development tools', thirdPartyCredits.development)
  return `<details id="credits"><summary class="chrome-button" aria-label="Credits">${infoIcon}</summary>`
    + '<div class="anchored-popover credits-menu" role="dialog" aria-label="Credits"><h1>Credits</h1>'
    + '<a class="credits-repository" href="https://github.com/MrLesk/Groma.md" target="_blank" rel="noreferrer">Groma repository</a>'
    + `${runtime}${development}</div></details>`
}
