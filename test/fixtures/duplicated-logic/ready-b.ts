export function readyToRun(item: { status: string; dependencies: { status: string }[] }): boolean {
  return item.status === 'todo'
    && item.dependencies.every(parent => parent.status === 'done')
}
