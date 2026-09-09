import type { ProjectProfile } from '../../../project-profile.ts'
import type { SheetScene } from '../../../sheet/types.ts'
import type { LayerPose, MapView } from '../layers/orbit.ts'
import { OVERHEAD_POSE } from '../layers/orbit.ts'
import { sceneAtSeparation, type LayeredScene } from '../layers/separation.ts'
import { projectScene } from './project.ts'

/** One footprint per element in plan view; the composed sheet and its source evidence remain untouched. */
function overhead(sheet: SheetScene, profile: ProjectProfile | undefined): LayeredScene {
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
  const projected = projectScene(flat, profile, OVERHEAD_POSE)
  return sceneAtSeparation({
    ...projected,
    slabs: projected.slabs.map(item => ({ ...item, faces: item.faces.filter(face => face.side === 'top') })),
    buildings: projected.buildings.map(item => ({
      ...item, floors: item.floors.map(floor => floor.filter(face => face.side === 'top')),
    })),
  }, 0)
}

/** Every view projects the same layout, identities and directed routes. */
export function presentScene(
  sheet: SheetScene,
  profile: ProjectProfile | undefined,
  view: MapView,
  pose: LayerPose,
): LayeredScene {
  return view === '2d'
    ? overhead(sheet, profile)
    : sceneAtSeparation(projectScene(sheet, profile, pose), pose.separation)
}
