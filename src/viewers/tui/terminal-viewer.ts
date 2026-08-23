import {
  FrameBufferRenderable,
  normalizeTerminalPalette,
} from '@opentui/core'
import type {
  CliRenderer,
  KeyEvent,
  NormalizedTerminalPalette,
} from '@opentui/core'

import { actionPath } from '../action-path.ts'
import { createCamera } from './camera.ts'
import { paneLayout } from './layout.ts'
import {
  initialState,
  litAction,
  reduceFilter,
  reduceViewer,
} from './navigation.ts'
import type { FilterInput, ViewerAction, ViewerState } from './navigation.ts'
import { paintWorld, themeFromPalette } from './paint.ts'
import { fitView, followSelection, projectWorld } from './projection.ts'
import type {
  ArchitectureViewModel,
  MapCamera,
  SemanticLevel,
} from '../../types.ts'

const ZOOM_STEP = 1.25

interface ViewerOptions {
  level?: SemanticLevel
  currentId?: string
  camera?: MapCamera
  palette?: NormalizedTerminalPalette
  onRefresh?: () => void | Promise<void>
}

export interface TerminalViewer {
  closed: Promise<void>
  destroy(): void
  refresh(): Promise<void>
  update(next: ArchitectureViewModel): void
  setView(next: {
    level?: SemanticLevel
    currentId?: string
    camera?: MapCamera
  }): void
}

