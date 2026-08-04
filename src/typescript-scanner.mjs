import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { TextDecoder } from 'node:util'

const contract = 'groma.scanner.typescript-bun/v1'
const containerId = 'scanner'
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const reservedIdentifierPattern =
  /\b(?:GromaEntryPoint|GromaComponent|GromaRelationships)\b/
const sourceExtensionPattern = /\.(?:ts|tsx|mts|cts)$/
const jsonStringPattern =
  String.raw`"(?:\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})|[^"\\\x00-\x1f])*"`
const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

class SourceShapeMismatch extends Error {}

export class UnsupportedSourceShapeError extends Error {
  constructor() {
    super(`Repository does not match ${contract}.`)
    this.name = 'UnsupportedSourceShapeError'
    this.code = 'GROMA_UNSUPPORTED_SOURCE_SHAPE'
  }
}

function mismatch() {
  throw new SourceShapeMismatch()
}

function recordFilesystemAccess(
  onFilesystemAccess,
  operation,
  filename,
) {
  onFilesystemAccess?.({ operation, filename })
}

async function readUtf8(filename, onFilesystemAccess) {
  recordFilesystemAccess(onFilesystemAccess, 'read-file', filename)
  const bytes = await readFile(filename)
  if (
    bytes.length >= 3
    && bytes[0] === 0xef
    && bytes[1] === 0xbb
    && bytes[2] === 0xbf
  ) {
    mismatch()
  }
  return utf8Decoder.decode(bytes)
}

async function readDirectory(filename, onFilesystemAccess) {
  recordFilesystemAccess(onFilesystemAccess, 'read-directory', filename)
  return readdir(filename, { withFileTypes: true })
}

async function readSource(filename, onFilesystemAccess) {
  const source = await readUtf8(filename, onFilesystemAccess)
  if (
    !source.endsWith('\n')
    || /[\r\u2028\u2029]/.test(source)
  ) {
    mismatch()
  }
  return source.slice(0, -1).split('\n')
}

function bytewiseCompare(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
}

function compareRelationships(left, right) {
  return bytewiseCompare(left.sourceId, right.sourceId)
    || bytewiseCompare(left.targetId, right.targetId)
    || bytewiseCompare(left.sourceRange, right.sourceRange)
}

function decodeJsonString(token) {
  let value
  try {
    value = JSON.parse(token)
  } catch {
    mismatch()
  }
  if (typeof value !== 'string') {
    mismatch()
  }
  return value
}

function parseLiteralField(line, indentation, field) {
  const fieldPattern = new RegExp(
    `^${' '.repeat(indentation)}${field}: (${jsonStringPattern});$`,
  )
  const match = fieldPattern.exec(line)
  if (!match) {
    mismatch()
  }
  return decodeJsonString(match[1])
}

function validateId(value) {
  if (!idPattern.test(value)) {
    mismatch()
  }
  return value
}

function validateReadableText(value) {
  if (!/^[\x21-\x7e](?:[\x20-\x7e]*[\x21-\x7e])?$/.test(value)) {
    mismatch()
  }
  return value
}

function rejectReservedIdentifiers(lines) {
  if (reservedIdentifierPattern.test(lines.join('\n'))) {
    mismatch()
  }
}

function parseEntryPoint(lines) {
  if (
    lines[0] !== 'export type GromaEntryPoint = {'
    || lines[2] !== '};'
  ) {
    mismatch()
  }

  const componentId = validateId(
    parseLiteralField(lines[1], 2, 'componentId'),
  )
  rejectReservedIdentifiers(lines.slice(3))

  return {
    componentId,
    sourceRange: 'src/index.ts:1-3',
  }
}

function parseComponentDeclaration(lines, sourceFilename, filenameId) {
  if (
    lines[0] !== 'export type GromaComponent = {'
    || lines[5] !== '};'
    || lines[6] !== ''
  ) {
    mismatch()
  }

  const id = validateId(parseLiteralField(lines[1], 2, 'id'))
  if (id !== filenameId) {
    mismatch()
  }

  return {
    id,
    name: validateReadableText(parseLiteralField(lines[2], 2, 'name')),
    description: validateReadableText(
      parseLiteralField(lines[3], 2, 'description'),
    ),
    technology: validateReadableText(
      parseLiteralField(lines[4], 2, 'technology'),
    ),
    sourceRange: `${sourceFilename}:1-6`,
  }
}

