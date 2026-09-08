import { describe, expect, test } from 'bun:test'
import blueprintFixture from '../test/fixtures/blueprint-research/saved-card.json'
import projectFixtures from '../test/fixtures/blueprint-research/projects.json'
import { decodeBlueprint, encodeBlueprint, inspectMarkdown, validateBlueprint, PREFIX, MAX_BYTES } from '../research/blueprints/model.ts'
import type { Project, Blueprint } from '../research/blueprints/model.ts'
import { bindingIssues, candidates, commitPlacement, copyDraftIntent, preparePlacement, suggestions } from '../research/blueprints/placement.ts'
import { graphFor } from '../research/blueprints/view.ts'

const blueprint = (): Blueprint => validateBlueprint(structuredClone(blueprintFixture))
const project = (index = 0): Project => structuredClone(projectFixtures[index]) as Project
const binds = (p: Project): Record<string, string> => ({ checkout: `${p.id}-checkout`, host: `${p.id}-api`, provider: `${p.id}-provider` })
function memory() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}
function imported(p = project()) {
  const storage = memory()
  const draft = preparePlacement(p, blueprint(), binds(p))
  return { p, storage, draft, next: commitPlacement(storage, 'fixture', p, { draft, baseline: null }) }
}

describe('inert portable blueprint text', () => {
  test.concurrent('Unicode survives clipboard round-trip', () => {
    const b = blueprint(); b.outcome += ' Café — 返品 — 🧩'
    expect(decodeBlueprint(encodeBlueprint(b))).toEqual(b)
  })
  test.concurrent('import rejects URLs and unsupported transport versions', () => {
    expect(() => decodeBlueprint('https://example.invalid/blueprint')).toThrow('format-1')
    expect(() => decodeBlueprint('groma-blueprint:2:AAAA')).toThrow('format-1')
  })
  test.concurrent('damaged clipboard text fails closed', () => {
    expect(() => decodeBlueprint(`${PREFIX}%%%`)).toThrow('damaged')
    expect(() => decodeBlueprint(PREFIX + btoa('{'))).toThrow('damaged')
  })
  test.concurrent('future content versions are rejected without migration', () => {
    expect(() => validateBlueprint({ ...blueprint(), format: 2 })).toThrow('Unsupported blueprint format')
  })
  test.concurrent('source evidence and executable fields cannot be imported', () => {
    expect(() => validateBlueprint({ ...blueprint(), code: ['secret.ts'] })).toThrow('unsupported fields')
    expect(() => validateBlueprint({ ...blueprint(), script: 'run()' })).toThrow('unsupported fields')
  })
  test.concurrent('unknown nested fields cannot smuggle local evidence', () => {
    const b = blueprint()
    Object.assign(b.parts[0]!, { sourceFilename: '../private.ts' })
    expect(() => validateBlueprint(b)).toThrow('unsupported fields')
  })
  test.concurrent('all local participant keys are unique', () => {
    const b = blueprint(); b.parts[0]!.key = b.roles[0]!.key
    expect(() => validateBlueprint(b)).toThrow('unique')
  })
  test.concurrent('new parts require declared parent roles', () => {
    const b = blueprint(); b.parts[0]!.parentRole = 'absent'
    expect(() => validateBlueprint(b)).toThrow('explicit container role')
  })
  test.concurrent('a component cannot be used as the parent role', () => {
    const b = blueprint(); b.parts[0]!.parentRole = 'checkout'
    expect(() => validateBlueprint(b)).toThrow('explicit container role')
  })
  test.concurrent('relationships cannot refer outside the pattern', () => {
    const b = blueprint(); b.relationships[0]!.target = 'unknown'
    expect(() => validateBlueprint(b)).toThrow('unknown participant')
  })
  test.concurrent('self and duplicate relationships are rejected', () => {
    const b = blueprint(); b.relationships[0]!.target = b.relationships[0]!.source
    expect(() => validateBlueprint(b)).toThrow('different participants')
    const duplicate = blueprint(); duplicate.relationships.push({ ...duplicate.relationships[0]! })
    expect(() => validateBlueprint(duplicate)).toThrow('Duplicate')
  })
  test.concurrent('empty outcome and oversized clipboard are rejected', () => {
    expect(() => validateBlueprint({ ...blueprint(), outcome: ' ' })).toThrow('non-empty')
    expect(() => decodeBlueprint(PREFIX + 'a'.repeat(MAX_BYTES * 2))).toThrow('64 KiB')
  })
  test.concurrent('readable export includes roles and relationships but not receiving-project IDs', () => {
    const { draft } = imported(project(1))
    const inspected = inspectMarkdown(copyDraftIntent(draft))
    expect(inspected).toContain('type: Groma Blueprint')
    for (const value of Object.values(draft.bindings)) expect(inspected).not.toContain(value)
    for (const part of draft.parts) expect(inspected).not.toContain(part.id)
  })
})

