import type { ViewerAction } from './navigation.ts'

/** One key the viewer handles: the toolkit's key name and the reducer action it becomes, or none when the viewer handles it itself. */
export interface MapKey {
  name: string
  action?: ViewerAction
  ctrl?: boolean
}

/** Every key the viewer handles; a key belongs here and in KEYS_BOX or nowhere. */
export const MAP_KEYS: readonly MapKey[] = [
  { name: 'up', action: 'up' },
  { name: 'down', action: 'down' },
  { name: 'k', action: 'up' },
  { name: 'j', action: 'down' },
  { name: 'left', action: 'left' },
  { name: 'right', action: 'right' },
  { name: 'return', action: 'enter' },
  { name: 'space', action: 'toggle-selection' },
  { name: 'backspace', action: 'leave' },
  { name: 'tab', action: 'tab' },
  { name: 'escape' },
  { name: '/' },
  { name: 'h', action: 'toggle-history' },
  { name: 'w', action: 'toggle-work' },
  { name: 't', action: 'toggle-hierarchy' },
  { name: 'd', action: 'toggle-details' },
  { name: 's', action: 'step-action' },
  { name: 'x', action: 'clear-action' },
  { name: 'p', action: 'toggle-profile' },
  { name: 'r' },
  { name: '?', action: 'toggle-keys' },
  { name: 'c', ctrl: true },
]

/** One row of the keys box: how the keys read and what they do. */
export interface KeysRow {
  label: string
  meaning: string
  names: readonly string[]
}

export const KEYS_BOX: readonly KeysRow[] = [
  { label: '↑ ↓ ← →', meaning: 'Move the selection or the pane cursor', names: ['up', 'down', 'left', 'right'] },
  { label: 'j / k', meaning: 'Down / Up through the same selection or reading cursor', names: ['j', 'k'] },
  { label: 'Enter', meaning: 'Open a container; pick a flow or a relationship', names: ['return'] },
  { label: 'Space', meaning: 'Toggle a flow or task status on the map', names: ['space'] },
  { label: 'Backspace', meaning: 'Back to the root map', names: ['backspace'] },
  { label: 'Tab', meaning: 'Switch the focused details tab', names: ['tab'] },
  { label: 'Esc', meaning: 'Leave the focused mode', names: ['escape'] },
  { label: '/', meaning: 'Search the architecture', names: ['/'] },
  { label: 'h', meaning: 'Browse Groma revisions', names: ['h'] },
  { label: 'w', meaning: 'Work focus', names: ['w'] },
  { label: 't', meaning: 'Focus hierarchy; press again to fold', names: ['t'] },
  { label: 'd', meaning: 'Focus details; press again to fold', names: ['d'] },
  { label: 's', meaning: 'Step the lit flow', names: ['s'] },
  { label: 'x', meaning: 'Clear the lit flow', names: ['x'] },
  { label: 'p', meaning: 'Project profile', names: ['p'] },
  { label: 'r', meaning: 'Refresh', names: ['r'] },
  { label: '?', meaning: 'This keys box', names: ['?'] },
  { label: 'Ctrl+C', meaning: 'Exit', names: ['c'] },
]
