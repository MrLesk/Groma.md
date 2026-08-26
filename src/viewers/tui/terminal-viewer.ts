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
import { paneLayout } from './layout.ts'
import {
  initialState,
  litAction,
  reduceFilter,
  reduceViewer,
} from './navigation.ts'
import type { FilterInput, ViewerAction, ViewerState } from './navigation.ts'
import { paintWorld, themeFromPalette } from './paint.ts'
import { projectWorld } from './projection.ts'
import type { TerminalCamera } from './projection-camera.ts'
import type { TerminalViewModel } from './model.ts'
import { reconcileWorkFocus, selectedWorkId, workView } from './work/model.ts'
import type { TerminalLevel } from '../../types.ts'

const FLOW_ANIMATION_MS = 120
const FLOW_ANIMATION_PHASES = 3

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
      filter: state.filter,
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
    const work = reconcileWorkFocus(next.work, state.work)
    state = { ...state, work }
    if (JSON.stringify(workView(next, work)) !== JSON.stringify(previousView)) camera = undefined
    repaint()
  }

  function actionFor(key: KeyEvent): ViewerAction | undefined {
    if (key.ctrl) return undefined
    if (key.name === 'return') return 'enter'
    if (key.name === 'backspace') return 'leave'
    if (key.name === 'tab') return 'tab'
    if (key.name === ']') return 'toggle-details'
    if (key.name === 'x') return 'clear-action'
    if (key.name === 's') return 'step-action'
    if (key.name === 't') return 'toggle-details-tab'
    if (key.name === 'w') return 'toggle-work'
    if (
      key.name === 'up'
      || key.name === 'down'
      || key.name === 'left'
      || key.name === 'right'
    ) return key.name
    return undefined
  }

  let filterReturnCamera: TerminalCamera | undefined
  let workReturnCamera: TerminalCamera | undefined

  function filterInputFor(key: KeyEvent): FilterInput | undefined {
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

  function onFilterKey(key: KeyEvent): void {
    if (key.name === 'escape') {
      state = reduceFilter(viewModel, state, { type: 'cancel' })
      if (filterReturnCamera) {
        camera = filterReturnCamera
        filterReturnCamera = undefined
      }
      repaint()
      return
    }
    const input = filterInputFor(key)
    if (!input) return
    if (input.type === 'accept') filterReturnCamera = undefined
    transition(reduceFilter(viewModel, state, input))
  }

  function onKeypress(key: KeyEvent): void {
    if (key.eventType === 'release') return
    if (key.ctrl && key.name === 'c') {
      destroy()
      return
    }
    if (state.filter) {
      onFilterKey(key)
      return
    }
    if (key.name === '/' && state.work === undefined) {
      state = reduceFilter(viewModel, state, { type: 'open' })
      filterReturnCamera = snapshot()
      repaint()
      return
    }
    if (key.name === 'escape') {
      transition(reduceViewer(viewModel, state, 'dismiss'))
      return
    }
    if (key.name === 'r' && !key.ctrl) {
      void refresh()
      return
    }
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
