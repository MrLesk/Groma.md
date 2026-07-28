import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'

import { parse } from 'comark'

const observationContract = 'groma.typescript-bun/v1'
const containerId = 'scanner'
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const readableTextPattern = /^[\x21-\x7e](?:[\x20-\x7e]*[\x21-\x7e])?$/
const sourceRangePattern =
  /^(?<filename>[A-Za-z0-9._/-]+):(?<start>[1-9]\d*)-(?<end>[1-9]\d*)$/
const ownedOutputDirectory =
  'groma/observed/systems/groma/containers/scanner/components'
const scannerDirectory =
  'groma/observed/systems/groma/containers/scanner'
const scannerDocument = `${scannerDirectory}/container.md`
const frontmatterFields = new Set(['id', 'kind', 'parent', 'external'])
const rootKinds = new Set(['person', 'system'])
const expectedParentKinds = new Map([
  ['container', 'system'],
  ['component', 'container'],
])
const relationshipColumns = ['Target', 'Description', 'Technology']

export class MarkdownEmissionError extends Error {
  constructor(message, options) {
    super(message, options)
    this.name = 'MarkdownEmissionError'
    this.code = 'GROMA_MARKDOWN_EMISSION_FAILED'
  }
}

function fail(message, cause) {
  throw new MarkdownEmissionError(
    message,
    cause === undefined ? undefined : { cause },
  )
}

function recordFilesystemAccess(
  onFilesystemAccess,
  operation,
  filename,
) {
  onFilesystemAccess?.({ operation, filename })
}

async function inspectPath(filename, onFilesystemAccess) {
  recordFilesystemAccess(onFilesystemAccess, 'lstat', filename)
  return lstat(filename)
}

async function resolvePath(filename, onFilesystemAccess) {
  recordFilesystemAccess(onFilesystemAccess, 'realpath', filename)
  return realpath(filename)
}

async function readDirectory(filename, onFilesystemAccess) {
  recordFilesystemAccess(onFilesystemAccess, 'read-directory', filename)
  return readdir(filename, { withFileTypes: true })
}

async function readText(filename, onFilesystemAccess) {
  recordFilesystemAccess(onFilesystemAccess, 'read-file', filename)
  return readFile(filename, 'utf8')
}

async function makeDirectory(filename, options, onFilesystemAccess) {
  recordFilesystemAccess(onFilesystemAccess, 'make-directory', filename)
  return mkdir(filename, options)
}

async function makeTemporaryDirectory(prefix, onFilesystemAccess) {
  recordFilesystemAccess(onFilesystemAccess, 'make-temporary-directory', prefix)
  return mkdtemp(prefix)
}

async function writeText(filename, source, onFilesystemAccess) {
  recordFilesystemAccess(onFilesystemAccess, 'write-file', filename)
  return writeFile(filename, source, {
    encoding: 'utf8',
    flag: 'wx',
  })
}

async function movePath(source, destination, onFilesystemAccess) {
  recordFilesystemAccess(onFilesystemAccess, 'rename', source)
  recordFilesystemAccess(onFilesystemAccess, 'rename-destination', destination)
  return rename(source, destination)
}

async function removePath(filename, onFilesystemAccess) {
  recordFilesystemAccess(onFilesystemAccess, 'remove', filename)
  return rm(filename, { recursive: true, force: true })
}

function bytewiseCompare(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
}

function compareRelationships(left, right) {
  return bytewiseCompare(left.sourceId, right.sourceId)
    || bytewiseCompare(left.targetId, right.targetId)
    || bytewiseCompare(left.sourceRange, right.sourceRange)
}

function escapeMarkdownText(value) {
  return [...value].map(character => {
    const codePoint = character.codePointAt(0)
    const isAsciiPunctuation = (
      (codePoint >= 0x21 && codePoint <= 0x2f)
      || (codePoint >= 0x3a && codePoint <= 0x40)
      || (codePoint >= 0x5b && codePoint <= 0x60)
      || (codePoint >= 0x7b && codePoint <= 0x7e)
    )
    return isAsciiPunctuation ? `\\${character}` : character
  }).join('')
}

