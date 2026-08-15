import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse, parseFrontmatter } from 'comark'

import type { C4Kind, MarkdownElement } from '../src/types.ts'

const allowedFrontmatterFields = new Set(['id', 'kind', 'parent', 'external', 'code'])
const allowedKinds = new Set(['person', 'system', 'container', 'component'])
const expectedParentKinds = new Map<C4Kind, C4Kind>([
  ['container', 'system'],
  ['component', 'container'],
])
const relationshipColumns = ['Target', 'Description', 'Technology']
const elementPathPatterns = [
  /^people\/[^/]+\.md$/,
  /^systems\/[^/]+\/system\.md$/,
  /^systems\/[^/]+\/containers\/[^/]+\/container\.md$/,
  /^systems\/[^/]+\/containers\/[^/]+\/components\/[^/]+\.md$/,
]

export class ArchitectureValidationError extends Error {
  readonly errors: string[]

  constructor(revisionRoot: string, errors: string[]) {
    const details = errors.map(error => `- ${error}`).join('\n')
    super(`${revisionRoot} is invalid:\n${details}`)
    this.name = 'ArchitectureValidationError'
    this.errors = errors
  }
}

async function listMarkdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...await listMarkdownFiles(entryPath))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entryPath)
    }
  }

  return files.sort()
}

function isElementPath(revisionRoot: string, file: string): boolean {
  const relativePath = path.relative(revisionRoot, file).split(path.sep).join('/')
  return elementPathPatterns.some(pattern => pattern.test(relativePath))
}

function isMarkdownElement(node: unknown): node is MarkdownElement {
  return Array.isArray(node)
    && typeof node[0] === 'string'
    && typeof node[1] === 'object'
    && node[1] !== null
    && !Array.isArray(node[1])
}

function collectLinks(node: unknown, links: string[] = []): string[] {
  if (!Array.isArray(node)) {
    return links
  }

  const isAstNode = isMarkdownElement(node)
  if (isAstNode && node[0] === 'a' && typeof node[1].href === 'string') {
    links.push(node[1].href)
  }

  const children = isAstNode ? node.slice(2) : node
  for (const child of children) {
    collectLinks(child, links)
  }

  return links
}

function collectNodes(
  node: unknown,
  tag: string,
  nodes: MarkdownElement[] = [],
): MarkdownElement[] {
  if (!Array.isArray(node)) {
    return nodes
  }

  const isAstNode = isMarkdownElement(node)
  if (isAstNode && node[0] === tag) {
    nodes.push(node)
  }

  const children = isAstNode ? node.slice(2) : node
  for (const child of children) {
    collectNodes(child, tag, nodes)
  }

  return nodes
}

interface RelationshipTable {
  node: MarkdownElement
  inRelationshipsSection: boolean
}

function collectRelationshipTables(nodes: MarkdownElement[]): RelationshipTable[] {
  const tables: RelationshipTable[] = []
  let inRelationshipsSection = false

  for (const node of nodes) {
    if (node[0] === 'h2') {
      inRelationshipsSection = node[1]?.id === 'relationships'
      continue
    }

    if (node[0] !== 'table') {
      continue
    }

    const headerNames = tableHeaderNames(node)
    const hasCanonicalHeader = relationshipColumns.every(
      (column, index) => headerNames[index] === column,
    ) && headerNames.length === relationshipColumns.length

    if (inRelationshipsSection || hasCanonicalHeader) {
      tables.push({ node, inRelationshipsSection })
    }
  }

  return tables
}

function nodeText(node: unknown): string {
  if (typeof node === 'string') {
    return node
  }

  if (!Array.isArray(node)) {
    return ''
  }

  const isAstNode = isMarkdownElement(node)
  const children = isAstNode ? node.slice(2) : node
  return children.map(nodeText).join('')
}

function tableHeaderNames(table: MarkdownElement): string[] {
  const headerRow = collectNodes(table, 'tr')[0]
  const headerCells = headerRow?.slice(2).filter(child => child[0] === 'th') ?? []
  return headerCells.map(cell => nodeText(cell).trim())
}

function isRelativeMarkdownLink(href: unknown): href is string {
  if (typeof href !== 'string') {
    return false
  }

  return !href.startsWith('#')
    && !path.isAbsolute(href)
    && !/^[a-z][a-z\d+.-]*:/i.test(href)
    && href.split('#', 1)[0].endsWith('.md')
}

interface ParsedDocument {
  frontmatter?: Record<string, unknown>
  nodes: MarkdownElement[]
}

export interface ValidatedElement {
  file: string
  relativeFile: string
  id: unknown
  kind: unknown
  parent: unknown
}

