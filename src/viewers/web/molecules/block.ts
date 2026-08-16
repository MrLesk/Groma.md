import {
  BoxGeometry,
  Color,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
} from 'three'
import type { WorldElement } from '../../../types.ts'
import { drawName, labelPlane } from '../atoms/label.ts'
import { at } from '../atoms/space.ts'
import { ink, raised } from '../atoms/theme.ts'
import { sideMaterial } from './hatch.ts'

const labelSizes = { person: 4.5, system: 5.5, container: 5, component: 4.5 } as const

export interface CityPick {
  mesh: Mesh
  material: LineBasicMaterial | LineDashedMaterial
  ink: Color
  element: WorldElement
}

function addBlock(
  parent: Group,
  element: WorldElement,
  bottom: number,
  top: number,
  label: Mesh,
): CityPick {
  const { x, y, width, height } = element.bounds
  const thickness = Math.max(top - bottom, 0.4)
  const geometry = new BoxGeometry(width, thickness, height)
  const materials = [
    sideMaterial(element.kind, height, thickness, true),
    sideMaterial(element.kind, height, thickness, true),
    new MeshBasicMaterial({ color: raised }),
    new MeshBasicMaterial({ color: raised }),
    sideMaterial(element.kind, width, thickness, false),
    sideMaterial(element.kind, width, thickness, false),
  ]
  const mesh = new Mesh(geometry, materials)
  mesh.position.copy(at(x + width / 2, y + height / 2, bottom + thickness / 2))

  const ghost = element.origin !== 'observed'
  const outlineMaterial = ghost
    ? new LineDashedMaterial({ color: ink, dashSize: 2, gapSize: 1.5 })
    : new LineBasicMaterial({ color: ink })
  const outline = new LineSegments(new EdgesGeometry(geometry), outlineMaterial)
  outline.position.copy(mesh.position)
  if (ghost) outline.computeLineDistances()

  const block = new Group()
  block.add(mesh, outline, label)
  if (element.kind === 'person') {
    const head = new Mesh(new SphereGeometry(3.5, 16, 12), new MeshBasicMaterial({ color: ink }))
    head.position.copy(at(x + width / 2, y + height / 2 - 7, top + 3.5))
    block.add(head)
  }
  parent.add(block)

  return { mesh, material: outlineMaterial, ink: new Color(ink), element }
}

export function addSlab(
  parent: Group,
  element: WorldElement,
  bottom: number,
  top: number,
): CityPick {
  return addBlock(parent, element, bottom, top, labelPlane(element.bounds, top, (ctx, scale) => {
    drawName(ctx, scale, element.bounds, element.name.toUpperCase(), 5, 'start', 0.65)
  }))
}

export function addPrism(
  parent: Group,
  element: WorldElement,
  bottom: number,
  top: number,
): CityPick {
  return addBlock(parent, element, bottom, top, labelPlane(element.bounds, top, (ctx, scale) => {
    drawName(ctx, scale, element.bounds, element.name, labelSizes[element.kind], 'center')
  }))
}
