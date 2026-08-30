import {
  FrameBufferRenderable,
  normalizeTerminalPalette,
} from '@opentui/core'
import type {
  CliRenderer,
  KeyEvent,
  NormalizedTerminalPalette,
} from '@opentui/core'

import { actionLegs } from '../action-path.ts'
import { createArchitectureSearch } from '../../search.ts'
import { paneLayout } from './layout.ts'
import {
  initialState,
  litAction,
  reduceSearch,
  reduceViewer,
} from './navigation.ts'
import type { SearchInput, ViewerAction, ViewerState } from './navigation.ts'
import { paintWorld, themeFromPalette } from './paint.ts'
import { projectWorld } from './projection.ts'
import type { TerminalCamera } from './projection-camera.ts'
import type { TerminalViewModel } from './model.ts'
import { reconcileWorkFocus, selectedWorkId, workView } from './work/model.ts'
import type { TerminalLevel } from '../../types.ts'

const FLOW_ANIMATION_MS = 120
const FLOW_ANIMATION_PHASES = 3
const VIEWER_ACTION_BY_KEY: Readonly<Record<string, ViewerAction>> = {
  return: 'enter',
  backspace: 'leave',
  tab: 'tab',
  ']': 'toggle-details',
  x: 'clear-action',
  s: 'step-action',
  t: 'toggle-details-tab',
  w: 'toggle-work',
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
}

interface ViewerOptions {
  level?: TerminalLevel
  currentId?: string
  camera?: TerminalCamera
  palette?: NormalizedTerminalPalette
  onRefresh?: () => void | Promise<void>
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

export function mountTerminalViewer(
  renderer: CliRenderer,
  response: TerminalViewModel,
  options: ViewerOptions = {},
): TerminalViewer {
  let viewModel = response
  let architectureSearch = createArchitectureSearch(response.elements)
  let state: ViewerState = {
    ...initialState(response),
    ...(options.level === undefined ? {} : { level: options.level }),
    ...(options.currentId === undefined ? {} : { currentId: options.currentId }),
  }
  let closed = false
  let resolveClosed!: () => void
  const closedPromise = new Promise<void>(resolve => {
    resolveClosed = resolve
  })
  const theme = themeFromPalette(
    options.palette ?? normalizeTerminalPalette(),
  )
  let camera = options.camera
  let animationPhase = 0
  let animationTimer: ReturnType<typeof setInterval> | undefined
  const frame = new FrameBufferRenderable(renderer, {
    id: 'architecture-world',
    width: Math.max(1, renderer.width),
    height: Math.max(1, renderer.height),
    onSizeChange() {
      repaint()
    },
  })
  frame.width = '100%'
  frame.height = '100%'
  renderer.root.add(frame)

  function snapshot(): TerminalCamera | undefined {
    return camera === undefined ? undefined : { ...camera }
  }

  function currentLayout() {
    const { width, height } = frame.frameBuffer
    return paneLayout(width, height, state.panes)
  }

  function project(next?: TerminalCamera) {
    const lit = litAction(viewModel, state)
    const taskView = workView(viewModel, state.work)
    const flowAttention = state.actionStep === undefined
      ? undefined
      : actionLegs(lit.id, viewModel, lit.actorId)[state.actionStep]?.target
    return projectWorld(viewModel, {
      viewport: currentLayout().mapViewport,
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

  function repaint(): void {
    if (closed || frame.isDestroyed) return
    const projection = project()
    const lit = litAction(viewModel, state)
    syncAnimation(lit.id !== undefined)
    camera = projection.camera
    if (state.work === undefined) {
      state = { ...state, currentId: projection.currentId ?? undefined }
    }
    paintWorld(frame.frameBuffer, currentLayout(), projection, viewModel, theme, {
      focus: state.focus,
      tree: state.tree,
      detailsScroll: state.detailsScroll,
      search: state.search,
      activeActionId: state.activeActionId,
      lit,
      actionStep: state.actionStep,
      actionCursor: state.actionCursor,
      detailsTab: state.detailsTab,
      workFocus: state.work,
      animationPhase,
    })
    frame.requestRender()
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
    return key.ctrl || key.name === undefined ? undefined : VIEWER_ACTION_BY_KEY[key.name]
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

  // The camera follows any selection change through one framing rule.
  function transition(next: ViewerState): void {
    const changedScope = next.level !== state.level
    const enteringWork = state.work === undefined && next.work !== undefined
    const leavingWork = state.work !== undefined && next.work === undefined
    const changedTask = selectedWorkId(next.work) !== selectedWorkId(state.work)
    if (enteringWork) workReturnCamera = snapshot()
    state = next
    if (leavingWork) {
      camera = workReturnCamera
      workReturnCamera = undefined
    } else if (enteringWork || changedTask) {
      camera = undefined
    } else if (changedScope) {
      camera = undefined
    }
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
        mapStep: undefined,
      }
      repaint()
    },
  }
}
