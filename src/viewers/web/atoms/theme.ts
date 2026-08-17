export interface Palette {
  paper: number
  raised: number
  ink: number
  /** Pencil-weight hatch strokes on block faces. */
  hatchLine: number
  /** Tint for block faces turned away from the light. */
  shade: number
  /** Survey grid ruled under the sheet. */
  gridLine: number
  /** Penumbra fill that grounds a root element. */
  shadowInk: string
  muted: string
  hairline: string
  /** Sidebar row hover wash. */
  hover: string
}

export const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    paper: 0xFAF8F2,
    raised: 0xFFFFFF,
    ink: 0x26251D,
    hatchLine: 0x8F8C80,
    shade: 0xECEAE2,
    gridLine: 0xDDD9CC,
    shadowInk: 'rgba(38, 37, 29, 0.25)',
    muted: '#5D6167',
    hairline: '#D9D6CB',
    hover: 'rgba(38, 37, 29, 0.05)',
  },
  dark: {
    paper: 0x14130F,
    raised: 0x24231B,
    ink: 0xE9E6DC,
    hatchLine: 0x6E6B60,
    shade: 0x1C1B14,
    gridLine: 0x2B2A22,
    shadowInk: 'rgba(0, 0, 0, 0.5)',
    muted: '#9DA1A6',
    hairline: '#3A382F',
    hover: 'rgba(233, 230, 220, 0.08)',
  },
}

/** The one brand green; identical in both themes. */
export const accent = 0x1D9E75

// The current palette as live bindings: the city reads these while it
// builds, so a theme switch is setPalette plus one rebuild.
export let paper = palettes.light.paper
export let raised = palettes.light.raised
export let ink = palettes.light.ink
export let hatchLine = palettes.light.hatchLine
export let shade = palettes.light.shade
export let gridLine = palettes.light.gridLine
export let shadowInk = palettes.light.shadowInk

export function setPalette(palette: Palette): void {
  paper = palette.paper
  raised = palette.raised
  ink = palette.ink
  hatchLine = palette.hatchLine
  shade = palette.shade
  gridLine = palette.gridLine
  shadowInk = palette.shadowInk
}

export function css(color: number): string {
  return `#${color.toString(16).padStart(6, '0').toUpperCase()}`
}

export function cssBlock(palette: Palette): string {
  return `
  --paper: ${css(palette.paper)};
  --ink: ${css(palette.ink)};
  --muted: ${palette.muted};
  --hairline: ${palette.hairline};
  --hover: ${palette.hover};
  --accent: ${css(accent)};
`
}
