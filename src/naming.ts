export function kebabCase(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function displayName(kebab: string): string {
  const words = kebab.split('-').filter(Boolean)
  if (words.length === 0) return kebab
  const [first, ...rest] = words
  return [first[0].toUpperCase() + first.slice(1), ...rest].join(' ')
}

/** The text a flag must carry; a missing or blank value names the flag. */
export function requireText(value: string | undefined, flag: string): string {
  if (value === undefined || value.trim().length === 0) throw new Error(`${flag} is required`)
  return value
}