describe('semantic placement', () => {
  test.concurrent('a different project does not get a guessed component binding', () => {
    const p = project(1); const proposed = suggestions(p, blueprint())
    expect(proposed.checkout).toBeUndefined()
    expect(proposed.host).toBe(`${p.id}-api`)
    expect(proposed.provider).toBe(`${p.id}-provider`)
  })
  test.concurrent('same-name ambiguity remains unresolved', () => {
    const p = project(); p.elements.push({ ...p.elements[2]!, id: 'other-checkout' })
    expect(suggestions(p, blueprint()).checkout).toBeUndefined()
  })
  test.concurrent('wrong kinds, missing roles and unknown binding keys fail', () => {
    const p = project()
    expect(() => preparePlacement(p, blueprint(), { ...binds(p), checkout: p.id })).toThrow('compatible')
    expect(bindingIssues(p, blueprint(), {})).toHaveLength(3)
    expect(() => preparePlacement(p, blueprint(), { ...binds(p), extra: 'anything' })).toThrow('unknown binding')
  })
  test.concurrent('draft elements are not candidates for existing roles', () => {
    const p = project(); p.elements[2]!.status = 'draft'
    expect(candidates(p, blueprint().roles[0]!)).not.toContainEqual(p.elements[2])
  })
  test.concurrent('distinct roles cannot collapse into one current element', () => {
    const p = project(); const b = blueprint()
    b.roles.push({ key: 'another', kind: 'component', title: 'Another', purpose: 'Distinct responsibility' })
    expect(() => preparePlacement(p, b, { ...binds(p), another: `${p.id}-checkout` })).toThrow('distinct elements')
  })
  test.concurrent('preview does not mutate either source and uses the bound parent', () => {
    const p = project(); const b = blueprint(); const before = JSON.stringify({ p, b })
    const preview = preparePlacement(p, b, binds(p))
    expect(JSON.stringify({ p, b })).toBe(before)
    expect(preview.parts[0]!.parent).toBe(binds(p).host)
    expect(preview.parts.every(part => part.status === 'draft' && part.code.length === 0)).toBe(true)
  })
  test.concurrent('local identities and relationships are fully remapped', () => {
    const p = project(1); const d = preparePlacement(p, blueprint(), binds(p))
    const allowed = new Set([...Object.values(binds(p)), ...d.parts.map(part => part.id)])
    for (const r of d.relationships) {
      expect(allowed.has(r.source)).toBe(true); expect(allowed.has(r.target)).toBe(true)
      expect(r.origin).toBe('draft')
    }
    expect(d.parts[0]!.id).not.toBe(blueprint().parts[0]!.key)
  })
  test.concurrent('existing ID collisions do not overwrite an element', () => {
    const p = project(); p.elements.push({ ...p.elements[2]!, id: 'saved-card-checkout' })
    expect(preparePlacement(p, blueprint(), binds(p)).id).toBe('saved-card-checkout-2')
  })
  test.concurrent('create preserves every current record and evidence byte', () => {
    const { p, next } = imported()
    expect(JSON.stringify(next.elements)).toBe(JSON.stringify(p.elements))
    expect(JSON.stringify(next.relationships)).toBe(JSON.stringify(p.relationships))
    expect(p.drafts).toHaveLength(0); expect(next.drafts).toHaveLength(1)
  })
  test.concurrent('repeated paste creates independent drafts that can overlap', () => {
    const { next, storage, draft } = imported()
    const second = preparePlacement(next, blueprint(), binds(next))
    const twice = commitPlacement(storage, 'fixture', next, { draft: second, baseline: storage.getItem('fixture') })
    expect(second.id).not.toBe(draft.id)
    expect(second.parts[0]!.id).not.toBe(draft.parts[0]!.id)
    expect(twice.drafts.map(d => d.bindings.checkout)).toEqual([binds(next).checkout, binds(next).checkout])
    expect(twice.drafts[0]).toEqual(draft)
  })
  test.concurrent('saved draft is independent of later changes to a library object', () => {
    const b = blueprint(); const p = project(); const d = preparePlacement(p, b, binds(p))
    b.outcome = 'Another outcome'; b.parts[0]!.title = 'Different part'
    expect(d.outcome).not.toBe(b.outcome); expect(d.parts[0]!.title).not.toBe(b.parts[0]!.title)
  })
  test.concurrent('copying retained intent never copies receiving evidence', () => {
    const { draft } = imported(project(1))
    expect(encodeBlueprint(copyDraftIntent(draft))).toBe(encodeBlueprint(blueprint()))
    const text = JSON.stringify(copyDraftIntent(draft))
    expect(text).not.toContain('src/market'); expect(text).not.toContain('market-checkout')
  })
  test.concurrent('storage refusal cannot publish a partial draft', () => {
    const p = project(); const before = JSON.stringify(p)
    const draft = preparePlacement(p, blueprint(), binds(p))
    const storage = { getItem: () => null, setItem: () => { throw new Error('Quota exceeded') } }
    expect(() => commitPlacement(storage, 'fixture', p, { draft, baseline: null })).toThrow('Quota')
    expect(JSON.stringify(p)).toBe(before)
  })
  test.concurrent('a sequentially stale preview cannot overwrite another saved draft', () => {
    const { p, storage, draft, next } = imported()
    expect(() => commitPlacement(storage, 'fixture', p, { draft, baseline: null })).toThrow('another tab')
    expect(JSON.parse(storage.getItem('fixture')!)).toEqual(next)
  })
  test.concurrent('tampered previews require another review', () => {
    const p = project(); const draft = preparePlacement(p, blueprint(), binds(p))
    draft.parts[0]!.title = 'Changed after preview'
    expect(() => commitPlacement(memory(), 'fixture', p, { draft, baseline: null })).toThrow('Review it again')
  })
  test.concurrent('projection includes design intent without mutating current graph or draft', () => {
    const { p, draft } = imported(); const before = JSON.stringify({ p, draft })
    const visible = graphFor(p, draft)
    expect(visible.elements.filter(element => element.origin === 'draft')).toHaveLength(draft.parts.length)
    expect(visible.relationships.filter(relation => relation.origin === 'draft')).toHaveLength(draft.relationships.length)
    expect(JSON.stringify({ p, draft })).toBe(before)
  })
})
