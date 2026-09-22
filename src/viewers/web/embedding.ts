/**
 * A page that shows the map in an iframe, such as a slide deck or a documentation site, can open
 * another view without reloading it. It posts `{ gromaView: '?component=<id>&tab=how' }` to the
 * iframe, using the same query string the map writes into its own URL. The map posts
 * `{ gromaReady: true }` to that page once it can take views.
 *
 * Only the parent window is heard, and only when there is one: a map opened directly has no parent
 * and ignores every message.
 */
export function listenForEmbeddedViews(page: Window, openView: (search: string) => void): void {
  if (page.parent === page) return
  page.addEventListener('message', event => {
    if (event.source !== page.parent) return
    const view = (event.data as { gromaView?: unknown } | null)?.gromaView
    if (typeof view === 'string') openView(view)
  })
  page.parent.postMessage({ gromaReady: true }, '*')
}
