const names: Record<string, string> = {
  typescript: 'TypeScript', javascript: 'JavaScript', csharp: 'C#', php: 'PHP',
}

export function scannerName(id: string): string {
  return names[id] ?? id.charAt(0).toUpperCase() + id.slice(1)
}
