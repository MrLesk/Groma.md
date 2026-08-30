import type { ElementWorkGroup, WorkStage } from '../../../work/pins.ts'

const stageLabel: Record<WorkStage, string> = {
  todo: 'To do',
  progress: 'In progress',
  done: 'Done',
}

/** Paints the tasks linked to one component inside the shared Details tabs. */
export function paintElementWork(
  body: Element,
  groups: readonly ElementWorkGroup[],
  onTask: (id: string) => void,
): void {
  for (const group of groups) {
    const heading = document.createElement('h2')
    heading.className = 'section'
    heading.textContent = `${stageLabel[group.stage]} · ${group.items.length}`
    const list = document.createElement('ul')
    list.className = 'work-detail-list'
    for (const task of group.items) {
      const item = document.createElement('li')
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'work-detail-task'
      button.setAttribute('aria-label', `Open ${task.id}: ${task.title}`)
      button.addEventListener('click', () => onTask(task.id))
      const id = document.createElement('span')
      id.className = 'work-detail-id'
      id.textContent = task.id
      const title = document.createElement('span')
      title.textContent = task.title
      button.append(id, title)
      item.append(button)
      list.append(item)
    }
    body.append(heading, list)
  }
}

export const workDetailsCss = `
  #details .work-detail-list li { margin: 0; }
  #details .work-detail-task { background: transparent; border: 0; border-bottom: 1px solid var(--hairline); color: inherit; display: grid; gap: 10px; grid-template-columns: auto minmax(0, 1fr); padding: 9px 0; text-align: left; width: 100%; }
  #details .work-detail-task:hover { background: var(--hover); }
  #details .work-detail-id { color: var(--muted); }
`
