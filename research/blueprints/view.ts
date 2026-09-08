import { sheetScene } from '../../src/sheet/scene.ts'
import type { ArchitectureGraph } from '../../src/types.ts'
import { createMap } from '../../src/viewers/web/iso/map.ts'
import { projectScene } from '../../src/viewers/web/iso/project.ts'
import { fitCamera } from '../../src/viewers/web/iso/camera.ts'
import { sceneAtSeparation } from '../../src/viewers/web/layers/separation.ts'
import lockup from '../../src/viewers/web/atoms/lockup.svg' with { type: 'text' }
import type { Draft, Project } from './model.ts'

export { lockup }
export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!))
export function button(label: string, action: string, kind = '', attributes = ''): string {
  return `<button type="button" class="${kind}" data-action="${action}" ${attributes}>${label}</button>`
}
export function graphFor(project: Project, draft?: Draft): ArchitectureGraph {
  const all = [...project.elements, ...(draft?.parts ?? [])]
  return {
    flows: [],
    elements: all.map(element => ({
      representationId: element.id, id: element.id, kind: element.kind, title: element.title,
      parent: element.parent, children: all.filter(child => child.parent === element.id).map(child => child.id),
      overview: element.overview, code: structuredClone(element.code), codeLines: element.codeLines, external: element.external,
      origin: element.status === 'draft' ? 'draft' : 'observed',
    })),
    relationships: structuredClone([...project.relationships, ...(draft?.relationships ?? [])]),
  }
}
/** Uses Groma's unmodified sheet composition, projection, map painter and camera. */
export function studyMap(host: HTMLElement, onSelect: (id: string) => void) {
  const map = createMap(host)
  let bounds: ReturnType<typeof projectScene>['bounds'] | undefined
  function fit(): void {
    if (!bounds || host.clientWidth === 0) return
    map.move(fitCamera(bounds, { width: host.clientWidth, height: host.clientHeight }), 1)
  }
  host.addEventListener('click', event => {
    const id = map.hitId(event.target)
    if (id) onSelect(id)
  })
  const observer = new ResizeObserver(fit)
  observer.observe(host)
  return {
    fit,
    paint(project: Project, draft?: Draft): void {
      const scene = sceneAtSeparation(projectScene(sheetScene(graphFor(project, draft))), 0)
      bounds = scene.bounds
      map.paint(scene)
      map.select(draft ? [...Object.values(draft.bindings), ...draft.parts.map(part => part.id)] : [])
      fit()
    },
  }
}
export function hierarchy(project: Project, draft?: Draft): string {
  const nodes = [...project.elements, ...(draft?.parts ?? [])]
  function children(parent: string | null, level: number): string {
    return nodes.filter(node => node.parent === parent).map(node => {
      const affected = draft && Object.values(draft.bindings).includes(node.id)
      return `<button class="tree-row ${node.status === 'draft' ? 'ghost-row' : ''}" style="--level:${level}" data-element="${escapeHtml(node.id)}">
        <span class="kind-mark ${node.status === 'draft' ? 'ghost' : ''}"></span><span>${escapeHtml(node.title)}</span>${affected ? '<span class="participates">↗</span>' : ''}</button>${children(node.id, level + 1)}`
    }).join('')
  }
  return `<div class="section-label">Structure</div>${children(null, 0)}`
}
