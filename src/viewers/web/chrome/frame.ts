import { welcomeCard } from './empty.ts'

interface Rect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface MapFrame {
  x: number
  y: number
  width: number
  height: number
}

/** The page elements whose boxes limit the camera frame. */
export interface FrameHosts {
  host: HTMLElement
  headerHost: HTMLElement
  hierarchyHost: HTMLElement
  detailsHost: HTMLElement
  detailsDock: HTMLElement
  emptyHost: HTMLElement
}

/** The camera frame measured from the page now: the whole map, or the safe area between visible chrome. */
export function measureFrame(hosts: FrameHosts, hudVisible: boolean): MapFrame {
  return mapFrame(
    hosts.host.getBoundingClientRect(),
    hosts.headerHost.getBoundingClientRect(),
    hosts.hierarchyHost.getBoundingClientRect(),
    { left: hosts.detailsDock.offsetLeft, hidden: hosts.detailsHost.inert },
    hudVisible,
    welcomeCard(hosts.emptyHost),
  )
}

/** The camera frame is either the whole map or the safe area between visible chrome, below a welcome card standing over it. */
export function mapFrame(
  map: Rect,
  header: Rect,
  hierarchy: Rect,
  details: { left: number; hidden: boolean },
  hudVisible: boolean,
  welcome?: { bottom: number },
): MapFrame {
  const safe = hudVisible
    ? {
      x: hierarchy.right - map.left + 12,
      y: header.bottom - map.top + 12,
      right: details.hidden ? map.width : details.left - map.left - 12,
      bottom: map.height - 12,
    }
    : { x: 0, y: 0, right: map.width, bottom: map.height }
  const y = welcome === undefined ? safe.y : Math.max(safe.y, welcome.bottom - map.top + 12)
  return {
    x: safe.x,
    y,
    width: Math.max(safe.right - safe.x, 1),
    height: Math.max(safe.bottom - y, 1),
  }
}
