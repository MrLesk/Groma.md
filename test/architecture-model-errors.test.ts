import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ArchitectureModelError,
  buildArchitectureModel,
} from '../src/architecture-model.ts'
import { elementDocument, revisionRecord } from './architecture-model-helpers.ts'

for (const {
  name,
  documents,
  code,
  sourceFilename,
  message,
} of [
  {
    name: 'reports a quoted external true value instead of coercing it',
    documents: [
      elementDocument({
        id: 'quoted-external-system',
        kind: 'system',
        external: 'true',
        sourceFilename:
          'groma/plans/test-revision/systems/quoted-external-system/system.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename:
      'groma/plans/test-revision/systems/quoted-external-system/system.md',
    message: /external must be a boolean/,
  },
  {
    name: 'reports an explicitly false external field',
    documents: [
      elementDocument({
        id: 'false-external-system',
        kind: 'system',
        external: false,
        sourceFilename:
          'groma/plans/test-revision/systems/false-external-system/system.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename:
      'groma/plans/test-revision/systems/false-external-system/system.md',
    message: /external may only be present with the value true/,
  },
  {
    name: 'reports a null external value instead of coercing it',
    documents: [
      elementDocument({
        id: 'null-external-system',
        kind: 'system',
        external: null,
        sourceFilename:
          'groma/plans/test-revision/systems/null-external-system/system.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename:
      'groma/plans/test-revision/systems/null-external-system/system.md',
    message: /external must be a boolean/,
  },
  {
    name: 'reports an actor outside the actors directory',
    documents: [
      elementDocument({
        id: 'misplaced-actor',
        kind: 'actor',
        sourceFilename: 'groma/plans/test-revision/people/misplaced-actor.md',
      }),
    ],
    code: 'INVALID_ELEMENT_LOCATION',
    sourceFilename: 'groma/plans/test-revision/people/misplaced-actor.md',
    message: /actor "misplaced-actor" is not stored at its canonical C4 path/,
  },
  {
    name: 'reports an external actor',
    documents: [
      elementDocument({
        id: 'external-actor',
        kind: 'actor',
        external: true,
        sourceFilename: 'groma/plans/test-revision/actors/external-actor.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename: 'groma/plans/test-revision/actors/external-actor.md',
    message: /only a system can be external.*"external-actor" has kind "actor"/,
  },
  {
    name: 'reports a duplicate stable id at the second document',
    documents: [
      elementDocument({
        id: 'same-id',
        kind: 'actor',
        sourceFilename: 'groma/plans/test-revision/actors/first.md',
      }),
      elementDocument({
        id: 'same-id',
        kind: 'system',
        sourceFilename: 'groma/plans/test-revision/systems/second/system.md',
      }),
    ],
    code: 'DUPLICATE_ID',
    sourceFilename: 'groma/plans/test-revision/systems/second/system.md',
    message: /duplicate id "same-id".*actors\/first\.md/,
  },
  {
    name: 'reports an unknown parent id at the contained document',
    documents: [
      elementDocument({
        id: 'orphan',
        kind: 'container',
        parent: 'missing-system',
        sourceFilename:
          'groma/plans/test-revision/systems/groma/containers/orphan/container.md',
      }),
    ],
    code: 'UNKNOWN_PARENT_ID',
    sourceFilename:
      'groma/plans/test-revision/systems/groma/containers/orphan/container.md',
    message: /unknown parent id "missing-system"/,
  },
  {
    name: 'reports a parent with the wrong C4 kind',
    documents: [
      elementDocument({
        id: 'actor-parent',
        kind: 'actor',
        sourceFilename: 'groma/plans/test-revision/actors/actor-parent.md',
      }),
      elementDocument({
        id: 'wrongly-contained',
        kind: 'container',
        parent: 'actor-parent',
        sourceFilename:
          'groma/plans/test-revision/systems/groma/containers/wrong/container.md',
      }),
    ],
    code: 'INVALID_PARENT',
    sourceFilename:
      'groma/plans/test-revision/systems/groma/containers/wrong/container.md',
    message: /container "wrongly-contained" requires a system parent.*has kind "actor"/,
  },
  {
    name: 'reports a root C4 element with an explicitly null parent',
    documents: [
      elementDocument({
        id: 'null-parent-actor',
        kind: 'actor',
        parent: null,
        sourceFilename: 'groma/plans/test-revision/actors/null-parent-actor.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename: 'groma/plans/test-revision/actors/null-parent-actor.md',
    message: /parent must be a non-empty string when present/,
  },
  {
    name: 'reports a root C4 element with an empty parent',
    documents: [
      elementDocument({
        id: 'empty-parent-system',
        kind: 'system',
        parent: '',
        sourceFilename:
          'groma/plans/test-revision/systems/empty-parent-system/system.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename:
      'groma/plans/test-revision/systems/empty-parent-system/system.md',
    message: /parent must be a non-empty string when present/,
  },
  {
    name: 'reports a root C4 element that declares a parent',
    documents: [
      elementDocument({
        id: 'nested-actor',
        kind: 'actor',
        parent: 'some-system',
        sourceFilename: 'groma/plans/test-revision/actors/nested-actor.md',
      }),
    ],
    code: 'INVALID_PARENT',
    sourceFilename: 'groma/plans/test-revision/actors/nested-actor.md',
    message: /actor "nested-actor" cannot declare a parent/,
  },
  {
    name: 'reports a contained C4 element with an omitted parent',
    documents: [
      elementDocument({
        id: 'missing-parent-container',
        kind: 'container',
        sourceFilename:
          'groma/plans/test-revision/systems/groma/containers/missing/container.md',
      }),
    ],
    code: 'INVALID_PARENT',
    sourceFilename:
      'groma/plans/test-revision/systems/groma/containers/missing/container.md',
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
          'groma/plans/test-revision/systems/groma/containers/viewer/components/'
          + 'null-parent-component.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename:
      'groma/plans/test-revision/systems/groma/containers/viewer/components/'
      + 'null-parent-component.md',
    message: /parent must be a non-empty string when present/,
  },
  {
    name: 'reports an unresolved relationship link at its source document',
    documents: [
      elementDocument({
        id: 'architect',
        kind: 'actor',
        sourceFilename: 'groma/plans/test-revision/actors/architect.md',
        relationships: [{
          href: '../systems/missing/system.md',
          description: 'Uses missing software',
          technology: 'Browser',
        }],
      }),
    ],
    code: 'UNKNOWN_RELATIONSHIP_TARGET',
    sourceFilename: 'groma/plans/test-revision/actors/architect.md',
    message: /relationship target.*systems\/missing\/system\.md.*does not resolve/,
  },
  {
    name: 'reports a group that is not a string',
    documents: [
      elementDocument({
        id: 'numeric-group-system',
        kind: 'system',
        group: 7,
        sourceFilename:
          'groma/plans/test-revision/systems/numeric-group-system/system.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename:
      'groma/plans/test-revision/systems/numeric-group-system/system.md',
    message: /group must be a non-empty string when present/,
  },
  {
    name: 'reports a blank group',
    documents: [
      elementDocument({
        id: 'blank-group-system',
        kind: 'system',
        group: '  ',
        sourceFilename:
          'groma/plans/test-revision/systems/blank-group-system/system.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename:
      'groma/plans/test-revision/systems/blank-group-system/system.md',
    message: /group must be a non-empty string when present/,
  },
]) {
  test(name, () => {
    assert.throws(
      () => buildArchitectureModel(revisionRecord(documents)),
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
