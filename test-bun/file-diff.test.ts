import { expect, test } from 'bun:test'
import { projectFileDiff } from '../src/viewers/source/diff-lines.ts'

test.concurrent('a unified diff preserves context and independent old and new line numbers', () => {
  const file = projectFileDiff('receipt.fixture', 'first\nold\nlast\n', 'first\nnew\nextra\nlast\n')
  expect(file.status).toBe('modified')
  expect([file.additions, file.deletions]).toEqual([2, 1])
  expect(file.hunks.flatMap(hunk => hunk.lines)).toEqual([
    { kind: 'context', oldLine: 1, newLine: 1, text: 'first' },
    { kind: 'removed', oldLine: 2, text: 'old' },
    { kind: 'added', newLine: 2, text: 'new' },
    { kind: 'added', newLine: 3, text: 'extra' },
    { kind: 'context', oldLine: 3, newLine: 4, text: 'last' },
  ])
})

test.concurrent('added and removed files include complete content while unchanged files have no hunks', () => {
  const content = `${Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join('\n')}\n`
  const added = projectFileDiff('receipt.fixture', undefined, content)
  const removed = projectFileDiff('receipt.fixture', content, undefined)
  expect(added.status).toBe('added')
  expect(removed.status).toBe('removed')
  expect(added.hunks.flatMap(hunk => hunk.lines).map(line => line.text).join('\n')).toBe(content.trimEnd())
  expect(removed.hunks.flatMap(hunk => hunk.lines).map(line => line.text).join('\n')).toBe(content.trimEnd())
  expect(added.additions).toBe(12)
  expect(removed.deletions).toBe(12)
  expect(added.hunks.flatMap(hunk => hunk.lines).every(line => line.kind === 'added' && line.oldLine === undefined)).toBe(true)
  expect(removed.hunks.flatMap(hunk => hunk.lines).every(line => line.kind === 'removed' && line.newLine === undefined)).toBe(true)
  expect(projectFileDiff('receipt.fixture', content, content).hunks).toEqual([])
})