function requireExactKeys(value, keys, label) {
  if (
    value === null
    || typeof value !== 'object'
    || Array.isArray(value)
    || Object.keys(value).length !== keys.length
    || keys.some(key => !Object.hasOwn(value, key))
  ) {
    fail(`invalid ${label}`)
  }
}

function requireId(value, label) {
  if (typeof value !== 'string' || !idPattern.test(value)) {
    fail(`invalid ${label}`)
  }
  return value
}

function requireReadableText(value, label) {
  if (typeof value !== 'string' || !readableTextPattern.test(value)) {
    fail(`invalid ${label}`)
  }
  return value
}

function requireSourceRange(value, label) {
  if (typeof value !== 'string') {
    fail(`invalid ${label}`)
  }
  const match = sourceRangePattern.exec(value)
  if (
    !match
    || match.groups.filename.startsWith('/')
    || match.groups.filename.split('/').includes('..')
    || Number(match.groups.end) < Number(match.groups.start)
  ) {
    fail(`invalid ${label}`)
  }
  return value
}

function validateObservation(observation) {
  requireExactKeys(
    observation,
    ['contract', 'containerId', 'entryPoints', 'components'],
    'observation record',
  )
  if (
    observation.contract !== observationContract
    || observation.containerId !== containerId
    || !Array.isArray(observation.entryPoints)
    || observation.entryPoints.length !== 1
    || !Array.isArray(observation.components)
    || observation.components.length === 0
  ) {
    fail(`observation must match ${observationContract}`)
  }

  const componentIds = new Set()
  const components = observation.components.map((component, componentIndex) => {
    requireExactKeys(
      component,
      [
        'id',
        'name',
        'description',
        'technology',
        'sourceRange',
        'relationships',
      ],
      `component ${componentIndex}`,
    )
    const id = requireId(component.id, `component ${componentIndex} id`)
    if (componentIds.has(id)) {
      fail(`duplicate observation component id ${id}`)
    }
    componentIds.add(id)
    if (!Array.isArray(component.relationships)) {
      fail(`invalid relationships for component ${id}`)
    }

    const relationships = component.relationships.map(
      (relationship, relationshipIndex) => {
        requireExactKeys(
          relationship,
          [
            'sourceId',
            'targetId',
            'description',
            'technology',
            'sourceRange',
          ],
          `relationship ${id}[${relationshipIndex}]`,
        )
        const sourceId = requireId(
          relationship.sourceId,
          `relationship ${id}[${relationshipIndex}] source id`,
        )
        if (sourceId !== id) {
          fail(`relationship source ${sourceId} does not match component ${id}`)
        }
        return {
          sourceId,
          targetId: requireId(
            relationship.targetId,
            `relationship ${id}[${relationshipIndex}] target id`,
          ),
          description: requireReadableText(
            relationship.description,
            `relationship ${id}[${relationshipIndex}] description`,
          ),
          technology: requireReadableText(
            relationship.technology,
            `relationship ${id}[${relationshipIndex}] technology`,
          ),
          sourceRange: requireSourceRange(
            relationship.sourceRange,
            `relationship ${id}[${relationshipIndex}] source range`,
          ),
        }
      },
    ).sort(compareRelationships)

    return {
      id,
      name: requireReadableText(component.name, `component ${id} name`),
      description: requireReadableText(
        component.description,
        `component ${id} description`,
      ),
      technology: requireReadableText(
        component.technology,
        `component ${id} technology`,
      ),
      sourceRange: requireSourceRange(
        component.sourceRange,
        `component ${id} source range`,
      ),
      relationships,
    }
  }).sort((left, right) => bytewiseCompare(left.id, right.id))

  const entryPoints = observation.entryPoints.map((entryPoint, index) => {
    requireExactKeys(
      entryPoint,
      ['componentId', 'sourceRange'],
      `entry point ${index}`,
    )
    return {
      componentId: requireId(
        entryPoint.componentId,
        `entry point ${index} component id`,
      ),
      sourceRange: requireSourceRange(
        entryPoint.sourceRange,
        `entry point ${index} source range`,
      ),
    }
  }).sort((left, right) => bytewiseCompare(
    left.sourceRange,
    right.sourceRange,
  ))

  for (const entryPoint of entryPoints) {
    if (!componentIds.has(entryPoint.componentId)) {
      fail(`missing entry-point component ${entryPoint.componentId}`)
    }
  }

  return { components, entryPoints }
}