export interface RevisionValidationResult {
  revisionRoot: string
  elementCount: number
  relationshipCount: number
  elements: ValidatedElement[]
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function validateRevision(
  revisionRoot: string,
  options: { knownElements?: ReadonlyMap<string, ValidatedElement> } = {},
): Promise<RevisionValidationResult> {
  const absoluteRoot = path.resolve(revisionRoot)
  const knownElements = options.knownElements ?? new Map<string, ValidatedElement>()
  const markdownFiles = await listMarkdownFiles(absoluteRoot)
  const elementFiles = markdownFiles.filter(file => isElementPath(absoluteRoot, file))
  const elementFileSet = new Set([
    ...elementFiles.map(file => path.resolve(file)),
    ...[...knownElements.values()].map(element => path.resolve(element.file)),
  ])
  const elements: ValidatedElement[] = []
  const errors: string[] = []
  let relationshipCount = 0

  if (elementFiles.length === 0) {
    errors.push('contains no element documents')
  }

  const unsupportedFiles = markdownFiles.filter(file => {
    const relativeFile = path.relative(absoluteRoot, file).split(path.sep).join('/')
    return relativeFile !== 'README.md' && !isElementPath(absoluteRoot, file)
  })
  for (const file of unsupportedFiles) {
    const relativeFile = path.relative(absoluteRoot, file)
    const source = await readFile(file, 'utf8')

    try {
      const { data } = parseFrontmatter(source)
      if (Object.keys(data).length > 0) {
        errors.push(
          `${relativeFile}: frontmatter-bearing Markdown must use a supported element path`,
        )
      }
    } catch (error) {
      errors.push(`${relativeFile}: Comark could not parse frontmatter (${errorMessage(error)})`)
    }
  }

  for (const file of elementFiles) {
    const relativeFile = path.relative(absoluteRoot, file)
    const source = await readFile(file, 'utf8')
    let tree: ParsedDocument

    try {
      tree = await parse(source) as ParsedDocument
      JSON.stringify(tree)
    } catch (error) {
      errors.push(`${relativeFile}: Comark could not parse the document (${errorMessage(error)})`)
      continue
    }

    const frontmatter = tree.frontmatter ?? {}
    const fields = Object.keys(frontmatter)
    const unknownFields = fields.filter(field => !allowedFrontmatterFields.has(field))

    if (unknownFields.length > 0) {
      errors.push(`${relativeFile}: unsupported frontmatter field(s): ${unknownFields.join(', ')}`)
    }

    if (typeof frontmatter.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(frontmatter.id)) {
      errors.push(`${relativeFile}: id must be lowercase kebab-case`)
    }

    if (typeof frontmatter.kind !== 'string' || !allowedKinds.has(frontmatter.kind)) {
      errors.push(`${relativeFile}: kind must be person, system, container, or component`)
    }

    if (typeof frontmatter.kind === 'string' && expectedParentKinds.has(frontmatter.kind as C4Kind)) {
      if (typeof frontmatter.parent !== 'string' || frontmatter.parent.length === 0) {
        errors.push(`${relativeFile}: ${frontmatter.kind} requires a parent id`)
      }
    } else if (frontmatter.parent !== undefined) {
      errors.push(`${relativeFile}: ${frontmatter.kind ?? 'element'} cannot declare a parent`)
    }

    if (frontmatter.external !== undefined && frontmatter.external !== true) {
      errors.push(`${relativeFile}: external may only be present with the value true`)
    }

    if (frontmatter.external === true && frontmatter.kind !== 'system') {
      errors.push(`${relativeFile}: only a system can be external`)
    }

    if (frontmatter.code !== undefined) {
      if (frontmatter.kind !== 'component') {
        errors.push(`${relativeFile}: only a component can declare code`)
      } else if (!Array.isArray(frontmatter.code)) {
        errors.push(`${relativeFile}: code must be a list`)
      } else {
        for (const [index, entry] of frontmatter.code.entries()) {
          if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
            errors.push(`${relativeFile}: code[${index}] must be an object`)
            continue
          }
          const record = entry as Record<string, unknown>
          const extra = Object.keys(record).filter(
            field => field !== 'scanner' && field !== 'file' && field !== 'symbol',
          )
          if (extra.length > 0) {
            errors.push(
              `${relativeFile}: code[${index}] has unsupported field(s): ${extra.join(', ')}`,
            )
          }
          if (typeof record.scanner !== 'string' || record.scanner.length === 0) {
            errors.push(`${relativeFile}: code[${index}] requires scanner`)
          }
          if (typeof record.file !== 'string' || record.file.length === 0) {
            errors.push(`${relativeFile}: code[${index}] requires file`)
          }
          if (record.symbol !== undefined && typeof record.symbol !== 'string') {
            errors.push(`${relativeFile}: code[${index}] symbol must be a string`)
          }
        }
      }
    }

    const headings = tree.nodes
      .map((node, index) => ({ node, index }))
      .filter(({ node }) => node[0] === 'h1')
    if (headings.length !== 1 || nodeText(headings[0]?.node).trim().length === 0) {
      errors.push(`${relativeFile}: requires one level-one heading with a readable name`)
    } else {
      const prose = tree.nodes[headings[0].index + 1]
      if (prose?.[0] !== 'p' || nodeText(prose).trim().length === 0) {
        errors.push(`${relativeFile}: requires prose immediately after its level-one heading`)
      }
    }

    const relationshipTables = collectRelationshipTables(tree.nodes)
    for (const relationshipTable of relationshipTables) {
      const table = relationshipTable.node
      if (!relationshipTable.inRelationshipsSection) {
        errors.push(`${relativeFile}: relationship table must be under "## Relationships"`)
      }

      const rows = collectNodes(table, 'tr')
      const headerNames = tableHeaderNames(table)
      if (
        headerNames.length !== relationshipColumns.length
        || relationshipColumns.some((column, index) => headerNames[index] !== column)
      ) {
        errors.push(
          `${relativeFile}: relationship table must use columns `
          + `"${relationshipColumns.join(' | ')}"`,
        )
      }

      for (const row of rows.slice(1)) {
        relationshipCount += 1
        const cells = row.slice(2).filter(child => child[0] === 'td')
        if (cells.length !== relationshipColumns.length) {
          errors.push(`${relativeFile}: relationship row must contain exactly three cells`)
        }

        const targetLinks = collectLinks(cells[0])
        if (targetLinks.length !== 1) {
          errors.push(`${relativeFile}: relationship target must contain exactly one link`)
        }

        const href = targetLinks[0]
        if (targetLinks.length === 1 && !isRelativeMarkdownLink(href)) {
          errors.push(
            `${relativeFile}: relationship target must be a relative Markdown link `
            + `"${href ?? '(missing link)'}"`,
          )
        } else if (targetLinks.length === 1) {
          const hrefPath = decodeURIComponent(href.split('#', 1)[0])
          const target = path.resolve(path.dirname(file), hrefPath)

          if (!elementFileSet.has(target)) {
            errors.push(`${relativeFile}: broken relationship link "${href}"`)
          }
        }

        if (nodeText(cells[1]).trim().length === 0) {
          errors.push(`${relativeFile}: relationship description must not be empty`)
        }

        if (nodeText(cells[2]).trim().length === 0) {
          errors.push(`${relativeFile}: relationship technology must not be empty`)
        }
      }
    }

    elements.push({
      file,
      relativeFile,
      id: frontmatter.id,
      kind: frontmatter.kind,
      parent: frontmatter.parent,
    })
  }

