import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ArchitectureModelError,
  buildArchitectureModel,
} from '../src/architecture-model.ts'
import { elementDocument, relationshipDocument } from './architecture-model-helpers.ts'

for (const {
  name,
  documents,
  code,
  sourceFilename,
} of [
  {
    name: 'reports a container inside an external system',
    documents: [
      elementDocument({
        id: 'vault',
        kind: 'system',
        sourceFilename: 'groma/externals/vault.md',
      }),
      elementDocument({
        id: 'safe',
        kind: 'container',
        parent: 'vault',
        sourceFilename: 'groma/systems/vault/containers/safe/container.md',
      }),
    ],
    code: 'INVALID_PARENT',
    sourceFilename: 'groma/systems/vault/containers/safe/container.md',
  },
  {
    name: 'reports a duplicate stable id at the second document',
    documents: [
      elementDocument({
        id: 'same-id',
        kind: 'actor',
        sourceFilename: 'groma/actors/first.md',
      }),
      elementDocument({
        id: 'same-id',
        kind: 'system',
        sourceFilename: 'groma/systems/second/system.md',
      }),
    ],
    code: 'DUPLICATE_ID',
    sourceFilename: 'groma/systems/second/system.md',
  },
  {
    name: 'reports an unknown parent id at the contained document',
    documents: [
      elementDocument({
        id: 'orphan',
        kind: 'container',
        parent: 'missing-system',
        sourceFilename: 'groma/systems/groma/containers/orphan/container.md',
      }),
    ],
    code: 'UNKNOWN_PARENT_ID',
    sourceFilename: 'groma/systems/groma/containers/orphan/container.md',
  },
  {
    name: 'reports a parent with the wrong C4 kind',
    documents: [
      elementDocument({
        id: 'actor-parent',
        kind: 'actor',
        sourceFilename: 'groma/actors/actor-parent.md',
      }),
      elementDocument({
        id: 'wrongly-contained',
        kind: 'container',
        parent: 'actor-parent',
        sourceFilename: 'groma/systems/groma/containers/wrong/container.md',
      }),
    ],
    code: 'INVALID_PARENT',
    sourceFilename: 'groma/systems/groma/containers/wrong/container.md',
  },
  {
    name: 'reports a root C4 element that declares a parent',
    documents: [
      elementDocument({
        id: 'nested-actor',
        kind: 'actor',
        parent: 'some-system',
        sourceFilename: 'groma/actors/nested-actor.md',
      }),
    ],
    code: 'INVALID_PARENT',
    sourceFilename: 'groma/actors/nested-actor.md',
  },
  {
    name: 'reports a contained C4 element with an omitted parent',
    documents: [
      elementDocument({
        id: 'missing-parent-container',
        kind: 'container',
        sourceFilename: 'groma/systems/groma/containers/missing/container.md',
      }),
    ],
    code: 'INVALID_PARENT',
    sourceFilename: 'groma/systems/groma/containers/missing/container.md',
  },
  {
    name: 'reports an unresolved relationship link at its source document',
    documents: [
      elementDocument({
        id: 'architect',
        kind: 'actor',
        sourceFilename: 'groma/actors/architect.md',
      }),
      relationshipDocument([{
          sourceHref: 'actors/architect.md',
          href: 'systems/missing/system.md',
          description: 'Uses missing software',
          technology: 'Browser',
        }]),
    ],
    code: 'UNKNOWN_RELATIONSHIP_TARGET',
    sourceFilename: 'groma/relationships.md',
  },
]) {
  test(name, { concurrency: true }, () => {
    assert.throws(
      () => buildArchitectureModel(documents),
      error => {
        assert.ok(error instanceof ArchitectureModelError)
        assert.equal(error.code, code)
        assert.equal(error.sourceFilename, sourceFilename)
        return true
      },
    )
  })
}
