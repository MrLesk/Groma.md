import {
  createCliRenderer,
  FrameBufferRenderable,
  normalizeTerminalPalette,
} from '@opentui/core'
import type {
  CliRenderer,
  KeyEvent,
  NormalizedTerminalPalette,
} from '@opentui/core'

import { loadArchitectureViewModel } from '../../core.ts'
import {
  initialState,
  reduceViewer,
} from './navigation.ts'
import type { ViewerAction, ViewerState } from './navigation.ts'
import { paintWorld, themeFromPalette } from './paint.ts'
import { projectWorld } from './projection.ts'
import type {
  ArchitectureViewModel,
  SemanticLevel,
} from '../../types.ts'

interface ViewerOptions {
  level?: SemanticLevel
  currentId?: string
  palette?: NormalizedTerminalPalette
  repositoryRoot?: string
}

interface StartViewerOptions {
  renderer?: CliRenderer
  palette?: NormalizedTerminalPalette
}

export interface TerminalViewer {
  closed: Promise<void>
  destroy(): void
  refresh(): Promise<void>
  setView(next: { level?: SemanticLevel; currentId?: string }): void
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
  let refreshWork: Promise<void> | undefined
  let resolveClosed!: () => void
  const closedPromise = new Promise<void>(resolve => {
    resolveClosed = resolve
  })
  const theme = themeFromPalette(
    options.palette ?? normalizeTerminalPalette(),
  )
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

  function repaint(): void {
    if (closed || frame.isDestroyed) return
    const projection = projectWorld(viewModel.world, {
      width: frame.frameBuffer.width,
      height: frame.frameBuffer.height,
      level: state.level,
      currentId: state.currentId,
      panel: state.panel === 'side' ? 'side' : undefined,
    })
    state = { ...state, currentId: projection.currentId ?? undefined }
    paintWorld(frame.frameBuffer, projection, theme, {
      focus: state.focus,
      panel: state.panel,
      world: viewModel.world,
    })
    frame.requestRender()
  }

  function release(): void {
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
    if (!options.repositoryRoot || closed) return Promise.resolve()
    refreshWork ??= loadArchitectureViewModel(options.repositoryRoot)
      .then(next => {
        if (closed) return
        viewModel = next
        repaint()
      })
      .catch(() => {})
      .finally(() => {
        refreshWork = undefined
      })
    return refreshWork
  }

  function actionFor(key: KeyEvent): ViewerAction | undefined {
    if (key.ctrl) return undefined
    if (key.name === '+') return 'enter'
    if (key.name === '-') return 'leave'
    if (key.name === 'return') return 'inspect'
    if (key.name === 'z') return 'zoom'
    if (key.name === 'f') return 'flip'
    if (
      key.name === 'up'
      || key.name === 'down'
      || key.name === 'left'
      || key.name === 'right'
    ) return key.name
    return undefined
  }

  function onKeypress(key: KeyEvent): void {
    if (key.eventType === 'release') return
    if (key.ctrl && key.name === 'c') {
      destroy()
      return
    }
    if (key.name === 'escape') {
      if (state.panel !== 'closed') {
        state = reduceViewer(viewModel.world, state, 'dismiss')
        repaint()
        return
      }
      destroy()
      return
    }
    if (key.name === 'r' && !key.ctrl) {
      void refresh()
      return
    }
    const action = actionFor(key)
    if (!action) return
    state = reduceViewer(viewModel.world, state, action)
    repaint()
  }

  renderer.keyInput.on('keypress', onKeypress)
  renderer.once('destroy', onRendererDestroy)
  repaint()

  return {
    closed: closedPromise,
    destroy,
    refresh,
    setView(next: { level?: SemanticLevel; currentId?: string }) {
      state = {
        ...state,
        level: next.level ?? state.level,
        currentId: next.currentId ?? state.currentId,
      }
      repaint()
    },
  }
}

export async function startTerminalViewer(
  repositoryRoot: string,
  options: StartViewerOptions = {},
): Promise<TerminalViewer> {
  const response = await loadArchitectureViewModel(repositoryRoot)
  const renderer = options.renderer ?? await createCliRenderer({
    clearOnShutdown: true,
    consoleMode: 'disabled',
    exitOnCtrlC: false,
    screenMode: 'alternate-screen',
    useMouse: false,
  })

  try {
    const palette = options.palette ?? normalizeTerminalPalette(
      await renderer.getPalette({ timeout: 100 }),
    )
    return mountTerminalViewer(renderer, response, {
      palette,
      repositoryRoot,
    })
  } catch (error) {
    renderer.destroy()
    throw error
  }
}