function parseRelationship(
  lines,
  startIndex,
  sourceFilename,
  componentId,
) {
  if (
    lines[startIndex] !== '  {'
    || lines[startIndex + 5] !== '  },'
  ) {
    mismatch()
  }

  const sourceId = validateId(
    parseLiteralField(lines[startIndex + 1], 4, 'sourceId'),
  )
  if (sourceId !== componentId) {
    mismatch()
  }

  return {
    sourceId,
    targetId: validateId(
      parseLiteralField(lines[startIndex + 2], 4, 'targetId'),
    ),
    description: validateReadableText(
      parseLiteralField(lines[startIndex + 3], 4, 'description'),
    ),
    technology: validateReadableText(
      parseLiteralField(lines[startIndex + 4], 4, 'technology'),
    ),
    sourceRange:
      `${sourceFilename}:${startIndex + 1}-${startIndex + 6}`,
  }
}

function parseRelationships(lines, sourceFilename, componentId) {
  if (lines[7] === 'export type GromaRelationships = [];') {
    return {
      declarationEnd: 8,
      relationships: [],
    }
  }
  if (lines[7] !== 'export type GromaRelationships = [') {
    mismatch()
  }

  const relationships = []
  let cursor = 8
  while (lines[cursor] === '  {') {
    relationships.push(parseRelationship(
      lines,
      cursor,
      sourceFilename,
      componentId,
    ))
    cursor += 6
  }

  if (relationships.length === 0 || lines[cursor] !== '];') {
    mismatch()
  }

  return {
    declarationEnd: cursor + 1,
    relationships: relationships.sort(compareRelationships),
  }
}

function parseComponent(lines, sourceFilename, filenameId) {
  const component = parseComponentDeclaration(
    lines,
    sourceFilename,
    filenameId,
  )
  const { declarationEnd, relationships } = parseRelationships(
    lines,
    sourceFilename,
    component.id,
  )
  rejectReservedIdentifiers(lines.slice(declarationEnd))

  return {
    ...component,
    relationships,
  }
}

async function listSourceDeclarations(repositoryRoot, onFilesystemAccess) {
  const declarationFiles = []

  async function walk(relativeDirectory) {
    const directory = path.join(repositoryRoot, ...relativeDirectory.split('/'))
    const entries = await readDirectory(directory, onFilesystemAccess)
    entries.sort((left, right) => bytewiseCompare(left.name, right.name))

    for (const entry of entries) {
      const relativePath = `${relativeDirectory}/${entry.name}`
      if (entry.isDirectory()) {
        await walk(relativePath)
      } else if (sourceExtensionPattern.test(entry.name)) {
        if (!entry.isFile()) mismatch()
        declarationFiles.push(relativePath)
      }
    }
  }

  await walk('src')
  declarationFiles.sort(bytewiseCompare)
  return declarationFiles
}

function validatePackageJson(packageJson) {
  if (
    packageJson === null
    || typeof packageJson !== 'object'
    || Array.isArray(packageJson)
    || packageJson.private !== true
    || packageJson.type !== 'module'
    || packageJson.scripts?.start !== 'bun run src/index.ts'
  ) {
    mismatch()
  }
}

async function scan(repositoryRoot, onFilesystemAccess) {
  const absoluteRoot = path.resolve(repositoryRoot)
  const packageSource = await readUtf8(
    path.join(absoluteRoot, 'package.json'),
    onFilesystemAccess,
  )
  let packageJson
  try {
    packageJson = JSON.parse(packageSource)
  } catch {
    mismatch()
  }
  validatePackageJson(packageJson)

  const declarationFiles = await listSourceDeclarations(
    absoluteRoot,
    onFilesystemAccess,
  )
  const componentFiles = declarationFiles.filter(filename => {
    return /^src\/components\/[^/]+\.ts$/.test(filename)
  })
  if (
    componentFiles.length === 0
    || declarationFiles.length !== componentFiles.length + 1
    || !declarationFiles.includes('src/index.ts')
  ) {
    mismatch()
  }

  const entryPoint = parseEntryPoint(await readSource(
    path.join(absoluteRoot, 'src', 'index.ts'),
    onFilesystemAccess,
  ))
  const components = []
  const componentIds = new Set()

  for (const sourceFilename of componentFiles) {
    const filenameId = path.posix.basename(sourceFilename, '.ts')
    const component = parseComponent(
      await readSource(
        path.join(absoluteRoot, ...sourceFilename.split('/')),
        onFilesystemAccess,
      ),
      sourceFilename,
      filenameId,
    )
    if (componentIds.has(component.id)) {
      mismatch()
    }
    componentIds.add(component.id)
    components.push(component)
  }

  if (!componentIds.has(entryPoint.componentId)) {
    mismatch()
  }

  components.sort((left, right) => bytewiseCompare(left.id, right.id))
  return {
    contract,
    containerId,
    entryPoints: [entryPoint],
    components,
  }
}

export async function scanTypeScriptSource(repositoryRoot, options = {}) {
  try {
    return await scan(repositoryRoot, options.onFilesystemAccess)
  } catch {
    throw new UnsupportedSourceShapeError()
  }
}
