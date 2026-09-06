export function run(actions: { deliver(value: string): string }): string {
  return actions.deliver('result')
}
