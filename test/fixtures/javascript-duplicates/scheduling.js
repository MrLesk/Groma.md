// The same selection under scheduling names.

export function scheduleTasks(tasks, threshold) {
  const selected = []
  for (const task of tasks) {
    if (task.count > threshold) selected.push(task.name)
  }
  return selected.sort()
}
