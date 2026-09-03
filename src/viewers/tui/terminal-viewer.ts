import type { CliRenderer, KeyEvent } from '@opentui/core'

import { createArchitectureSearch } from '../../search.ts'
import { litLegs, projectFlowStep } from './flow.ts'
import { panesForWidth } from './layout.ts'
import {
  clickTreeRow,
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

const FLOW_ANIMATION_MS = 120
const FLOW_ANIMATION_PHASES = 3
const PAN_FRAMES = 4
const PAN_MS = 30

interface ViewerOptions {
  level?: TerminalLevel
  currentId?: string
  camera?: TerminalCamera
  onRefresh?: () => void | Promise<void>
  /** The full record of one task, read when the details pane opens it. */
  readTask?: (id: string) => Promise<WorkItemDetails>
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
  let camera = options.camera
  let animationPhase = 0
  let animationTimer: ReturnType<typeof setInterval> | undefined
  // Map clicks resolve against the projection last painted.
  let lastProjection: TerminalProjection | undefined
  // A selection change at the same level slides the map from the camera it had to the one it gets.
  let slide: { distance: number; left: number } | undefined
  let slideTimer: ReturnType<typeof setTimeout> | undefined
  const screen = mountScreen(renderer, theme, {
    onMapResize: () => repaint(),
    onHierarchyRow(id) {
      transition(clickTreeRow(viewModel, state, id))
    },
    onMapCell(x, y) {
      const id = lastProjection === undefined ? undefined : itemAt(lastProjection.items, x, y)?.representationId
      // Only what the arrows can reach at this level is selectable.
      if (id !== undefined && mapAnchors(viewModel, state.level, state.currentId, state.mapWidth).has(id)) {
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
    const mapWidth = screen.mapViewport().width
    if (state.mapWidth !== mapWidth) state = { ...state, mapWidth }
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
    viewModel = next
    architectureSearch = createArchitectureSearch(next.elements)
    const work = reconcileWorkFocus(next.work, state.work)
    state = { ...state, work }
    if (JSON.stringify(workView(next, work)) !== JSON.stringify(previousView)) camera = undefined
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
    if (next.taskRecord !== undefined && next.taskRecord.details === undefined) loadRecord(next.taskRecord.id)
    if (change.restores) {
      camera = workReturnCamera
      workReturnCamera = undefined
    } else if (change.afresh) {
      camera = undefined
    }
    repaint(panFrom)
  }

  /** The record's details arrive after the pane opened on the summary. */
  function loadRecord(id: string): void {
    const read = options.readTask
    if (read === undefined) return
    void read(id).then(details => {
      if (closed || state.taskRecord?.id !== id) return
      state = { ...state, taskRecord: { id, details } }
      repaint()
    })
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

  function onKeypress(key: KeyEvent): void {
    if (key.eventType === 'release') return
    if (key.ctrl && key.name === 'c') {
      destroy()
      return
    }
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
