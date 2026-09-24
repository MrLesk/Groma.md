/** A repository-relative file inside a repository-relative directory; the empty directory is the repository root. */
export function isUnder(file: string, directory: string): boolean {
  return directory === '' || file.startsWith(`${directory}/`)
}