function repositoryRelative(repositoryRoot, filename) {
  return path.relative(repositoryRoot, filename).split(path.sep).join('/')
}

function textFromNode(value) {
  if (typeof value === 'string') {
    return value
  }
  if (!Array.isArray(value)) {
    return ''
  }
  return value.slice(2).map(textFromNode).join('')
}

function collectNodes(node, tag, collected = []) {
  if (!Array.isArray(node)) {
    return collected
  }
  if (typeof node[0] === 'string' && node[0] === tag) {
    collected.push(node)
  }
  const children = typeof node[0] === 'string' ? node.slice(2) : node
  for (const child of children) {
    collectNodes(child, tag, collected)
  }
  return collected
}

function tableHeaderNames(table) {
  const headerRow = collectNodes(table, 'tr')[0]
  const cells = headerRow?.slice(2).filter(node => node[0] === 'th') ?? []
  return cells.map(cell => textFromNode(cell).trim())
}

function collectRelationshipTables(nodes) {
  const tables = []
  let inRelationshipsSection = false

  for (const node of nodes) {
    if (node[0] === 'h2') {
      inRelationshipsSection = node[1]?.id === 'relationships'
      continue
    }
    if (node[0] !== 'table') {
      continue
    }
    const headers = tableHeaderNames(node)
    const hasCanonicalHeader = relationshipColumns.every(
      (column, index) => headers[index] === column,
    ) && headers.length === relationshipColumns.length
    if (inRelationshipsSection || hasCanonicalHeader) {
      tables.push({ inRelationshipsSection, node })
    }
  }
  return tables
}

async function parseObservedDocument(
  repositoryRoot,
  filename,
  onFilesystemAccess,
) {
  const sourceFilename = repositoryRelative(repositoryRoot, filename)
  let tree
  try {
    tree = await parse(await readText(filename, onFilesystemAccess))
  } catch (error) {
    fail(`Comark could not parse observed element ${sourceFilename}`, error)
  }

  const frontmatter = tree.frontmatter
  if (
    frontmatter === null
    || typeof frontmatter !== 'object'
    || Array.isArray(frontmatter)
    || Object.keys(frontmatter).some(field => !frontmatterFields.has(field))
  ) {
    fail(`invalid canonical frontmatter in ${sourceFilename}`)
  }
  const id = requireId(frontmatter.id, `observed element id in ${sourceFilename}`)
  if (
    !['person', 'system', 'container', 'component'].includes(frontmatter.kind)
  ) {
    fail(`invalid observed element kind in ${sourceFilename}`)
  }
  const headings = tree.nodes
    .map((node, index) => ({ index, node }))
    .filter(({ node }) => node[0] === 'h1')
  const name = textFromNode(headings[0]?.node).trim()
  if (headings.length !== 1 || name.length === 0) {
    fail(`${sourceFilename} requires one level-one heading with a readable name`)
  }
  const prose = tree.nodes[headings[0].index + 1]
  if (prose?.[0] !== 'p' || textFromNode(prose).trim().length === 0) {
    fail(`${sourceFilename} requires prose immediately after its level-one heading`)
  }

  return {
    id,
    kind: frontmatter.kind,
    parent: frontmatter.parent,
    ...(Object.hasOwn(frontmatter, 'external')
      ? { external: frontmatter.external }
      : {}),
    name,
    nodes: tree.nodes,
    sourceFilename,
  }
}

function canonicalElementPath(element, index) {
  if (element.kind === 'person') {
    return `groma/observed/people/${element.id}.md`
  }
  if (element.kind === 'system') {
    return `groma/observed/systems/${element.id}/system.md`
  }
  if (element.kind === 'container') {
    return `groma/observed/systems/${element.parent}`
      + `/containers/${element.id}/container.md`
  }

  const parent = index.get(element.parent)
  if (parent === undefined) {
    return null
  }
  return `${path.posix.dirname(parent.sourceFilename)}`
    + `/components/${element.id}.md`
}

