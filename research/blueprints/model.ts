import type { CodeReference } from '../../src/types.ts'

/** Research-only data model. It is not the production Groma Markdown contract. */
export interface Role {
  key: string
  kind: 'component' | 'container' | 'external'
  title: string
  purpose: string
}
export interface Part { key: string; title: string; parentRole: string; overview: string }
export interface Intent { source: string; target: string; description: string }
export interface Blueprint {
  format: 1
  title: string
  release: string
  outcome: string
  requirements: string[]
  roles: Role[]
  parts: Part[]
  relationships: Intent[]
}
export interface Element {
  id: string
  kind: 'system' | 'container' | 'component'
  title: string
  parent: string | null
  overview: string
  status: 'stable' | 'draft'
  external: boolean
  code: CodeReference[]
  codeLines?: number
}
export interface Connection extends Intent {
  id: string
  technology: string
  origin: 'observed' | 'draft'
}
export interface Draft {
  id: string
  title: string
  outcome: string
  requirements: string[]
  bindings: Record<string, string>
  parts: Element[]
  relationships: Connection[]
  blueprint: Blueprint
}
export interface Project {
  id: string
  title: string
  elements: Element[]
  relationships: Connection[]
  drafts: Draft[]
}

export const PREFIX = 'groma-blueprint:1:'
export const MAX_BYTES = 64 * 1024

function record(value: unknown, keys: string[], label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  const obj = value as Record<string, unknown>
  if (Object.keys(obj).some(key => !keys.includes(key))) throw new Error(`${label} contains unsupported fields.`)
  if (keys.some(key => !Object.hasOwn(obj, key))) throw new Error(`${label} is missing a required field.`)
  return obj
}
function text(value: unknown, label: string, max = 2000): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label} must be non-empty text (at most ${max} characters).`)
}
function list(value: unknown, label: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > max) throw new Error(`${label} must contain 1–${max} entries.`)
  return value
}
function key(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(value)) throw new Error('Participant keys must be short lowercase kebab-case names.')
}
function checkRole(value: unknown): Role {
  const role = record(value, ['key', 'kind', 'title', 'purpose'], 'Role')
  key(role.key)
  if (!['component', 'container', 'external'].includes(String(role.kind))) throw new Error('Unsupported role kind.')
  text(role.title, 'Role title', 120)
  text(role.purpose, 'Role purpose')
  return role as unknown as Role
}
function checkPart(value: unknown): Part {
  const part = record(value, ['key', 'title', 'parentRole', 'overview'], 'New part')
  key(part.key); key(part.parentRole)
  text(part.title, 'Part title', 120); text(part.overview, 'Part overview', 8000)
  return part as unknown as Part
}
function checkIntent(value: unknown): Intent {
  const intent = record(value, ['source', 'target', 'description'], 'Planned relationship')
  key(intent.source); key(intent.target); text(intent.description, 'Relationship description')
  return intent as unknown as Intent
}
function validateGraph(blueprint: Blueprint): void {
  const participants = [...blueprint.roles, ...blueprint.parts]
  const keys = new Set(participants.map(item => item.key))
  if (keys.size !== participants.length) throw new Error('Participant keys must be unique.')
  for (const part of blueprint.parts) {
    if (!blueprint.roles.some(role => role.key === part.parentRole && role.kind === 'container')) {
      throw new Error(`New part ${part.title} needs an explicit container role.`)
    }
  }
  const pairs = new Set<string>()
  for (const intent of blueprint.relationships) {
    if (!keys.has(intent.source) || !keys.has(intent.target)) throw new Error('A planned relationship has an unknown participant.')
    if (intent.source === intent.target) throw new Error('A planned relationship needs different participants.')
    const pair = `${intent.source}\0${intent.target}`
    if (pairs.has(pair)) throw new Error('Duplicate planned relationship endpoints.')
    pairs.add(pair)
  }
}
export function validateBlueprint(value: unknown): Blueprint {
  const b = record(value, ['format', 'title', 'release', 'outcome', 'requirements', 'roles', 'parts', 'relationships'], 'Blueprint')
  if (b.format !== 1) throw new Error('Unsupported blueprint format. This experiment reads format 1 only.')
  text(b.title, 'Blueprint title', 120); text(b.release, 'Release', 64); text(b.outcome, 'Outcome', 8000)
  const requirements = list(b.requirements, 'Requirements', 20)
  for (const requirement of requirements) text(requirement, 'Requirement')
  const blueprint: Blueprint = {
    format: 1, title: b.title, release: b.release, outcome: b.outcome,
    requirements: requirements as string[],
    roles: list(b.roles, 'Roles', 16).map(checkRole),
    parts: list(b.parts, 'New parts', 24).map(checkPart),
    relationships: list(b.relationships, 'Relationships', 64).map(checkIntent),
  }
  validateGraph(blueprint)
  if (new TextEncoder().encode(JSON.stringify(blueprint)).length > MAX_BYTES) throw new Error('Blueprint exceeds the 64 KiB limit.')
  return structuredClone(blueprint)
}
export function encodeBlueprint(value: Blueprint): string {
  const bytes = new TextEncoder().encode(JSON.stringify(validateBlueprint(value)))
  return PREFIX + btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}
export function decodeBlueprint(value: string): Blueprint {
  const input = value.trim()
  if (!input.startsWith(PREFIX)) throw new Error('Paste a format-1 Groma blueprint, not a URL or repository file.')
  if (input.length > PREFIX.length + Math.ceil(MAX_BYTES / 3) * 4) throw new Error('Blueprint exceeds the 64 KiB limit.')
  const body = input.slice(PREFIX.length)
  if (!/^[A-Za-z0-9_-]+$/.test(body)) throw new Error('The blueprint text is damaged.')
  let decoded: unknown
  try {
    const binary = atob(body.replaceAll('-', '+').replaceAll('_', '/'))
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
    decoded = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch { throw new Error('The blueprint text is damaged.') }
  return validateBlueprint(decoded)
}

/** A readable OKF research export, not an importable production architecture bundle. */
export function inspectMarkdown(value: Blueprint): string {
  const b = validateBlueprint(value)
  const cell = (v: string): string => v.replaceAll('|', '\\|').replaceAll('\n', ' ')
  const rows = (items: string[][]): string => items.map(row => `| ${row.map(cell).join(' | ')} |`).join('\n')
  return `---\ntype: Groma Blueprint\ntitle: ${JSON.stringify(b.title)}\ngroma:\n  blueprint:\n    format: 1\n    release: ${JSON.stringify(b.release)}\n---\n\n${b.outcome}\n\n## Requirements\n\n${b.requirements.map(r => `- ${r}`).join('\n')}\n\n## Existing roles\n\n| Key | C4 kind | Role | Purpose |\n| --- | --- | --- | --- |\n${rows(b.roles.map(r => [r.key, r.kind, r.title, r.purpose]))}\n\n## New components\n\n| Key | Title | Parent role | Responsibility |\n| --- | --- | --- | --- |\n${rows(b.parts.map(p => [p.key, p.title, p.parentRole, p.overview]))}\n\n## Planned relationships\n\n| Source role | Target role | Interaction |\n| --- | --- | --- |\n${rows(b.relationships.map(r => [r.source, r.target, r.description]))}\n`
}
