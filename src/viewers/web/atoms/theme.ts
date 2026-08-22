/** Every colour the page and the map use, as CSS variable values; the map's level tints mix paper and ink in its stylesheet. */
export interface Palette {
  paper: string
  ink: string
  muted: string
  hairline: string
  /** Sidebar row hover wash. */
  hover: string
  /** Geometry strokes at rest: faces, grounds, routes and glyphs. */
  line: string
  /** The kind patterns: dots, crosses, storey lines, grain and the zone hatch. */
  hatch: string
  grid: string
  gridMajor: string
}

export const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    paper: '#FFFFFF',
    ink: '#22262E',
    muted: '#585B62',
    hairline: '#E4E6EA',
    hover: 'rgba(34, 38, 46, 0.05)',
    line: '#A2A6AE',
    hatch: '#C4C8CF',
    grid: '#EEF1F6',
    gridMajor: '#E3E6EB',
  },
  dark: {
    paper: '#111315',
    ink: '#E6E8EB',
    muted: '#9AA0A8',
    hairline: '#2A2E33',
    hover: 'rgba(230, 232, 235, 0.08)',
    line: '#6B717A',
    hatch: '#4A5058',
    grid: '#1A1D21',
    gridMajor: '#22262B',
  },
}

/** The one brand green; identical in both themes. */
export const accent = '#1D9E75'

export function cssBlock(palette: Palette): string {
  return `
  --paper: ${palette.paper};
  --ink: ${palette.ink};
  --muted: ${palette.muted};
  --hairline: ${palette.hairline};
  --hover: ${palette.hover};
  --accent: ${accent};
  --map-line: ${palette.line};
  --map-hatch: ${palette.hatch};
  --map-grid: ${palette.grid};
  --map-grid-major: ${palette.gridMajor};
`
}