function relationshipTargetFilename(sourceFilename, href) {
  if (
    typeof href !== 'string'
    || href.startsWith('#')
    || path.posix.isAbsolute(href)
    || /^[a-z][a-z\d+.-]*:/i.test(href)
  ) {
    return null
  }
  let decodedHref
  try {
    decodedHref = decodeURIComponent(href.split('#', 1)[0])
  } catch {
    return null
  }
  if (!decodedHref.endsWith('.md')) {
    return null
  }
  return path.posix.normalize(
    path.posix.join(path.posix.dirname(sourceFilename), decodedHref),
  )
}

function validateObservedIndex(index) {
  const elementsByFilename = new Map(
    [...index.values()].map(element => [element.sourceFilename, element]),
  )

  for (const element of index.values()) {
    if (element.generated) {
      continue
    }
    const declaresParent = element.parent !== undefined
    if (rootKinds.has(element.kind)) {
      if (declaresParent) {
        fail(`${element.sourceFilename}: ${element.kind} cannot declare a parent`)
      }
    } else {
      if (typeof element.parent !== 'string' || !idPattern.test(element.parent)) {
        fail(`${element.sourceFilename}: ${element.kind} requires a parent id`)
      }
      const parent = index.get(element.parent)
      const expectedKind = expectedParentKinds.get(element.kind)
      if (parent === undefined) {
        fail(`${element.sourceFilename}: unknown parent id ${element.parent}`)
      }
      if (parent.kind !== expectedKind) {
        fail(
          `${element.sourceFilename}: ${element.kind} requires a`
            + ` ${expectedKind} parent`,
        )
      }
    }

    const declaresExternal = Object.hasOwn(element, 'external')
    if (declaresExternal && element.external !== true) {
      fail(`${element.sourceFilename}: external may only be present with value true`)
    }
    if (element.external === true && element.kind !== 'system') {
      fail(`${element.sourceFilename}: only a system can be external`)
    }
    const expectedPath = canonicalElementPath(element, index)
    if (element.sourceFilename !== expectedPath) {
      fail(`${element.sourceFilename}: element is not at its canonical C4 path`)
    }

    for (const relationshipTable of collectRelationshipTables(element.nodes)) {
      if (!relationshipTable.inRelationshipsSection) {
        fail(
          `${element.sourceFilename}: relationship table must be under`
            + ' "## Relationships"',
        )
      }
      const headers = tableHeaderNames(relationshipTable.node)
      if (
        headers.length !== relationshipColumns.length
        || relationshipColumns.some(
          (column, index) => headers[index] !== column,
        )
      ) {
        fail(`${element.sourceFilename}: invalid relationship table columns`)
      }
      const rows = collectNodes(relationshipTable.node, 'tr').slice(1)
      for (const row of rows) {
        const cells = row.slice(2).filter(node => node[0] === 'td')
        if (cells.length !== 3) {
          fail(`${element.sourceFilename}: relationship row requires three cells`)
        }
        const links = collectNodes(cells[0], 'a')
        if (links.length !== 1) {
          fail(`${element.sourceFilename}: relationship target requires one link`)
        }
        const targetFilename = relationshipTargetFilename(
          element.sourceFilename,
          links[0][1]?.href,
        )
        if (!elementsByFilename.has(targetFilename)) {
          fail(`${element.sourceFilename}: broken relationship target`)
        }
        if (
          textFromNode(cells[1]).trim().length === 0
          || textFromNode(cells[2]).trim().length === 0
        ) {
          fail(`${element.sourceFilename}: relationship cells require readable text`)
        }
      }
    }
  }
}

async function validateOwnedDirectories(
  repositoryRoot,
  onFilesystemAccess,
) {
  const relativeDirectories = [
    'groma',
    'groma/observed',
    'groma/observed/systems',
    'groma/observed/systems/groma',
    'groma/observed/systems/groma/containers',
    scannerDirectory,
    ownedOutputDirectory,
  ]

  for (const relativeDirectory of relativeDirectories) {
    const filename = path.join(
      repositoryRoot,
      ...relativeDirectory.split('/'),
    )
    let stat
    try {
      stat = await inspectPath(filename, onFilesystemAccess)
    } catch (error) {
      fail(`owned components path must be a real directory: ${relativeDirectory}`, error)
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      fail(`owned components path must be a real directory: ${relativeDirectory}`)
    }
    let physicalPath
    try {
      physicalPath = await resolvePath(filename, onFilesystemAccess)
    } catch (error) {
      fail(`owned components path must be a real directory: ${relativeDirectory}`, error)
    }
    if (physicalPath !== filename) {
      fail(`owned components path must be a real directory: ${relativeDirectory}`)
    }
  }
}

