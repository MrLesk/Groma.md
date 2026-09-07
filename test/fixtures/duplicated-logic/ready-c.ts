export function readyWithoutStatus(item: { status: string; dependencies: { status: string }[] }): boolean {
  return item.dependencies.every(parent => parent.status === 'done')
}
