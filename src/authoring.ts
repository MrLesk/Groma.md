import { addThing } from './add.ts'
import type { AddInput } from './add.ts'
import { acceptGhost } from './accept.ts'
import { draftElement } from './draft.ts'
import type { DraftElementInput } from './draft.ts'
import { editArchitecture } from './edit.ts'
import type { EditArchitectureInput } from './edit.ts'
import { removeThing } from './remove.ts'
import type { RemoveInput } from './remove.ts'

export interface AcceptInput {
  id: string
}

export type { AddInput, DraftElementInput, EditArchitectureInput, RemoveInput }

async function acceptThing(repositoryRoot: string, input: AcceptInput): Promise<string> {
  const result = await acceptGhost(repositoryRoot, input.id)
  if (result === 'not-draft') throw new Error('not a draft')
  if (result === 'unmatched') throw new Error('no scan match')
  return input.id
}

/** The writes the web shares with the CLI, by verb. The CLI builds each input from its flags and the web posts the same input. */
export const writes = {
  draft: draftElement,
  add: addThing,
  edit: editArchitecture,
  remove: removeThing,
  accept: acceptThing,
}
