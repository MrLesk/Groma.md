import { createCliRenderer, FrameBufferRenderable } from '@opentui/core'
import type { CliRenderer, KeyEvent } from '@opentui/core'

import {
  advancedCommands,
  advancedIndex,
  instructionViews,
  instructionsIndex,
  loadWelcomeModel,
  welcomeActions,
  welcomeSheet,
} from './welcome/model.ts'
import type { WelcomeActionId, WelcomeModel } from './welcome/model.ts'
import {
  paintAdvanced,
  paintInstructions,
  paintLauncher,
} from './welcome/view.ts'
import type { AdvancedPaintResult, ScrollPaintResult } from './welcome/view.ts'

export { renderPlainWelcome } from './welcome/model.ts'
export type { WelcomeActionId } from './welcome/model.ts'

export type WelcomeScreen = 'launcher' | 'instructions'

interface LauncherState {
  kind: 'launcher'
  selectedIndex: number
}

interface AdvancedState {
  kind: 'advanced'
  selectedIndex: number
  tableScroll: number
  descriptionScroll: number
}

interface InstructionsState {
  kind: 'instructions'
  selectedIndex: number
  scroll: number
}

type WelcomeState = LauncherState | AdvancedState | InstructionsState

function launcherState(selectedIndex = 0): LauncherState {
  return { kind: 'launcher', selectedIndex }
}

function advancedState(): AdvancedState {
  return {
    kind: 'advanced',
    selectedIndex: 1,
    tableScroll: 0,
    descriptionScroll: 0,
  }
}

function instructionsState(): InstructionsState {
  return { kind: 'instructions', selectedIndex: 1, scroll: 0 }
}

function initialState(screen: WelcomeScreen): WelcomeState {
  return screen === 'instructions' ? instructionsState() : launcherState()
}

type ReadingDirection = 'up' | 'down' | 'pageup' | 'pagedown'

function readingDirection(key: KeyEvent): ReadingDirection | undefined {
  if (key.name === 'pageup' || key.name === 'pagedown') return key.name
  if (key.name === 'k') return 'up'
  if (key.name === 'j') return 'down'
  return undefined
}

function readingScroll(
  current: number,
  direction: ReadingDirection,
  paint: ScrollPaintResult,
): number {
  const distance = direction === 'pageup' || direction === 'pagedown'
    ? paint.pageSize
    : 1
  const movement = direction === 'up' || direction === 'pageup'
    ? -distance
    : distance
  return Math.max(0, Math.min(paint.maxScroll, current + movement))
}