async function buildTargetIndex(
  repositoryRoot,
  generatedComponents,
  onFilesystemAccess,
) {
  const observedRoot = path.join(repositoryRoot, 'groma', 'observed')
  const ownedRoot = path.join(
    repositoryRoot,
    ...ownedOutputDirectory.split('/'),
  )
  const index = new Map()

  for (const component of generatedComponents) {
    index.set(component.id, {
      id: component.id,
      kind: 'component',
      parent: containerId,
      name: component.name,
      sourceFilename: `${ownedOutputDirectory}/${component.id}.md`,
      generated: true,
    })
  }

  async function walk(directory) {
    const entries = await readDirectory(directory, onFilesystemAccess)
    entries.sort((left, right) => bytewiseCompare(left.name, right.name))

    for (const entry of entries) {
      const filename = path.join(directory, entry.name)
      if (filename === ownedRoot) {
        continue
      }
      if (entry.isSymbolicLink()) {
        fail(`observed architecture contains a symbolic link: ${
          repositoryRelative(repositoryRoot, filename)
        }`)
      }
      if (entry.isDirectory()) {
        await walk(filename)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        if (entry.name === 'README.md') {
          continue
        }
        const element = await parseObservedDocument(
          repositoryRoot,
          filename,
          onFilesystemAccess,
        )
        if (index.has(element.id)) {
          fail(`duplicate observed element id ${element.id}`)
        }
        index.set(element.id, element)
      }
    }
  }

  await walk(observedRoot)
  validateObservedIndex(index)
  const scanner = index.get(containerId)
  if (
    scanner?.generated === true
    || scanner?.kind !== 'container'
    || scanner?.parent !== 'groma'
    || scanner?.sourceFilename !== scannerDocument
  ) {
    fail(`invalid hand-authored scanner parent at ${scannerDocument}`)
  }
  return index
}

function renderComponent(component, entryPoints, targetIndex) {
  const sourceFilename = `${ownedOutputDirectory}/${component.id}.md`
  const sections = [
    '---',
    `id: ${component.id}`,
    'kind: component',
    `parent: ${containerId}`,
    '---',
    '',
    `# ${escapeMarkdownText(component.name)}`,
    '',
    escapeMarkdownText(component.description),
    '',
    '## Technology',
    '',
    escapeMarkdownText(component.technology),
  ]

  if (component.relationships.length > 0) {
    sections.push(
      '',
      '## Relationships',
      '',
      '| Target | Description | Technology |',
      '| --- | --- | --- |',
    )
    for (const relationship of component.relationships) {
      const target = targetIndex.get(relationship.targetId)
      if (target === undefined) {
        fail(`missing relationship target ${relationship.targetId}`)
      }
      const href = path.posix.relative(
        path.posix.dirname(sourceFilename),
        target.sourceFilename,
      )
      sections.push(
        `| [${escapeMarkdownText(target.name)}](${href})`
          + ` | ${escapeMarkdownText(relationship.description)}`
          + ` | ${escapeMarkdownText(relationship.technology)} |`,
      )
    }
  }

  sections.push(
    '',
    '## Source evidence',
    '',
    `- Component: \`${component.sourceRange}\``,
  )
  for (const entryPoint of entryPoints) {
    if (entryPoint.componentId === component.id) {
      sections.push(`- Entry point: \`${entryPoint.sourceRange}\``)
    }
  }
  for (const relationship of component.relationships) {
    sections.push(
      `- Relationship to \`${relationship.targetId}\`:`
        + ` \`${relationship.sourceRange}\``,
    )
  }
  sections.push('')
  return sections.join('\n')
}

async function validateRenderedDocument(component, source) {
  let tree
  try {
    tree = await parse(source)
  } catch (error) {
    fail(`Comark could not parse generated component ${component.id}`, error)
  }
  if (
    JSON.stringify(tree.frontmatter) !== JSON.stringify({
      id: component.id,
      kind: 'component',
      parent: containerId,
    })
  ) {
    fail(`generated component ${component.id} has invalid frontmatter`)
  }
}

