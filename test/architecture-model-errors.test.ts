import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ArchitectureModelError,
  buildArchitectureModel,
} from '../src/architecture-model.ts'
import { elementDocument } from './architecture-model-helpers.ts'

for (const {
  name,
  documents,
  code,
  sourceFilename,
  message,
} of [
  {
    name: 'reports a component stored under externals',
    documents: [
      elementDocument({
        id: 'stray',
        kind: 'component',
        parent: 'api',
        sourceFilename: 'groma/externals/stray.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename: 'groma/externals/stray.md',
    message: /only a system can live under externals\/.*"stray" is a component/,
  },
  {
    name: 'reports an actor stored under externals',
    documents: [
      elementDocument({
        id: 'external-actor',
        kind: 'actor',
        sourceFilename: 'groma/externals/external-actor.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename: 'groma/externals/external-actor.md',
    message: /only a system can live under externals\/.*"external-actor" is a actor/,
  },
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
    message: /container "safe" cannot live inside external system "vault"/,
  },
  {
    name: 'reports the external flag as an unsupported field',
    documents: [
      elementDocument({
        id: 'flagged-system',
        kind: 'system',
        extraGroma: { external: true },
        sourceFilename: 'groma/systems/flagged-system/system.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename: 'groma/systems/flagged-system/system.md',
    message: /unsupported groma field\(s\): external/,
  },
  {
    name: 'reports a missing lifecycle status',
    documents: [
      elementDocument({
        id: 'unlabelled-system',
        kind: 'system',
        status: null,
        sourceFilename: 'groma/systems/unlabelled-system/system.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename: 'groma/systems/unlabelled-system/system.md',
    message: /status must be draft or stable/,
  },
  {
    name: 'reports a status outside the OKF lifecycle',
    documents: [
      elementDocument({
        id: 'planned-system',
        kind: 'system',
        status: 'planned',
        sourceFilename: 'groma/systems/planned-system/system.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename: 'groma/systems/planned-system/system.md',
    message: /status must be draft or stable/,
  },
  {
    name: 'reports a draft tag that is not a kebab-case id',
    documents: [
      elementDocument({
        id: 'tagged-system',
        kind: 'system',
        status: 'draft',
        draft: 'Next Release',
        sourceFilename: 'groma/systems/tagged-system/system.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename: 'groma/systems/tagged-system/system.md',
    message: /draft must name a draft record by its kebab-case id/,
  },
  {
    name: 'reports an actor outside the actors directory',
    documents: [
      elementDocument({
        id: 'misplaced-actor',
        kind: 'actor',
        sourceFilename: 'groma/people/misplaced-actor.md',
      }),
    ],
    code: 'INVALID_ELEMENT_LOCATION',
    sourceFilename: 'groma/people/misplaced-actor.md',
    message: /actor "misplaced-actor" is not stored at its canonical C4 path/,
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
    message: /duplicate id "same-id".*actors\/first\.md/,
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
    message: /unknown parent id "missing-system"/,
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
    message: /container "wrongly-contained" requires a system parent.*has kind "actor"/,
  },
  {
    name: 'reports a root C4 element with an explicitly null parent',
    documents: [
      elementDocument({
        id: 'null-parent-actor',
        kind: 'actor',
        parent: null,
        sourceFilename: 'groma/actors/null-parent-actor.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename: 'groma/actors/null-parent-actor.md',
    message: /parent must be a non-empty string when present/,
  },
  {
    name: 'reports a root C4 element with an empty parent',
    documents: [
      elementDocument({
        id: 'empty-parent-system',
        kind: 'system',
        parent: '',
        sourceFilename: 'groma/systems/empty-parent-system/system.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename: 'groma/systems/empty-parent-system/system.md',
    message: /parent must be a non-empty string when present/,
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
    message: /actor "nested-actor" cannot declare a parent/,
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
    message: /container "missing-parent-container" requires a system parent id/,
  },
  {
    name: 'reports a contained C4 element with an explicitly null parent',
    documents: [
      elementDocument({
        id: 'null-parent-component',
        kind: 'component',
        parent: null,
        sourceFilename:
          'groma/systems/groma/containers/viewer/components/null-parent-component.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename:
      'groma/systems/groma/containers/viewer/components/null-parent-component.md',
    message: /parent must be a non-empty string when present/,
  },
  {
    name: 'reports an unresolved relationship link at its source document',
    documents: [
      elementDocument({
        id: 'architect',
        kind: 'actor',
        sourceFilename: 'groma/actors/architect.md',
        relationships: [{
          href: '../systems/missing/system.md',
          description: 'Uses missing software',
          technology: 'Browser',
        }],
      }),
    ],
    code: 'UNKNOWN_RELATIONSHIP_TARGET',
    sourceFilename: 'groma/actors/architect.md',
    message: /relationship target.*systems\/missing\/system\.md.*does not resolve/,
  },
  {
    name: 'reports a group that is not a string',
    documents: [
      elementDocument({
        id: 'numeric-group-system',
        kind: 'system',
        group: 7,
        sourceFilename: 'groma/systems/numeric-group-system/system.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename: 'groma/systems/numeric-group-system/system.md',
    message: /group must be a non-empty string when present/,
  },
  {
    name: 'reports a blank group',
    documents: [
      elementDocument({
        id: 'blank-group-system',
        kind: 'system',
        group: '  ',
        sourceFilename: 'groma/systems/blank-group-system/system.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename: 'groma/systems/blank-group-system/system.md',
    message: /group must be a non-empty string when present/,
  },
]) {
  test(name, () => {
    assert.throws(
      () => buildArchitectureModel(documents),
      error => {
        assert.ok(error instanceof ArchitectureModelError)
        assert.equal(error.code, code)
        assert.equal(error.sourceFilename, sourceFilename)
        assert.match(error.message, message)
        return true
      },
    )
  })
}
