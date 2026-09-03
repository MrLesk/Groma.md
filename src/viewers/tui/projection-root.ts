import type { Island } from '../../sheet/types.ts'
import type { AnnotatedElement } from '../../types.ts'
import { kindGlyph } from '../atoms/kind.ts'
import type { TerminalViewModel } from './model.ts'
import type { WorldItem } from './projection.ts'

/** Columns kept free on each side of the map so the neighbouring islands or containers peek in. */
export const MAP_PADDING = 8
/** Columns between an island's frame and its rows' text. */
export const ROW_INSET = 2
const ISLAND_GAP = 2

/** The widest an island or a container may be: the map minus the padding on both sides. */
export function fittedWidth(mapWidth: number): number {
  return mapWidth - 2 * MAP_PADDING
}

interface RootRow {
  element: AnnotatedElement
  /** One block per component: observed ▪, draft ▫. */
  blocks: string
}

export interface RootIsland {
  island: Island
  rows: RootRow[]
}

/** The sheet's placement order: by row, then column. */
export function byPlacement<T extends { rect: { gx: number; gy: number } }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => left.rect.gy - right.rect.gy || left.rect.gx - right.rect.gx)
}

function blocksOf(element: AnnotatedElement, byId: ReadonlyMap<string, AnnotatedElement>): string {
  return element.children
    .flatMap(id => {
      const child = byId.get(id)
      return child?.kind === 'component' ? [child.origin === 'observed' ? '▪' : '▫'] : []
    })
    .join('')
}

/** Every island west to east with its rows: a system's containers, the actors, the external systems. */
export function rootIslands(model: TerminalViewModel): RootIsland[] {
  const byId = new Map(model.elements.map(element => [element.representationId, element]))
  const islands = [...model.sheet.islands].sort((left, right) => left.rect.gx - right.rect.gx || left.rect.gy - right.rect.gy)
  return islands.map(island => {
    const children = island.kind === 'system'
      ? byPlacement(model.sheet.slabs.filter(slab => slab.island === island.key))
      : byPlacement(model.sheet.buildings.filter(building => building.surface === island.key))
    const rows = children.flatMap(child => {
      const element = byId.get(child.representationId)
      return element === undefined ? [] : [{ element, blocks: island.kind === 'system' ? blocksOf(element, byId) : '' }]
    })
    return { island, rows }
  })
}

/** The selectable stops of the root, island by island: the system itself, then its rows. */
export function rootStops(model: TerminalViewModel): string[][] {
  return rootIslands(model)
    .map(entry => [...(entry.island.element === null ? [] : [entry.island.element.representationId]), ...entry.rows.map(row => row.element.representationId)])
}

function chunks(value: string, width: number): string[] {
  if (value.length === 0) return ['']
  const parts: string[] = []
  for (let start = 0; start < value.length; start += width) parts.push(value.slice(start, start + width))
  return parts
}

/**
 * Islands west to east, each listing one row per child: the kind glyph and name, then one block per
 * component wrapped inside the island's bar; an island never exceeds the map minus the padding and grows down.
 */
export function rootLayout(model: TerminalViewModel, mapWidth: number): WorldItem[] {
  const maxWidth = fittedWidth(mapWidth)
  let x = 0
  return rootIslands(model).flatMap(({ island, rows }) => {
    const names = rows.map(row => `${kindGlyph(row.element.kind)} ${row.element.title}`)
    const nameColumn = Math.max(0, ...names.map(name => name.length)) + 2
    // The row inset each side around the name column and the widest strip of blocks;
    // at least the name with its glyph, a space each side and the two corners.
    const natural = Math.max(island.name.length + 6, 2 * ROW_INSET + nameColumn + Math.max(0, ...rows.map(row => row.blocks.length)))
    const width = Math.min(natural, maxWidth)
    const bar = Math.max(1, width - 2 * ROW_INSET - nameColumn)
    let y = 1
    const rowItems = rows.map((row, index) => {
      const lines = chunks(row.blocks, bar).map((part, line) => `${(line === 0 ? names[index]! : '').padEnd(nameColumn)}${part}`)
      const item: WorldItem = {
        key: row.element.representationId,
        representationId: row.element.representationId,
        id: row.element.id,
        title: row.element.title,
        kind: row.element.kind,
        origin: row.element.origin,
        external: row.element.external,
        shape: 'row',
        lines,
        worldBounds: { x, y, width, height: lines.length },
      }
      y += lines.length
      return item
    })
    const islandItem: WorldItem = {
      key: island.key,
      ...(island.element === null ? {} : { representationId: island.element.representationId, id: island.element.id }),
      title: island.name,
      kind: island.kind === 'actors' ? 'actor' : 'system',
      origin: island.element?.origin ?? 'observed',
      external: island.kind === 'external',
      shape: 'island',
      lines: [],
      worldBounds: { x, y: 0, width, height: y + 2 },
    }
    x += width + ISLAND_GAP
    return [islandItem, ...rowItems]
  })
}
