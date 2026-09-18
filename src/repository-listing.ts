/** The tracked and unignored files of a repository: the boundary scanner discovery and every scan select from. */
export async function repositoryListing(repositoryRoot: string): Promise<string[]> {
  const child = Bun.spawn([
    'git', '-C', repositoryRoot, 'ls-files', '-z', '--cached', '--others', '--exclude-standard',
  ], { stdout: 'pipe', stderr: 'pipe' })
  const [code, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
  ])
  if (code !== 0) throw new Error(stderr.trim() || `git ls-files exited ${code}`)
  return stdout.split('\0').filter(Boolean)
}
