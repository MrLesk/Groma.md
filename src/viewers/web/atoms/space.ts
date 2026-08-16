import { Vector3 } from 'three'

/** World (x, y) on the ground plane, z up. */
export function at(x: number, y: number, z: number): Vector3 {
  return new Vector3(x, z, y)
}
