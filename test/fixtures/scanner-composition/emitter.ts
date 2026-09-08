export function submit(output: { emit(value: string): void }) {
  output.emit('saved')
}
