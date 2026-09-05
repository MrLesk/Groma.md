import assert from 'node:assert/strict'

import { test } from 'bun:test'

import type { ArchitectureWorld, WorkItem } from '../src/types.ts'
import { noSelection, selectTask } from '../src/viewers/web/selection.ts'
import { readView, writeView } from '../src/viewers/web/url.ts'
import type { ViewState } from '../src/viewers/web/url.ts'
import { box, uses } from './helpers.ts'

const unit = { x: 0, y: 0, width: 1, height: 1 }
const revision = {
  id: 'a'.repeat(40),
  shortId: 'aaaaaaa',
  date: '2026-08-27T16:42:00+02:00',
  subject: 'Architecture',
  body: '',
}

const viewWorld = (): ArchitectureWorld => ({
  bounds: unit,
  groups: [],
  flows: [{ id: 'run', title: 'Run', overview: 'Run work.', sourceFilename: 'groma/flows/run.md', steps: [
    { relationshipId: 'relationship:0', source: 'observed:dev', target: 'observed:commands', action: 'Start' },
    { relationshipId: 'relationship:1', source: 'observed:commands', target: 'observed:scan', action: 'Inspect' },
  ] }],
  elements: [
    box('dev', 'actor', unit),
    box('tool', 'system', unit),
    box('cli', 'container', unit, { parent: 'observed:tool' }),
    box('commands', 'component', unit, { parent: 'observed:cli' }),
    box('scan', 'component', unit, {
      parent: 'observed:cli',
      code: [{ scanner: 'typescript', file: 'src/scan.ts' }],
    }),
    box('layer-modes', 'component', unit, {
      parent: 'observed:cli',
      code: [{ scanner: 'typescript', file: 'src/viewers/web/layers/orbit.ts' }],
    }),
  ],
  relationships: [uses('relationship:0', 'dev', 'commands'), uses('relationship:1', 'commands', 'scan')],
})

const fullView = (): ViewState => ({
  revision: revision.id,
  file: 'src/scan.ts',
  line: 42,
  selection: { kind: 'architecture', ids: ['observed:tool', 'relationship:1', 'observed:scan'] },
  flow: { id: 'run', step: 1 },
  tab: 'how',
  theme: 'dark',
  hudVisible: false,
})

test.concurrent('a complete view round-trips through the canonical query hierarchy', () => {
  const world = viewWorld()
  const full = fullView()
  const query = writeView(full, world, [])
  assert.equal(
    query,
    `?revision=${revision.id}&system=tool&relationship=commands/scan&component=scan&tab=how&file=src/scan.ts&line=42&flow=run&step=2&theme=dark&hud=off`,
  )
  assert.deepEqual(readView(query, world, [], [revision]), full)
})

test.concurrent('defaults write nothing and read back as the default view', () => {
  const world = viewWorld()
  const rest: ViewState = { selection: noSelection, tab: 'what', theme: 'auto', hudVisible: true }
  assert.equal(writeView(rest, world, []), '')
  assert.deepEqual(readView('', world, []), rest)
  assert.equal(writeView({ ...rest, flow: { id: 'run' } }, world, []), '?flow=run')
  assert.equal(writeView({ ...rest, selection: { kind: 'architecture', ids: ['observed:dev'] } }, world, []), '?actor=dev')
})

test.concurrent('a known Git revision is shareable while unknown revisions are ignored', () => {
  const world = viewWorld()
  const state: ViewState = {
    revision: revision.id,
    selection: noSelection,
    tab: 'what',
    theme: 'auto',
    hudVisible: true,
  }
  assert.equal(writeView(state, world, []), `?revision=${revision.id}`)
  assert.deepEqual(readView(`?revision=${revision.id}`, world, [], [revision]), state)
  assert.equal(readView('?revision=unknown', world, [], [revision]).revision, undefined)
})

test.concurrent('a component-owned source file restores and Back clears only the file drill-down', () => {
  const world = viewWorld()
  const source: ViewState = {
    selection: { kind: 'architecture', ids: ['observed:layer-modes'] },
    file: 'src/viewers/web/layers/orbit.ts',
    line: 34,
    tab: 'how',
    theme: 'auto',
    hudVisible: true,
  }
  assert.equal(
    writeView(source, world, []),
    '?component=layer-modes&tab=how&file=src/viewers/web/layers/orbit.ts&line=34',
  )
  assert.deepEqual(
    readView('?line=34&file=src/viewers/web/layers/orbit.ts&tab=how&component=layer-modes', world, []),
    source,
  )
  assert.equal(writeView({ ...source, file: undefined, line: undefined }, world, []), '?component=layer-modes&tab=how')
  assert.equal(readView('?component=layer-modes&file=src/viewers/web/layers/orbit.ts&line=0', world, []).line, undefined)
  assert.equal(readView('?component=layer-modes&file=src/other.ts', world, []).file, undefined)
  assert.equal(readView('?container=cli&file=src/scan.ts', world, []).file, undefined)
})

