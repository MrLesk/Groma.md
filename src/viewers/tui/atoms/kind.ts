import type { C4Kind } from '../../../types.ts'

const glyphs: Record<C4Kind, string> = {
  actor: '●',
  system: '■',
  container: '□',
  component: '▪',
}

const labels: Record<C4Kind, string> = {
  actor: 'Actor',
  system: 'System',
  container: 'Container',
  component: 'Component',
}

export function kindGlyph(kind: C4Kind): string {
  return glyphs[kind]
}

export function kindLabel(kind: C4Kind, external = false): string {
  const label = labels[kind]
  return external ? `External ${label.toLowerCase()}` : label
}
