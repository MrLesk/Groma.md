/** The camera state shown beside the 2D/3D controls. Web zoom 1 is fit. */
export function zoomReadout(zoom: number): string {
  if (Math.abs(zoom - 1) < 1e-6) return 'fit'
  return `${Math.round(zoom * 100)}%`
}
