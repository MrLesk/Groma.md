import type { ProjectProfile } from '../../../project-profile.ts'
import { escaped } from '../atoms/escape.ts'
import { resolveTheme, type WebTheme } from '../atoms/theme.ts'
import { readTheme } from '../url.ts'
import { COVER_SIZE } from './cover.ts'

export function coverFile(theme: WebTheme): string {
  return `cover-${theme}.png`
}

/** A crawler has no system preference: Auto uses the light cover. */
export function coverTheme(url: URL): WebTheme {
  return resolveTheme(readTheme(url), false)
}

/** Emitted in the initial HTML, before any browser script or saved preference. */
export function sharingMetadata(project: ProjectProfile | null, url?: URL): string {
  const title = project?.title ?? 'Groma'
  const theme = url === undefined ? 'light' : coverTheme(url)
  const file = coverFile(theme)
  const fields: [string, string][] = [
    ['og:title', title],
    ['og:type', 'website'],
    ['og:image', url === undefined ? `./${file}` : new URL(file, url).href],
    ['og:image:type', 'image/png'],
    ['og:image:width', String(COVER_SIZE.width)],
    ['og:image:height', String(COVER_SIZE.height)],
    ['og:image:alt', `${title} architecture map`],
  ]
  if (url !== undefined) fields.push(['og:url', url.href])
  if (project?.description) fields.push(['og:description', project.description])
  return fields.map(([property, content]) => `<meta property="${property}" content="${escaped(content)}">`).join('')
    + '<meta name="twitter:card" content="summary_large_image">'
}
