function initials(name: string): string {
  return name.slice(0, 1)
}

export function greeting(name: string): string {
  return `Hello ${initials(name)}`
}