export function mountWelcome(
  renderer: CliRenderer,
  model: WelcomeModel,
  initialScreen: WelcomeScreen = 'launcher',
): Promise<WelcomeActionId | undefined> {
  const sheet = welcomeSheet(model)
  let state = initialState(initialScreen)
  let advancedPaint: AdvancedPaintResult = {
    maxScroll: 0,
    pageSize: 0,
    scroll: 0,
    tableScroll: 0,
  }
  let instructionsPaint: ScrollPaintResult = {
    maxScroll: 0,
    pageSize: 1,
    scroll: 0,
  }
  let arrowVisible = true
  let closed = false
  let resolveSelected!: (selection: WelcomeActionId | undefined) => void
  const selected = new Promise<WelcomeActionId | undefined>(resolve => {
    resolveSelected = resolve
  })
  const frame = new FrameBufferRenderable(renderer, {
    id: 'groma-welcome',
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
    if (state.kind === 'launcher') {
      paintLauncher(
        frame.frameBuffer,
        model,
        sheet,
        state.selectedIndex,
        arrowVisible,
      )
    } else if (state.kind === 'advanced') {
      advancedPaint = paintAdvanced(
        frame.frameBuffer,
        model,
        sheet,
        state.selectedIndex,
        state.tableScroll,
        state.descriptionScroll,
        arrowVisible,
      )
      state.tableScroll = advancedPaint.tableScroll
      state.descriptionScroll = advancedPaint.scroll
    } else {
      instructionsPaint = paintInstructions(
        frame.frameBuffer,
        model,
        sheet,
        state.selectedIndex,
        Math.max(0, state.selectedIndex - 1),
        state.scroll,
        arrowVisible,
      )
      state.scroll = instructionsPaint.scroll
    }
    frame.requestRender()
  }

  const blinkTimer = setInterval(() => {
    arrowVisible = !arrowVisible
    repaint()
  }, 500)

  function close(selection: WelcomeActionId | undefined): void {
    if (closed) return
    closed = true
    clearInterval(blinkTimer)
    renderer.keyInput.off('keypress', onKeypress)
    renderer.off('destroy', onRendererDestroy)
    if (!renderer.isDestroyed) renderer.destroy()
    resolveSelected(selection)
  }

  function onRendererDestroy(): void {
    close(undefined)
  }

  function showLauncher(selectedIndex: number): void {
    state = launcherState(selectedIndex)
    arrowVisible = true
    repaint()
  }

  function showAdvanced(): void {
    state = advancedState()
    arrowVisible = true
    repaint()
  }

  function showInstructions(): void {
    state = instructionsState()
    arrowVisible = true
    repaint()
  }

  function moveLauncher(key: 'up' | 'down'): void {
    if (state.kind !== 'launcher') return
    const movement = key === 'up' ? -1 : 1
    state.selectedIndex = Math.max(
      0,
      Math.min(advancedIndex, state.selectedIndex + movement),
    )
    arrowVisible = true
    repaint()
  }

  function enterLauncher(): void {
    if (state.kind !== 'launcher') return
    if (state.selectedIndex === advancedIndex) {
      showAdvanced()
      return
    }
    if (state.selectedIndex === instructionsIndex) {
      showInstructions()
      return
    }
    close(welcomeActions[state.selectedIndex]?.id)
  }

  function moveInstruction(key: 'up' | 'down'): void {
    if (state.kind !== 'instructions') return
    const movement = key === 'up' ? -1 : 1
    const selectedIndex = Math.max(
      0,
      Math.min(instructionViews.length, state.selectedIndex + movement),
    )
    if (selectedIndex > 0 && selectedIndex !== state.selectedIndex) {
      state.scroll = 0
    }
    state.selectedIndex = selectedIndex
    arrowVisible = true
    repaint()
  }

  function scrollInstructions(direction: ReadingDirection): void {
    if (state.kind !== 'instructions') return
    state.scroll = readingScroll(state.scroll, direction, instructionsPaint)
    repaint()
  }

  function moveAdvanced(key: 'up' | 'down'): void {
    if (state.kind !== 'advanced') return
    const movement = key === 'up' ? -1 : 1
    const selectedIndex = Math.max(
      0,
      Math.min(advancedCommands.length, state.selectedIndex + movement),
    )
    if (selectedIndex !== state.selectedIndex) state.descriptionScroll = 0
    state.selectedIndex = selectedIndex
    arrowVisible = true
    repaint()
  }

  function scrollAdvanced(direction: ReadingDirection): void {
    if (state.kind !== 'advanced') return
    state.descriptionScroll = readingScroll(
      state.descriptionScroll,
      direction,
      advancedPaint,
    )
    repaint()
  }

  function handleLauncherKey(key: KeyEvent): void {
    if (key.name === 'up' || key.name === 'down') moveLauncher(key.name)
    else if (key.name === 'return') enterLauncher()
  }

  function handleAdvancedKey(key: KeyEvent): void {
    if (key.name === 'backspace') {
      showLauncher(advancedIndex)
      return
    }
    if (key.name === 'return' && state.kind === 'advanced' && state.selectedIndex === 0) {
      showLauncher(advancedIndex)
      return
    }
    const reading = readingDirection(key)
    if (key.name === 'up' || key.name === 'down') moveAdvanced(key.name)
    else if (reading !== undefined) scrollAdvanced(reading)
  }

  function handleInstructionsKey(key: KeyEvent): void {
    if (key.name === 'backspace') {
      showLauncher(instructionsIndex)
      return
    }
    const reading = readingDirection(key)
    if (key.name === 'up' || key.name === 'down') moveInstruction(key.name)
    else if (reading !== undefined) scrollInstructions(reading)
    else if (key.name === 'return' && state.kind === 'instructions' && state.selectedIndex === 0) {
      showLauncher(instructionsIndex)
    }
  }

  function onKeypress(key: KeyEvent): void {
    if (key.eventType === 'release') return
    if (
      (key.ctrl && key.name === 'c')
      || key.name === 'escape'
      || key.name === 'q'
    ) {
      close(undefined)
      return
    }
    if (state.kind === 'launcher') handleLauncherKey(key)
    else if (state.kind === 'advanced') handleAdvancedKey(key)
    else handleInstructionsKey(key)
  }

  renderer.keyInput.on('keypress', onKeypress)
  renderer.once('destroy', onRendererDestroy)
  repaint()

  return selected
}

export async function startWelcome(
  repositoryRoot: string,
  initialScreen: WelcomeScreen = 'launcher',
): Promise<WelcomeActionId | undefined> {
  const model = await loadWelcomeModel(repositoryRoot)
  const renderer = await createCliRenderer({
    clearOnShutdown: true,
    consoleMode: 'disabled',
    exitOnCtrlC: false,
    screenMode: 'alternate-screen',
    useMouse: false,
  })
  try {
    return await mountWelcome(renderer, model, initialScreen)
  } catch (error) {
    renderer.destroy()
    throw error
  }
}
