export function canStart(task: { status: string; dependencies: { status: string }[] }): boolean {
  return task.status === 'todo'
    && task.dependencies.every(dep => dep.status === 'done')
}