export function mountTerminalViewer(
  renderer: CliRenderer,
  response: ArchitectureViewModel,
  options: ViewerOptions = {},
): TerminalViewer {
  let viewModel = response
  let state: ViewerState = {
    ...initialState(response.world),
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
  const camera = createCamera(
    options.camera ?? fitView(
      viewModel.world,
      paneLayout(
        Math.max(1, renderer.width),
        Math.max(1, renderer.height),
        state.panes,
      ).mapViewport,
    ),
  )
  let live = false
  const frame = new FrameBufferRenderable(renderer, {
    id: 'architecture-world',
    width: Math.max(1, renderer.width),
    height: Math.max(1, renderer.height),
    onSizeChange() {
      camera.snapTo(snapshot())
      releaseLive()
      repaint()
    },
  })
  frame.width = '100%'
  frame.height = '100%'
  renderer.root.add(frame)

  function snapshot(): MapCamera {
    return {
      zoom: camera.zoom,
      centerX: camera.centerX,
      centerY: camera.centerY,
    }
  }

  function releaseLive(): void {
    if (!live) return
    live = false
    renderer.dropLive()
  }

  function currentLayout() {
    const { width, height } = frame.frameBuffer
    return paneLayout(width, height, state.panes)
  }

  function project(next?: MapCamera, lockCamera = camera.isAnimating()) {
    const lit = litAction(viewModel.world, state)
    return projectWorld(viewModel.world, {
      viewport: currentLayout().mapViewport,
      level: state.level,
      currentId: state.currentId,
      camera: next ?? snapshot(),
      lockCamera,
      litIds: actionPath(lit.id, viewModel.world, lit.actorId),
    })
  }

  function repaint(): void {
    if (closed || frame.isDestroyed) return
    const projection = project()
    if (!camera.isAnimating()) camera.snapTo(projection.camera)
    state = {
      ...state,
      currentId: projection.currentId ?? undefined,
    }
    paintWorld(frame.frameBuffer, currentLayout(), projection, viewModel.world, theme, {
      focus: state.focus,
      tree: state.tree,
      detailsScroll: state.detailsScroll,
      filter: state.filter,
      activeActionId: state.activeActionId,
      lit: litAction(viewModel.world, state),
      actionStep: state.actionStep,
      actionCursor: state.actionCursor,
      detailsTab: state.detailsTab,
      work: viewModel.work ?? [],
    })
    frame.requestRender()
  }

  function animateTo(target: MapCamera): void {
    if (
      Math.abs(target.zoom - camera.zoom) < 1e-6
      && Math.abs(target.centerX - camera.centerX) < 1e-6
      && Math.abs(target.centerY - camera.centerY) < 1e-6
    ) return
    const wasAnimating = camera.isAnimating()
    camera.startTween(target)
    if (!wasAnimating) {
      live = true
      renderer.requestLive()
    }
  }

  function zoomBy(factor: number): void {
    const fitted = fitView(viewModel.world, currentLayout().mapViewport)
    const nextZoom = factor > 1
      ? Math.min(1, camera.zoom * factor)
      : Math.max(fitted.zoom, camera.zoom * factor)
    const target = nextZoom <= fitted.zoom + 1e-6
      ? fitted
      : project({
          zoom: nextZoom,
          centerX: camera.centerX,
          centerY: camera.centerY,
        }, false).camera
    animateTo(target)
  }

  async function onFrame(deltaTime: number): Promise<void> {
    if (closed) return
    if (camera.update(deltaTime)) repaint()
    if (!camera.isAnimating()) releaseLive()
  }

  function release(): void {
    renderer.removeFrameCallback(onFrame)
    releaseLive()
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

  function update(next: ArchitectureViewModel): void {
    if (closed) return
    viewModel = next
    camera.snapTo(snapshot())
    releaseLive()
    repaint()
  }

  function actionFor(key: KeyEvent): ViewerAction | undefined {
    if (key.ctrl) return undefined
    if (key.name === 'return') return 'enter'
    if (key.name === 'backspace') return 'leave'
    if (key.name === 'tab') return 'tab'
    if (key.name === '[') return 'toggle-hierarchy'
    if (key.name === ']') return 'toggle-details'
    if (key.name === 'x') return 'clear-action'
    if (key.name === 's') return 'step-action'
    if (key.name === 't') return 'toggle-details-tab'
    if (
      key.name === 'up'
      || key.name === 'down'
      || key.name === 'left'
      || key.name === 'right'
    ) return key.name
    return undefined
  }

  function zoomFactor(key: KeyEvent): number | undefined {
    if (key.name === '+' || key.name === '=') return ZOOM_STEP
    if (key.name === '-' || key.name === '_') return 1 / ZOOM_STEP
    return undefined
  }

  let filterReturnCamera: MapCamera | undefined

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
    const previous = { level: state.level, currentId: state.currentId }
    const current = snapshot()
    state = next
    const framed = followSelection(
      viewModel.world,
      currentLayout().mapViewport,
      previous,
      state,
      current,
    )
    if (framed) animateTo(framed)
    repaint()
  }

  function onFilterKey(key: KeyEvent): void {
    if (key.name === 'escape') {
      state = reduceFilter(viewModel.world, state, { type: 'cancel' })
      if (filterReturnCamera) {
        animateTo(filterReturnCamera)
        filterReturnCamera = undefined
      }
      repaint()
      return
    }
    const input = filterInputFor(key)
    if (!input) return
    if (input.type === 'accept') filterReturnCamera = undefined
    transition(reduceFilter(viewModel.world, state, input))
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
    if (key.name === '/') {
      state = reduceFilter(viewModel.world, state, { type: 'open' })
      filterReturnCamera = snapshot()
      repaint()
      return
    }
    if (key.name === 'escape') {
      if (state.focus === 'architecture') return
      state = reduceViewer(viewModel.world, state, 'dismiss')
      repaint()
      return
    }
    if (key.name === 'r' && !key.ctrl) {
      void refresh()
      return
    }
    const factor = zoomFactor(key)
    if (factor !== undefined) {
      zoomBy(factor)
      return
    }
    const action = actionFor(key)
    if (!action) return
    transition(reduceViewer(viewModel.world, state, action))
  }

  renderer.setFrameCallback(onFrame)
  renderer.keyInput.on('keypress', onKeypress)
  renderer.once('destroy', onRendererDestroy)
  repaint()

  return {
    closed: closedPromise,
    destroy,
    refresh,
    update,
    setView(next: {
      level?: SemanticLevel
      currentId?: string
      camera?: MapCamera
    }) {
      if (next.camera) {
        camera.snapTo(next.camera)
        releaseLive()
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
