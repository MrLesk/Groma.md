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

import { loadArchitectureViewModel } from '../core.ts'
import { paintWorld, themeFromPalette } from './paint.ts'
import { projectWorld } from './projection.ts'
import type {
  ArchitectureViewModel,
  SemanticLevel,
} from '../types.ts'

interface ViewerOptions {
  level?: SemanticLevel
  currentId?: string
  palette?: NormalizedTerminalPalette
}

interface StartViewerOptions {
  renderer?: CliRenderer
  palette?: NormalizedTerminalPalette
}

export interface TerminalViewer {
  closed: Promise<void>
  destroy(): void
  setView(next: { level?: SemanticLevel; currentId?: string }): void
}

export function mountTerminalViewer(
  renderer: CliRenderer,
  response: ArchitectureViewModel,
  options: ViewerOptions = {},
): TerminalViewer {
  let level = options.level ?? 'context'
  let currentId = options.currentId
  let closed = false
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
    const projection = projectWorld(response.world, {
      width: frame.frameBuffer.width,
      height: frame.frameBuffer.height,
      level,
      currentId,
    })
    currentId = projection.currentId ?? undefined
    paintWorld(frame.frameBuffer, projection, theme)
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

  function onKeypress(key: KeyEvent): void {
    if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
      destroy()
    }
  }

  renderer.keyInput.on('keypress', onKeypress)
  renderer.once('destroy', onRendererDestroy)
  repaint()

  return {
    closed: closedPromise,
    destroy,
    setView(next: { level?: SemanticLevel; currentId?: string }) {
      level = next.level ?? level
      currentId = next.currentId ?? currentId
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
    return mountTerminalViewer(renderer, response, { palette })
  } catch (error) {
    renderer.destroy()
    throw error
  }
}
