import { GROMA_ACCENT, GROMA_ACCENT_ON_LIGHT } from '../../../brand.ts'

/** Every colour the page and the map use, as CSS variable values; the map's level tints mix paper and ink in its stylesheet. */
export interface Palette {
  paper: string
  ink: string
  muted: string
  /** Brand or positive-status green used as text on paper; light paper needs the darker green. */
  accentText: string
  /** Durable interaction emphasis: selection, focus and active flows. */
  highlight: string
  /** Interaction emphasis used as text on paper. */
  highlightText: string
  hairline: string
  /** Sidebar row hover wash. */
  hover: string
  /** Geometry strokes at rest: faces, grounds, routes and glyphs. */
  line: string
  /** The kind patterns: dots, crosses, storey lines, grain and the zone hatch. */
  hatch: string
  syntaxComment: string
  syntaxFunction: string
  syntaxKeyword: string
  syntaxNumber: string
  syntaxString: string
  syntaxType: string
  diffAdded: string
  diffRemoved: string
}

export type WebTheme = 'light' | 'dark' | 'blueprint'

export const palettes: Record<WebTheme, Palette> = {
  light: {
    paper: '#FFFFFF',
    ink: '#22262E',
    muted: '#585B62',
    accentText: GROMA_ACCENT_ON_LIGHT,
    highlight: '#1D9E75',
    highlightText: '#147A59',
    hairline: '#E4E6EA',
    hover: 'rgba(34, 38, 46, 0.05)',
    line: '#A2A6AE',
    hatch: '#C4C8CF',
    syntaxComment: '#7A8190',
    syntaxFunction: '#087F8C',
    syntaxKeyword: '#7C3AED',
    syntaxNumber: '#C2410C',
    syntaxString: '#0E7C55',
    syntaxType: '#2563EB',
    diffAdded: '#147A59',
    diffRemoved: '#B42318',
  },
  dark: {
    paper: '#111315',
    ink: '#E6E8EB',
    muted: '#9AA0A8',
    accentText: GROMA_ACCENT,
    highlight: GROMA_ACCENT,
    highlightText: GROMA_ACCENT,
    hairline: '#2A2E33',
    hover: 'rgba(230, 232, 235, 0.08)',
    line: '#6B717A',
    hatch: '#4A5058',
    syntaxComment: '#7D8590',
    syntaxFunction: '#FFD866',
    syntaxKeyword: '#FF6BCB',
    syntaxNumber: '#FFA657',
    syntaxString: '#7EE787',
    syntaxType: '#79C0FF',
    diffAdded: '#3FB950',
    diffRemoved: '#FF7B72',
  },
  blueprint: {
    paper: '#04182B',
    ink: '#D8F3FF',
    muted: '#79A9BD',
    accentText: GROMA_ACCENT,
    highlight: '#D8F3FF',
    highlightText: '#D8F3FF',
    hairline: '#164764',
    hover: 'rgba(89, 203, 244, 0.09)',
    line: '#64B7D6',
    hatch: '#2B6C88',
    syntaxComment: '#6E9CB0',
    syntaxFunction: '#FFFFFF',
    syntaxKeyword: '#FFE066',
    syntaxNumber: '#FF8FAB',
    syntaxString: '#70E1F5',
    syntaxType: '#D9B8FF',
    diffAdded: '#70E1F5',
    diffRemoved: '#FF8FAB',
  },
}

const nextThemes: Record<WebTheme, WebTheme> = {
  light: 'dark',
  dark: 'blueprint',
  blueprint: 'light',
}

/** The next theme activated by the header control. */
export function nextTheme(theme: WebTheme): WebTheme {
  return nextThemes[theme]
}

/** The short control label for a theme. */
export function themeLabel(theme: WebTheme): string {
  return theme[0]!.toUpperCase() + theme.slice(1)
}

/** Brand signals shared by every theme. */
export const accent = GROMA_ACCENT
/** Dark foreground for saturated accent and work-marker surfaces. */
export const onColour = '#020B12'

export function cssBlock(palette: Palette): string {
  return `
  --paper: ${palette.paper};
  --ink: ${palette.ink};
  --muted: ${palette.muted};
  --hairline: ${palette.hairline};
  --hover: ${palette.hover};
  --accent: ${accent};
  --accent-text: ${palette.accentText};
  --highlight: ${palette.highlight};
  --highlight-text: ${palette.highlightText};
  --on-colour: ${onColour};
  --map-line: ${palette.line};
  --map-hatch: ${palette.hatch};
  --syntax-comment: ${palette.syntaxComment};
  --syntax-function: ${palette.syntaxFunction};
  --syntax-keyword: ${palette.syntaxKeyword};
  --syntax-number: ${palette.syntaxNumber};
  --syntax-string: ${palette.syntaxString};
  --syntax-type: ${palette.syntaxType};
  --diff-added: ${palette.diffAdded};
  --diff-removed: ${palette.diffRemoved};
  --map-grid: color-mix(in srgb, var(--paper) 88%, var(--map-line));
  --map-grid-major: color-mix(in srgb, var(--paper) 80%, var(--map-line));
`
}
