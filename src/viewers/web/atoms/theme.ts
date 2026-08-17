export const paper = 0xFAF8F2
export const raised = 0xFFFFFF
export const ink = 0x26251D
export const accent = 0x1D9E75

/** Pencil-weight hatch strokes on block faces. */
export const hatchLine = 0x8F8C80
/** Survey grid ruled under the sheet. */
export const gridLine = 0xDDD9CC
/** Tint for block faces turned away from the light. */
export const shade = 0xECEAE2

export function css(color: number): string {
  return `#${color.toString(16).padStart(6, '0').toUpperCase()}`
}

export const cssVars = `
  --paper: ${css(paper)};
  --ink: ${css(ink)};
  --muted: #5D6167;
  --hairline: #D9D6CB;
  --accent: ${css(accent)};
`
