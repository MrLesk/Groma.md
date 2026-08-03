import {
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'

import { parse } from 'comark'

const scannerContract = 'groma.scanner.typescript-bun/v1'
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

async function readDirectory(filename, onFilesystemAccess) {
  recordFilesystemAccess(onFilesystemAccess, 'read-directory', filename)
  return readdir(filename, { withFileTypes: true })
}

async function readText(filename, onFilesystemAccess) {
  recordFilesystemAccess(onFilesystemAccess, 'read-file', filename)
  return readFile(filename, 'utf8')
}

async function writeText(filename, source, onFilesystemAccess) {
  recordFilesystemAccess(onFilesystemAccess, 'write-file', filename)
  return writeFile(filename, source, {
    encoding: 'utf8',
    flag: 'wx',
  })
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

function validateScanResult(scanResult) {
  requireExactKeys(
    scanResult,
    ['contract', 'containerId', 'entryPoints', 'components'],
    'scan result',
  )
  if (
    scanResult.contract !== scannerContract
    || scanResult.containerId !== containerId
    || !Array.isArray(scanResult.entryPoints)
    || scanResult.entryPoints.length !== 1
    || !Array.isArray(scanResult.components)
    || scanResult.components.length === 0
  ) {
    fail(`scan result must match ${scannerContract}`)
  }

  const componentIds = new Set()
  const components = scanResult.components.map((component, componentIndex) => {
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
      fail(`duplicate scan result component id ${id}`)
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

  const entryPoints = scanResult.entryPoints.map((entryPoint, index) => {
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

function isSingleLineReadableName(value) {
  return typeof value === 'string'
    && value.length > 0
    && value === value.trim()
    && !/[\p{C}\p{Zl}\p{Zp}]/u.test(value)
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

  const heading = tree.nodes.find(node => node[0] === 'h1')
  const name = textFromNode(heading)
  if (!isSingleLineReadableName(name)) {
    fail(`${sourceFilename} requires a single-line readable name`)
  }

  return {
    id: tree.frontmatter.id,
    kind: tree.frontmatter.kind,
    parent: tree.frontmatter.parent,
    name,
    sourceFilename,
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

async function replaceOwnedDirectory(
  repositoryRoot,
  renderedComponents,
  onFilesystemAccess,
) {
  const ownedRoot = path.join(
    repositoryRoot,
    ...ownedOutputDirectory.split('/'),
  )
  const entries = await readDirectory(ownedRoot, onFilesystemAccess)
  for (const entry of entries) {
    await removePath(path.join(ownedRoot, entry.name), onFilesystemAccess)
  }
  for (const [id, source] of renderedComponents) {
    await writeText(
      path.join(ownedRoot, `${id}.md`),
      source,
      onFilesystemAccess,
    )
  }
}

export async function emitObservedComponents(
  suppliedRepositoryRoot,
  scanResult,
  options = {},
) {
  const { onFilesystemAccess } = options
  const repositoryRoot = path.resolve(suppliedRepositoryRoot)

  const { components, entryPoints } = validateScanResult(scanResult)
  const targetIndex = await buildTargetIndex(
    repositoryRoot,
    components,
    onFilesystemAccess,
  )
  const renderedComponents = []

  for (const component of components) {
    const source = renderComponent(component, entryPoints, targetIndex)
    try {
      await parse(source)
    } catch (error) {
      fail(`Comark could not parse generated component ${component.id}`, error)
    }
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
