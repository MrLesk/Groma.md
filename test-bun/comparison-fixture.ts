import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runGit } from '../src/history/revisions.ts'

export const comparisonFixture = fileURLToPath(new URL('../test/fixtures/comparison/', import.meta.url))
export async function comparisonRepository() {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-comparison-test-'))
  const git = (args: string[]) => runGit(args, root).then(value => value.trim())
  await cp(path.join(comparisonFixture, 'before'), root, { recursive: true })
  await git(['init', '-b', 'main'])
  await git(['config', 'user.name', 'Fixture'])
  await git(['config', 'user.email', 'fixture@example.test'])
  await git(['add', '.'])
  await git(['commit', '-m', 'Initial'])
  const base = await git(['rev-parse', 'HEAD'])
  return {
    root, base, git,
    async changed() {
      for (const directory of ['groma', 'src']) await rm(path.join(root, directory), { recursive: true })
      await cp(path.join(comparisonFixture, 'after'), root, { recursive: true })
    },
    async commit(subject = 'Update') {
      await git(['add', '.']); await git(['commit', '-m', subject])
      return git(['rev-parse', 'HEAD'])
    },
    close: () => rm(root, { recursive: true, force: true }),
  }
}