  const elementsById = new Map<string, ValidatedElement>()
  for (const element of elements) {
    if (typeof element.id === 'string' && elementsById.has(element.id)) {
      const first = elementsById.get(element.id)
      errors.push(
        `${element.relativeFile}: duplicate id "${element.id}" `
        + `(already declared by ${first?.relativeFile})`,
      )
    } else if (typeof element.id === 'string') {
      elementsById.set(element.id, element)
    }
  }

  const resolvedElements = new Map(knownElements)
  for (const [id, element] of elementsById) {
    resolvedElements.set(id, element)
  }

  for (const element of elements) {
    const expectedParentKind = typeof element.kind === 'string'
      ? expectedParentKinds.get(element.kind as C4Kind)
      : undefined
    if (!expectedParentKind || typeof element.parent !== 'string') {
      continue
    }

    const parent = resolvedElements.get(element.parent)
    if (!parent) {
      errors.push(`${element.relativeFile}: unknown parent id "${element.parent}"`)
    } else if (parent.kind !== expectedParentKind) {
      errors.push(
        `${element.relativeFile}: invalid C4 containment; ${element.kind} `
        + `"${element.id}" requires a ${expectedParentKind} parent, `
        + `but "${element.parent}" is a ${parent.kind}`,
      )
    }
  }

  if (errors.length > 0) {
    throw new ArchitectureValidationError(revisionRoot, errors)
  }

  return {
    revisionRoot,
    elementCount: elements.length,
    relationshipCount,
    elements,
  }
}

export async function validateRepository(
  repositoryRoot: string,
): Promise<RevisionValidationResult[]> {
  const observedRoot = path.join(repositoryRoot, 'groma', 'observed')
  const plansRoot = path.join(repositoryRoot, 'groma', 'plans')
  const planEntries = await readdir(plansRoot, { withFileTypes: true })
  const observed = await validateRevision(observedRoot)
  const knownElements = new Map(
    observed.elements
      .filter((element): element is ValidatedElement & { id: string } => {
        return typeof element.id === 'string'
      })
      .map(element => [element.id, element]),
  )
  const plans = []
  for (const entry of planEntries.filter(item => item.isDirectory()).sort((left, right) => {
    return left.name < right.name ? -1 : left.name > right.name ? 1 : 0
  })) {
    plans.push(await validateRevision(path.join(plansRoot, entry.name), { knownElements }))
  }

  return [observed, ...plans]
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  const repositoryRoot = path.resolve(process.argv[2] ?? process.cwd())

  try {
    const results = await validateRepository(repositoryRoot)
    let elementCount = 0
    let relationshipCount = 0

    for (const result of results) {
      elementCount += result.elementCount
      relationshipCount += result.relationshipCount
      console.log(
        `✓ ${path.relative(repositoryRoot, result.revisionRoot)}: `
        + `${result.elementCount} elements, ${result.relationshipCount} relationships`,
      )
    }

    console.log(
      `Validated ${results.length} revisions, ${elementCount} elements, `
      + `${relationshipCount} relationships.`,
    )
  } catch (error) {
    console.error(errorMessage(error))
    process.exitCode = 1
  }
}
