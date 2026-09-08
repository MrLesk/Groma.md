import type { SheetScene } from '../../src/sheet/types.ts'
import { DEFAULT_PROJECTION, projectScene } from '../../src/viewers/web/iso/project.ts'
import { EXPLODED_POSE } from '../../src/viewers/web/layers/orbit.ts'
import type { LayerPose } from '../../src/viewers/web/layers/orbit.ts'
import { sceneAtSeparation } from '../../src/viewers/web/layers/separation.ts'
import type { LayeredScene } from '../../src/viewers/web/layers/separation.ts'

export type MapView = 'iso' | '2d' | 'layers'
export interface MapViewState { view: MapView; nested: Exclude<MapView, 'layers'> }
export const INITIAL_VIEW: MapViewState = { view: 'iso', nested: 'iso' }
export const PLAN_PROJECTION = { yaw: 0, pitch: 90 }

/** Layers is an inspection detour, not a replacement for the last editing plane. */
export function chooseMapView(state: MapViewState, view: MapView): MapViewState {
  return { view, nested: view === 'layers' ? state.nested : view }
}
export function toggleLayers(state: MapViewState): MapViewState {
  return chooseMapView(state, state.view === 'layers' ? state.nested : 'layers')
}

/** Flatten only the presentation. Original source floors, rectangles and routes stay on the sheet. */
function topDown(sheet: SheetScene): LayeredScene {
  const flat: SheetScene = {
    ...sheet,
    buildings: sheet.buildings.map(building => ({
      ...building,
      heightUnits: 0,
      floors: building.kind !== 'component' ? [] : [{
        files: building.floors.flatMap(floor => floor.files),
        facadeFileType: building.floors[0]?.facadeFileType ?? '',
        heightUnits: 0,
        footprint: { w: building.rect.w, d: building.rect.d },
      }],
    })),
  }
  const projected = projectScene(flat, undefined, PLAN_PROJECTION)
  return sceneAtSeparation({
    ...projected,
    slabs: projected.slabs.map(item => ({ ...item, faces: item.faces.filter(face => face.side === 'top') })),
    buildings: projected.buildings.map(item => ({
      ...item, floors: item.floors.map(floor => floor.filter(face => face.side === 'top')),
    })),
  }, 0)
}

/** All modes consume the same composed sheet: no view-specific packing or routing. */
export function presentSheet(sheet: SheetScene, view: MapView, orbit: LayerPose = EXPLODED_POSE): LayeredScene {
  if (view === '2d') return topDown(sheet)
  return sceneAtSeparation(
    projectScene(sheet, undefined, view === 'layers' ? orbit : DEFAULT_PROJECTION),
    view === 'layers' ? 1 : 0,
  )
}
