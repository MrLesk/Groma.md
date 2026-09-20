import { readFileSync } from 'node:fs'
import regular from './DejaVuSansMono.ttf' with { type: 'file' }
import bold from './DejaVuSansMono-Bold.ttf' with { type: 'file' }
import italic from './DejaVuSansMono-Oblique.ttf' with { type: 'file' }
import boldItalic from './DejaVuSansMono-BoldOblique.ttf' with { type: 'file' }
import sans from './DejaVuSans.ttf' with { type: 'file' }
import license from './LICENSE' with { type: 'text' }

/** The map's regular, strong and emphasized text and the existing sans-serif wordmark. */
const faces = [
  { path: regular, family: 'DejaVu Sans Mono', weight: 400, style: 'normal' },
  { path: bold, family: 'DejaVu Sans Mono', weight: 700, style: 'normal' },
  { path: italic, family: 'DejaVu Sans Mono', weight: 400, style: 'italic' },
  { path: boldItalic, family: 'DejaVu Sans Mono', weight: 700, style: 'italic' },
  { path: sans, family: 'DejaVu Sans', weight: 400, style: 'normal' },
].map(face => ({ ...face, bytes: readFileSync(face.path) }))

/** Explicit font bytes also travel inside the compiled CLI; image generation never searches the host. */
export const fontBuffers = faces.map(face => face.bytes)

/** Inline fonts make the live page and static directory self-contained, including the redistribution notice. */
export const fontCss = `/* DejaVu fonts: https://dejavu-fonts.github.io/\n${license} */\n${faces.map(face =>
  `@font-face { font-family: '${face.family}'; font-weight: ${face.weight}; font-style: ${face.style};
    src: url(data:font/ttf;base64,${face.bytes.toString('base64')}) format('truetype'); }`).join('\n')}`