test.concurrent('the component Tasks tab is shareable through the existing tab state', () => {
  const world = viewWorld()
  const state: ViewState = {
    selection: { kind: 'architecture', ids: ['observed:scan'] },
    tab: 'tasks',
    theme: 'auto',
    hudVisible: true,
  }
  assert.equal(writeView(state, world, []), '?component=scan&tab=tasks')
  assert.deepEqual(readView('?component=scan&tab=tasks', world, []), state)
})

test.concurrent('a selected relationship is carried as its source and target ids', () => {
  const world = viewWorld()
  const state: ViewState = { selection: { kind: 'architecture', ids: ['relationship:1'] }, tab: 'what', theme: 'auto', hudVisible: true }
  assert.equal(writeView(state, world, []), '?relationship=commands/scan')
  assert.deepEqual(readView('?relationship=commands/scan', world, []), state)
  assert.deepEqual(readView('?relationship=dev/scan', world, []).selection, noSelection)
})

test.concurrent('a selected task is carried by its id while the work knows it', () => {
  const world = viewWorld()
  const work: WorkItem[] = [{
    id: 'TASK-7', title: 'Change', status: 'In Progress', assignees: [], references: [], modifiedFiles: [],
    acceptanceCriteriaCompleted: 0, acceptanceCriteriaCount: 0, updatedAt: '2026-08-30T12:00:00Z',
  }]
  const state: ViewState = { selection: selectTask('TASK-7'), tab: 'what', theme: 'auto', hudVisible: true }
  assert.equal(writeView(state, world, work), '?task=TASK-7')
  assert.equal(writeView({ ...state, tab: 'tasks' }, world, work), '?task=TASK-7')
  assert.deepEqual(readView('?task=TASK-7', world, work), state)
  assert.deepEqual(readView('?task=TASK-7', world, []).selection, noSelection)
})

test.concurrent('unknown ids, kinds and values are ignored', () => {
  const world = viewWorld()
  assert.deepEqual(readView('?person=dev', world, []).selection, noSelection)
  assert.deepEqual(readView('?actor=scan', world, []).selection, noSelection)
  assert.deepEqual(readView('?component=nope&flow=dev/scan&by=zed&tab=weird&theme=other', world, []), {
    selection: noSelection,
    tab: 'what',
    theme: 'auto',
    hudVisible: true,
  })
})

test.concurrent('explicit themes are shareable while an absent theme uses the supplied preference', () => {
  const world = viewWorld()
  const state: ViewState = { selection: noSelection, tab: 'what', theme: 'blueprint', hudVisible: true }
  assert.equal(writeView(state, world, []), '?theme=blueprint')
  assert.deepEqual(readView('?theme=blueprint', world, []), state)
  assert.equal(writeView({ ...state, theme: 'light' }, world, []), '?theme=light')
  assert.equal(readView('?theme=light', world, []).theme, 'light')
  assert.equal(readView('', world, [], [], 'dark').theme, 'dark')
  assert.equal(readView('?theme=other', world, [], [], 'dark').theme, 'dark')
})

test.concurrent('map-only mode is shareable while the HUD remains the default', () => {
  const world = viewWorld()
  const state: ViewState = { selection: noSelection, tab: 'what', theme: 'auto', hudVisible: false }
  assert.equal(writeView(state, world, []), '?hud=off')
  assert.deepEqual(readView('?hud=off', world, []), state)
  assert.equal(readView('?hud=anything-else', world, []).hudVisible, true)
})

test.concurrent('an authored flow link opens its reader and restores the ordered step', () => {
  const world = viewWorld()
  const state = readView('?flow=run&step=2', world, [])
  assert.deepEqual(state.flow, { id: 'run', step: 1 })
  assert.deepEqual(state.selection, { kind: 'flow', id: 'run' })
  assert.equal(writeView(state, world, []), '?flow=run&step=2')
  assert.deepEqual(readView('?flow=run&step=3', world, []).flow, { id: 'run' })
  const inspected = readView('?flow=run&step=2&component=scan', world, [])
  assert.deepEqual(inspected.selection, { kind: 'architecture', ids: ['observed:scan'] })
  assert.deepEqual(inspected.flow, state.flow)
})

test.concurrent('repeated architecture parameters restore one ordered selection and ignore unknown entries', () => {
  const world = viewWorld()
  const state = readView(
    '?component=commands&relationship=dev/commands&system=nope&actor=dev&component=commands',
    world,
    [],
  )

  assert.deepEqual(state.selection, {
    kind: 'architecture',
    ids: ['observed:commands', 'relationship:0', 'observed:dev'],
  })
})
