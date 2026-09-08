import type { CliRenderer, KeyEvent } from '@opentui/core'

import { isEmptyWorld } from '../../empty-world.ts'
import { createArchitectureSearch } from '../../search.ts'
import { litLegs, projectFlowStep } from './flow.ts'
import { panesForWidth, terminalLayout } from './layout.ts'
import {
  clickTreeRow,
  defaultSelection,
  initialState,
  litAction,
  reduceViewer,
  selectMapItem,
} from './navigation.ts'
import type { ViewerAction, ViewerState } from './navigation.ts'
import { MAP_KEYS } from './keys.ts'
import { TerminalGraphics } from './graphics.ts'
import type { GraphicsProtocol } from './graphics.ts'
import { reduceSearch } from './navigation-search.ts'
import type { SearchInput } from './navigation-search.ts'
import { viewerTheme } from './atoms/theme.ts'
import { paintMap } from './paint.ts'
import { mountScreen } from './panes/screen.ts'
import { screenView } from './panes/view.ts'
import { itemAt, mapAnchors, projectWorld } from './projection.ts'
import type { TerminalProjection } from './projection.ts'
import type { TerminalCamera } from './projection-camera.ts'
import type { TerminalViewModel } from './model.ts'
import { reconcileWorkFocus, selectedWorkId, workView } from './work/model.ts'
import type { TerminalLevel, WorkItemDetails } from '../../types.ts'
import type { TaskDiffPayload } from '../source/diff.ts'
import type { CodeFile } from '../source/structure.ts'
import { clickHistoryRevision } from './navigation-history.ts'

const FLOW_ANIMATION_MS = 120
const FLOW_ANIMATION_PHASES = 3
const PAN_FRAMES = 4
const PAN_MS = 30

interface ViewerOptions {
  graphics?: GraphicsProtocol
  level?: TerminalLevel
  currentId?: string
  onRefresh?: () => void | Promise<void>
  /** The full record of one task, read when the details pane opens it. */
  readTask?: (id: string) => Promise<WorkItemDetails>
  /** The declarations of a component's TypeScript files, read when its How tab shows. */
  readStructure?: (elementId: string) => Promise<CodeFile[] | undefined>
  /** A component's source file, read when a declaration opens it. */
  readSource?: (elementId: string, file: string) => Promise<{ source: string } | undefined>
  /** One task's file facts and diffs, shared by its record and file reader. */
  readTaskDiff?: (taskId: string) => Promise<TaskDiffPayload | undefined>
  /** The live working tree or one compatible historical model, read when revision state changes. */
  readRevision?: (revisionId?: string) => Promise<TerminalViewModel | undefined>
}

export interface TerminalViewer {
  closed: Promise<void>
  destroy(): void
  refresh(): Promise<void>
  update(next: TerminalViewModel): void
  setView(next: {
    level?: TerminalLevel
    currentId?: string
    camera?: TerminalCamera
  }): void
}

/** The projection drawn behind its final camera position for the frames of a pan. */
function shifted(projection: TerminalProjection, offset: TerminalCamera): TerminalProjection {
  if (offset.x === 0 && offset.y === 0) return projection
  return {
    ...projection,
    items: projection.items.map(item => ({
      ...item,
      cellBounds: {
        ...item.cellBounds,
        x: item.cellBounds.x + offset.x,
        y: item.cellBounds.y + offset.y,
      },
    })),
    relationships: projection.relationships.map(route => ({
      ...route,
      cellRoute: route.cellRoute.map(point => ({
        x: point.x + offset.x,
        y: point.y + offset.y,
      })),
    })),
  }
}

