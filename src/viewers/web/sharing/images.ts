import { launch } from 'puppeteer-core'
import { themeModes, type WebTheme } from '../atoms/theme.ts'
import { bundleRenderer } from '../runtime.ts'
import { COVER_SIZE, renderCover, type CoverPayload } from './cover.ts'

export const coverThemes = themeModes.filter(theme => theme !== 'auto')
export type CoverImages = Record<WebTheme, Uint8Array<ArrayBuffer>>

/** One browser renders the real web map for both export and live image requests. */
export async function generateCovers(payload: CoverPayload): Promise<CoverImages> {
  const renderer = await bundleRenderer('cover')
  const browser = await launch({
    ...(process.env.GROMA_CHROME === undefined ? { channel: 'chrome' } : { executablePath: process.env.GROMA_CHROME }),
    headless: true,
    defaultViewport: COVER_SIZE,
  })
  try {
    const images = {} as CoverImages
    for (const theme of coverThemes) {
      const page = await browser.newPage()
      await page.setContent(renderCover(payload, theme, renderer))
      await page.waitForSelector('html[data-cover-ready="true"]')
      images[theme] = new Uint8Array(await page.screenshot({ type: 'png' }))
      await page.close()
    }
    return images
  } finally {
    await browser.close()
  }
}
