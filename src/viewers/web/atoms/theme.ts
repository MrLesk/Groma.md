/** Every colour the page and the map use, as CSS variable values. */
export interface Palette {
  paper: string
  ink: string
  muted: string
  hairline: string
  /** Sidebar row hover wash. */
  hover: string
  /** Geometry strokes at rest: faces, grounds, routes and glyphs. */
  line: string
  /** Roofs, slab tops and the chrome's raised surfaces. */
  deck: string
  faceLeft: string
  faceRight: string
  people: string
  external: string
  /** Pattern strokes: dots, crosses and hatches. */
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
    deck: '#FFFFFF',
    faceLeft: '#EEF1F6',
    faceRight: '#DADBDE',
    people: '#F4F5F7',
    external: '#E9EDF2',
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
    deck: '#1B1E22',
    faceLeft: '#15181B',
    faceRight: '#24282D',
    people: '#171A1D',
    external: '#14181C',
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
  --map-deck: ${palette.deck};
  --map-face-left: ${palette.faceLeft};
  --map-face-right: ${palette.faceRight};
  --map-people: ${palette.people};
  --map-external: ${palette.external};
  --map-hatch: ${palette.hatch};
  --map-grid: ${palette.grid};
  --map-grid-major: ${palette.gridMajor};
`
}
