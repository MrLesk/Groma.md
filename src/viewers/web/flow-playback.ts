/** Playback of an active flow: paused, travel rate, and the traced leg. */
export interface Playback {
  paused: boolean
  rate: number
  /** Index of the leg being traced, or null while the whole walk plays. */
  step: number | null
}

export const initialPlayback: Playback = { paused: false, rate: 1, step: null }

export type PlaybackEvent =
  | { type: 'toggle-pause' }
  | { type: 'rate'; rate: number }
  | { type: 'step'; legCount: number }

export function nextPlayback(state: Playback, event: PlaybackEvent): Playback {
  switch (event.type) {
    case 'toggle-pause':
      return { ...state, paused: !state.paused, step: null }
    case 'rate':
      return { ...state, rate: event.rate }
    case 'step':
      if (event.legCount === 0) return state
      return {
        ...state,
        step: state.step === null ? 0 : (state.step + 1) % event.legCount,
      }
  }
}