async function replaceOwnedDirectory(
  repositoryRoot,
  renderedComponents,
  onFilesystemAccess,
) {
  const ownedRoot = path.join(
    repositoryRoot,
    ...ownedOutputDirectory.split('/'),
  )
  await validateOwnedDirectories(repositoryRoot, onFilesystemAccess)
  const transactionRoot = await makeTemporaryDirectory(
    path.join(ownedRoot, '.groma-components-transaction-'),
    onFilesystemAccess,
  )
  const stageRoot = path.join(transactionRoot, 'stage')
  const backupRoot = path.join(transactionRoot, 'backup')
  const movedOriginalNames = []
  const movedGeneratedNames = []

  try {
    await makeDirectory(stageRoot, undefined, onFilesystemAccess)
    await makeDirectory(backupRoot, undefined, onFilesystemAccess)
    for (const [id, source] of renderedComponents) {
      await writeText(
        path.join(stageRoot, `${id}.md`),
        source,
        onFilesystemAccess,
      )
    }

    await validateOwnedDirectories(repositoryRoot, onFilesystemAccess)
    const transactionName = path.basename(transactionRoot)
    const originalEntries = await readDirectory(
      ownedRoot,
      onFilesystemAccess,
    )
    const originalNames = originalEntries
      .map(entry => entry.name)
      .filter(name => name !== transactionName)
      .sort(bytewiseCompare)

    for (const name of originalNames) {
      await movePath(
        path.join(ownedRoot, name),
        path.join(backupRoot, name),
        onFilesystemAccess,
      )
      movedOriginalNames.push(name)
    }
    for (const [id] of renderedComponents) {
      const name = `${id}.md`
      await movePath(
        path.join(stageRoot, name),
        path.join(ownedRoot, name),
        onFilesystemAccess,
      )
      movedGeneratedNames.push(name)
    }
  } catch (error) {
    const rollbackErrors = []
    for (const name of movedGeneratedNames.reverse()) {
      try {
        await movePath(
          path.join(ownedRoot, name),
          path.join(stageRoot, name),
          onFilesystemAccess,
        )
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
    }
    for (const name of movedOriginalNames.reverse()) {
      try {
        await movePath(
          path.join(backupRoot, name),
          path.join(ownedRoot, name),
          onFilesystemAccess,
        )
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
    }
    if (rollbackErrors.length === 0) {
      await removePath(transactionRoot, onFilesystemAccess).catch(
        rollbackError => rollbackErrors.push(rollbackError),
      )
    }
    const cause = rollbackErrors.length === 0
      ? error
      : new AggregateError(
          [error, ...rollbackErrors],
          'owned components rollback failed',
        )
    fail('could not replace the owned components directory', cause)
  }

  let cleanupError
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await removePath(transactionRoot, onFilesystemAccess)
      return
    } catch (error) {
      cleanupError = error
    }
  }
  fail(
    'components were replaced but transaction cleanup failed',
    cleanupError,
  )
}

export async function emitObservedComponents(
  suppliedRepositoryRoot,
  observation,
  options = {},
) {
  const { onFilesystemAccess } = options
  let repositoryRoot
  try {
    repositoryRoot = await resolvePath(
      path.resolve(suppliedRepositoryRoot),
      onFilesystemAccess,
    )
  } catch (error) {
    fail('repository root must be a real directory', error)
  }
  const repositoryStat = await inspectPath(repositoryRoot, onFilesystemAccess)
  if (!repositoryStat.isDirectory() || repositoryStat.isSymbolicLink()) {
    fail('repository root must be a real directory')
  }

  const { components, entryPoints } = validateObservation(observation)
  await validateOwnedDirectories(repositoryRoot, onFilesystemAccess)
  const targetIndex = await buildTargetIndex(
    repositoryRoot,
    components,
    onFilesystemAccess,
  )
  const renderedComponents = []

  for (const component of components) {
    const source = renderComponent(component, entryPoints, targetIndex)
    await validateRenderedDocument(component, source)
    renderedComponents.push([component.id, source])
  }

  await replaceOwnedDirectory(
    repositoryRoot,
    renderedComponents,
    onFilesystemAccess,
  )
  return {
    componentIds: components.map(component => component.id),
    outputDirectory: ownedOutputDirectory,
  }
}
