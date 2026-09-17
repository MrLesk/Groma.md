import { expect, test } from 'bun:test'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { agentGuideNames, readAgentGuide } from '../src/agent-instructions.ts'

const guideDirectory = path.resolve(import.meta.dir, '../docs/agent-instructions')

test.concurrent('the agent guide index names every shipped guide, and each guide prints by name', async () => {
  const shipped = (await readdir(guideDirectory))
    .filter(file => file.endsWith('.md') && file !== 'index.md')
    .map(file => file.slice(0, -'.md'.length))
  expect(shipped.toSorted()).toEqual([...agentGuideNames].toSorted())
  const index = await readAgentGuide(undefined)
  const named = [...(index ?? '').matchAll(/`groma agent-instructions ([a-z-]+)`/g)].map(match => match[1])
  expect(named.toSorted()).toEqual([...agentGuideNames].toSorted())
  expect(await readAgentGuide('unknown')).toBeUndefined()
})
