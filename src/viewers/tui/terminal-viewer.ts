import type { CliRenderer, KeyEvent } from '@opentui/core'

import { isEmptyWorld } from '../../empty-world.ts'
import { createArchitectureSearch } from '../../search.ts'
import { litLegs, projectFlowStep } from './flow.ts'
import { panesForWidth } from './layout.ts'
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
import type { TaskFileDiff } from '../source/diff-lines.ts'
import type { CodeFile } from '../source/structure.ts'
import { clickHistoryRevision } from './navigation-history.ts'

const FLOW_ANIMATION_MS = 120
const FLOW_ANIMATION_PHASES = 3
const PAN_FRAMES = 4
const PAN_MS = 30

interface ViewerOptions {
  level?: TerminalLevel
  currentId?: string
  onRefresh?: () => void | Promise<void>
  /** The full record of one task, read when the details pane opens it. */
  readTask?: (id: string) => Promise<WorkItemDetails>
  /** The declarations of a component's TypeScript files, read when its How tab shows. */
  readStructure?: (elementId: string) => Promise<CodeFile[] | undefined>
  /** A component's source file, read when a declaration opens it. */
  readSource?: (elementId: string, file: string) => Promise<{ source: string } | undefined>
  /** One modified file of a task as a diff, read when the record opens it. */
  readDiff?: (taskId: string, file: string) => Promise<TaskFileDiff | undefined>
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

/** The projection drawn `dx` columns to the right, for the frames of a pan. */
function shifted(projection: TerminalProjection, dx: number): TerminalProjection {
  if (dx === 0) return projection
  return {
    ...projection,
    items: projection.items.map(item => ({ ...item, cellBounds: { ...item.cellBounds, x: item.cellBounds.x + dx } })),
    relationships: projection.relationships.map(route => ({ ...route, cellRoute: route.cellRoute.map(point => ({ ...point, x: point.x + dx })) })),
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
  let slide: { distance: number; left: number } | undefined
  let slideTimer: ReturnType<typeof setTimeout> | undefined
  let loadingRevision: string | null | false = false
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
      if (id !== undefined && mapAnchors(viewModel, state.level, state.currentId).has(id)) {
        transition(selectMapItem(viewModel, state, id))
      }
    },
  })

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

  function repaint(panFrom?: number): void {
    if (closed || screen.map.isDestroyed) return
    const projection = project()
    const lit = litAction(viewModel, state)
    syncAnimation(lit.id !== undefined)
    camera = projection.camera
    if (state.work === undefined) {
      state = { ...state, currentId: projection.currentId ?? undefined }
    }
    const step = projectFlowStep(viewModel, projection, lit.id, lit.actorId, state.actionStep)
    paintMap(screen.map.frameBuffer, shifted(projection, slideShift(projection.camera.x, panFrom)), viewModel, theme, {
      lit,
      step,
      workFocus: state.work,
      animationPhase,
    })
    lastProjection = projection
    screen.apply(screenView(theme, viewModel, state, projection, lit, step))
    screen.map.requestRender()
    slideOn()
  }

  /** The columns the map still lags behind its new camera; a fresh pan starts from the camera it left. */
  function slideShift(cameraX: number, panFrom: number | undefined): number {
    if (panFrom !== undefined && panFrom !== cameraX) slide = { distance: cameraX - panFrom, left: PAN_FRAMES }
    return slide === undefined ? 0 : Math.round(slide.distance * slide.left / PAN_FRAMES)
  }

  function slideOn(): void {
    if (slide === undefined) return
    slide = slide.left > 1 ? { ...slide, left: slide.left - 1 } : undefined
    clearTimeout(slideTimer)
    slideTimer = setTimeout(() => repaint(), PAN_MS)
  }

  function release(): void {
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
    const panFrom = change.slides ? camera?.x : undefined
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
    const { taskRecord, sourceView, diffView, currentId } = state
    if (taskRecord !== undefined && taskRecord.details === undefined) {
      void options.readTask?.(taskRecord.id).then(details => {
        if (!closed && state.taskRecord?.id === taskRecord.id) take({ taskRecord: { id: taskRecord.id, details } })
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
    if (diffView !== undefined && diffView.diff === undefined) {
      void options.readDiff?.(diffView.taskId, diffView.file).then(diff => {
        if (!closed && state.diffView?.file === diffView.file && diff !== undefined) take({ diffView: { ...diffView, diff } })
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
    if (key.ctrl && key.name === 'c') {
      destroy()
      return
    }
    if (handleEmptyWorldKey(key)) return
    if (state.search) {
      onSearchKey(key)
      return
    }
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
