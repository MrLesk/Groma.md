/** Every colour the page and the map use, as CSS variable values. */
export interface Palette {
  paper: string
  ink: string
  muted: string
  hairline: string
  /** Sidebar row hover wash. */
  hover: string
  /** Roofs, slab decks and the chrome's raised surfaces. */
  deck: string
  faceLeft: string
  faceRight: string
  people: string
  external: string
  /** Pattern strokes: dots, crosses and hatches. */
  hatch: string
  grid: string
  gridMajor: string
  frame: string
  /** Fill of a selected roof. */
  accentWash: string
}

export const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    paper: '#FAF8F2',
    ink: '#26251D',
    muted: '#5D6167',
    hairline: '#D9D6CB',
    hover: 'rgba(38, 37, 29, 0.05)',
    deck: '#FFFFFF',
    faceLeft: '#ECEAE2',
    faceRight: '#DAD7CC',
    people: '#F4EFE3',
    external: '#EBEDEE',
    hatch: '#C9C5B8',
    grid: '#ECE9DF',
    gridMajor: '#DDD9CC',
    frame: '#B8B4A6',
    accentWash: 'rgba(29, 158, 117, 0.12)',
  },
  dark: {
    paper: '#14130F',
    ink: '#E9E6DC',
    muted: '#9DA1A6',
    hairline: '#3A382F',
    hover: 'rgba(233, 230, 220, 0.08)',
    deck: '#24231B',
    faceLeft: '#1C1B14',
    faceRight: '#2E2D24',
    people: '#1B1913',
    external: '#15181A',
    hatch: '#56544A',
    grid: '#22211A',
    gridMajor: '#2B2A22',
    frame: '#4A483F',
    accentWash: 'rgba(29, 158, 117, 0.18)',
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
  --accent-wash: ${palette.accentWash};
  --map-deck: ${palette.deck};
  --map-face-left: ${palette.faceLeft};
  --map-face-right: ${palette.faceRight};
  --map-people: ${palette.people};
  --map-external: ${palette.external};
  --map-hatch: ${palette.hatch};
  --map-grid: ${palette.grid};
  --map-grid-major: ${palette.gridMajor};
  --map-frame: ${palette.frame};
`
}