export function mountTerminalViewer(
  renderer: CliRenderer,
  response: TerminalViewModel,
  options: ViewerOptions = {},
): TerminalViewer {
  let viewModel = response
  let architectureSearch = createArchitectureSearch(response.elements)
  let state: ViewerState = {
    ...initialState(response),
    panes: panesForWidth(renderer.width),
    terminalWidth: renderer.width,
    ...(options.level === undefined ? {} : { level: options.level }),
    ...(options.currentId === undefined ? {} : { currentId: options.currentId }),
  }
  let closed = false
  let resolveClosed!: () => void
  const closedPromise = new Promise<void>(resolve => {
    resolveClosed = resolve
  })
  const theme = viewerTheme()
  let camera: TerminalCamera | undefined
  let animationPhase = 0
  let animationTimer: ReturnType<typeof setInterval> | undefined
  // Map clicks resolve against the projection last painted.
  let lastProjection: TerminalProjection | undefined
  // A selection change at the same level slides the map from the camera it had to the one it gets.
  let slide: { distance: TerminalCamera; left: number } | undefined
  let slideTimer: ReturnType<typeof setTimeout> | undefined
  let loadingRevision: string | null | false = false
  let graphics: TerminalGraphics | undefined
  const screen = mountScreen(renderer, theme, {
    onMapResize: () => repaint(),
    onHierarchyRow(id) {
      transition(state.history === undefined
        ? clickTreeRow(viewModel, state, id)
        : clickHistoryRevision(viewModel, state, id))
    },
    onMapCell(x, y) {
      const id = lastProjection === undefined ? undefined : itemAt(lastProjection.items, x, y)?.representationId
      // Only what the arrows can reach at this level is selectable.
      if (id !== undefined && mapAnchors(viewModel, state.level, state.currentId, state.mapWidth).has(id)) {
        transition(selectMapItem(viewModel, state, id))
      }
    },
  })

  graphics = new TerminalGraphics(renderer, screen.map, options.graphics ?? 'auto', {
    changed: () => repaint(),
    select: id => transition(selectMapItem(viewModel, state, id)),
    focus: () => { if (state.focus !== 'architecture') transition({ ...state, focus: 'architecture' }) },
  })

  function applyScreen(projection: TerminalProjection, lit: ReturnType<typeof litAction>, step: ReturnType<typeof projectFlowStep>): void {
    const view = screenView(theme, viewModel, state, projection, lit, step)
    screen.apply({ ...view, mapTitle: graphics?.caption,
      footer: graphics?.active ? `[+/-] Zoom  [0] Fit  [v] Iso/2D  [g] Text  ${view.footer}` : view.footer })
  }

  function snapshot(): TerminalCamera | undefined {
    return camera === undefined ? undefined : { ...camera }
  }

  function project(next?: TerminalCamera) {
    const lit = litAction(viewModel, state)
    const taskView = workView(viewModel, state.work)
    const flowAttention = state.actionStep === undefined
      ? undefined
      : litLegs(viewModel, lit)[state.actionStep]?.target
    return projectWorld(viewModel, {
      viewport: screen.mapViewport(),
      level: taskView?.level ?? state.level,
      currentId: taskView?.currentId ?? state.currentId,
      attentionIds: taskView?.attentionIds ?? (flowAttention === undefined ? [] : [flowAttention]),
      camera: next ?? snapshot(),
    })
  }

  function syncAnimation(active: boolean): void {
    if (!active) {
      if (animationTimer !== undefined) clearInterval(animationTimer)
      animationTimer = undefined
      animationPhase = 0
      return
    }
    if (animationTimer !== undefined) return
    animationTimer = setInterval(() => {
      animationPhase = (animationPhase + 1) % FLOW_ANIMATION_PHASES
      repaint()
    }, FLOW_ANIMATION_MS)
  }

  function updateGraphics(lit: ReturnType<typeof litAction>): void {
    const legs = litLegs(viewModel, lit)
    const selected = state.actionStep === undefined ? legs : legs.slice(state.actionStep, state.actionStep + 1)
    graphics?.update(viewModel, state, new Set(selected.map(leg => leg.id)))
    syncAnimation(lit.id !== undefined && !graphics?.active)
  }

  function repaint(panFrom?: TerminalCamera): void {
    if (closed || screen.map.isDestroyed) return
    state = { ...state, terminalWidth: renderer.width }
    if (!terminalLayout(state).map && lastProjection !== undefined) {
      applyScreen(lastProjection, litAction(viewModel, state), undefined)
      return
    }
    const mapWidth = screen.mapViewport().width
    if (state.mapWidth !== mapWidth) state = { ...state, mapWidth }
    const projection = project()
    const lit = litAction(viewModel, state)
    camera = projection.camera
    if (state.work === undefined) {
      state = { ...state, currentId: projection.currentId ?? undefined }
    }
    const step = projectFlowStep(viewModel, projection, lit.id, state.actionStep)
    updateGraphics(lit)
    const painted = graphics?.active ? projection : shifted(projection, slideShift(projection.camera, panFrom))
    paintMap(screen.map.frameBuffer, painted, viewModel, theme, {
      lit,
      step,
      workFocus: state.work,
      workList: state.workList,
      animationPhase,
    })
    lastProjection = projection
    applyScreen(projection, lit, step)
    screen.map.requestRender()
    if (!graphics?.active) slideOn()
  }

  /** The cells the map still lags behind its new camera; a fresh pan starts from the camera it left. */
  function slideShift(next: TerminalCamera, panFrom: TerminalCamera | undefined): TerminalCamera {
    if (panFrom !== undefined && (panFrom.x !== next.x || panFrom.y !== next.y)) {
      slide = {
        distance: { x: next.x - panFrom.x, y: next.y - panFrom.y },
        left: PAN_FRAMES,
      }
    }
    return slide === undefined
      ? { x: 0, y: 0 }
      : {
        x: Math.round(slide.distance.x * slide.left / PAN_FRAMES),
        y: Math.round(slide.distance.y * slide.left / PAN_FRAMES),
      }
  }

  function slideOn(): void {
    if (slide === undefined) return
    slide = slide.left > 1 ? { ...slide, left: slide.left - 1 } : undefined
    clearTimeout(slideTimer)
    slideTimer = setTimeout(() => repaint(), PAN_MS)
  }

  function release(): void {
    graphics?.destroy()
    clearTimeout(slideTimer)
    syncAnimation(false)
    renderer.keyInput.off('keypress', onKeypress)
    renderer.off('destroy', onRendererDestroy)
    resolveClosed()
  }

  function onRendererDestroy(): void {
    if (closed) return
    closed = true
    release()
  }

  function destroy(): void {
    if (closed) return
    closed = true
    release()
    renderer.destroy()
  }

  function refresh(): Promise<void> {
    if (closed) return Promise.resolve()
    return Promise.resolve(options.onRefresh?.())
  }

  function update(next: TerminalViewModel): void {
    if (closed) return
    const previousView = workView(viewModel, state.work)
    const revisionChanged = next.revision?.id !== viewModel.revision?.id
    viewModel = next
    architectureSearch = createArchitectureSearch(next.elements)
    const work = next.revision === undefined ? reconcileWorkFocus(next.work, state.work) : undefined
    const currentId = next.elements.some(element => element.representationId === state.currentId)
      ? state.currentId
      : defaultSelection(next, state.level)?.representationId
    state = {
      ...state,
      currentId,
      work,
      revisionId: next.revision?.id,
      ...(revisionChanged ? {
        taskRecord: undefined,
        sourceView: undefined,
        diffView: undefined,
        codeStructure: undefined,
      } : {}),
    }
    if (revisionChanged || JSON.stringify(workView(next, work)) !== JSON.stringify(previousView)) camera = undefined
    repaint()
  }

  function actionFor(key: KeyEvent): ViewerAction | undefined {
    return MAP_KEYS.find(entry => entry.name === key.name && Boolean(entry.ctrl) === key.ctrl)?.action
  }

  let searchReturnCamera: TerminalCamera | undefined
  let workReturnCamera: TerminalCamera | undefined

  function searchInputFor(key: KeyEvent): SearchInput | undefined {
    if (key.name === 'return') return { type: 'accept' }
    if (key.name === 'backspace') return { type: 'delete' }
    if (key.name === 'down') return { type: 'next' }
    if (key.name === 'up') return { type: 'previous' }
    if (key.name === 'space') return { type: 'char', char: ' ' }
    if (key.name?.length === 1 && !key.ctrl) return { type: 'char', char: key.name }
    return undefined
  }

  /** What a state change means for the camera: a new scope or task starts afresh, leaving Work restores, a same-level selection change slides. */
  function changeOf(next: ViewerState): { restores: boolean; afresh: boolean; slides: boolean; enteringWork: boolean } {
    const changedScope = next.level !== state.level
    const enteringWork = state.work === undefined && next.work !== undefined
    const leavingWork = state.work !== undefined && next.work === undefined
    const changedTask = selectedWorkId(next.work) !== selectedWorkId(state.work)
    return {
      enteringWork,
      restores: leavingWork,
      afresh: enteringWork || changedTask || changedScope,
      slides: !changedScope && !enteringWork && !leavingWork && next.currentId !== state.currentId,
    }
  }

  // The camera follows any selection change through one framing rule.
  function transition(next: ViewerState): void {
    const change = changeOf(next)
    if (change.enteringWork) workReturnCamera = snapshot()
    const panFrom = change.slides ? snapshot() : undefined
    state = next
    loadPending()
    if (change.restores) {
      camera = workReturnCamera
      workReturnCamera = undefined
    } else if (change.afresh) {
      camera = undefined
    }
    repaint(panFrom)
  }

  function loadPendingRevision(): void {
    const wantedRevision = state.revisionId ?? null
    const shownRevision = viewModel.revision?.id ?? null
    const readRevision = options.readRevision
    if (readRevision === undefined || wantedRevision === shownRevision || loadingRevision === wantedRevision) return
    loadingRevision = wantedRevision
    void readRevision(state.revisionId).then(next => {
      if (closed || (state.revisionId ?? null) !== wantedRevision) return
      loadingRevision = false
      if (next !== undefined) update(next)
    })
  }

  /** Whatever the details pane opened and still lacks: a revision, record, structure, source file, or diff. */
  function loadPending(): void {
    loadPendingRevision()
    const { taskRecord, sourceView, currentId } = state
    if (taskRecord !== undefined && taskRecord.diff === undefined) {
      state = { ...state, taskRecord: { ...taskRecord, diff: null } }
      void Promise.all([
        taskRecord.details ?? options.readTask?.(taskRecord.id),
        options.readTaskDiff?.(taskRecord.id),
      ]).then(([details, diff]) => {
        if (!closed && state.taskRecord?.id === taskRecord.id) take({ taskRecord: { ...state.taskRecord, details, diff: diff ?? null } })
      })
    }
    const component = viewModel.elements.find(element => element.representationId === currentId && element.kind === 'component')
    if (state.detailsTab === 'how' && component !== undefined && state.codeStructure?.elementId !== component.representationId) {
      state = { ...state, codeStructure: { elementId: component.representationId, files: [] } }
      void options.readStructure?.(component.representationId).then(files => {
        if (!closed && state.currentId === component.representationId) take({ codeStructure: { elementId: component.representationId, files: files ?? [] } })
      })
    }
    if (sourceView !== undefined && sourceView.text === undefined && currentId !== undefined) {
      void options.readSource?.(currentId, sourceView.file).then(payload => {
        if (!closed && state.sourceView?.file === sourceView.file) take({ sourceView: { ...sourceView, text: payload?.source ?? '' } })
      })
    }
  }

  /** A read arrived: the state takes it and the screen repaints. */
  function take(part: Partial<ViewerState>): void {
    state = { ...state, ...part }
    repaint()
  }

  function onSearchKey(key: KeyEvent): void {
    if (key.name === 'escape') {
      state = reduceSearch(viewModel, architectureSearch, state, { type: 'cancel' })
      if (searchReturnCamera) {
        camera = searchReturnCamera
        searchReturnCamera = undefined
      }
      repaint()
      return
    }
    const input = searchInputFor(key)
    if (!input) return
    if (input.type === 'accept') searchReturnCamera = undefined
    transition(reduceSearch(viewModel, architectureSearch, state, input))
  }

  function handleNonSearchKey(key: KeyEvent): boolean {
    if (key.name === '/' && state.work === undefined) {
      state = reduceSearch(viewModel, architectureSearch, state, { type: 'open' })
      searchReturnCamera = snapshot()
      repaint()
    } else if (key.name === 'escape') {
      transition(reduceViewer(viewModel, state, 'dismiss'))
    } else if (key.name === 'r' && !key.ctrl) {
      void refresh()
    } else return false
    return true
  }

  function handleEmptyWorldKey(key: KeyEvent): boolean {
    if (!isEmptyWorld(viewModel)) return false
    if (key.name === 'escape' || key.name === 'q') destroy()
    else if (key.name === 'r' && !key.ctrl) void refresh()
    return true
  }

  function onKeypress(key: KeyEvent): void {
    if (key.eventType === 'release') return
    // Groma owns pane navigation; focused toolkit scrollbars must not scroll again.
    key.preventDefault()
    if (key.ctrl && key.name === 'c') {
      destroy()
      return
    }
    if (handleEmptyWorldKey(key)) return
    if (state.search) {
      onSearchKey(key)
      return
    }
    if (graphics?.key(key)) return
    if (handleNonSearchKey(key)) return
    const action = actionFor(key)
    if (!action) return
    transition(reduceViewer(viewModel, state, action))
  }

  renderer.keyInput.on('keypress', onKeypress)
  renderer.once('destroy', onRendererDestroy)
  repaint()

  return {
    closed: closedPromise,
    destroy,
    refresh,
    update,
    setView(next: {
      level?: TerminalLevel
      currentId?: string
      camera?: TerminalCamera
    }) {
      if (next.camera) {
        camera = next.camera
      }
      state = {
        ...state,
        level: next.level ?? state.level,
        currentId: next.currentId ?? state.currentId,
      }
      repaint()
    },
  }
}
