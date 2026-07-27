import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse } from 'comark'

const allowedFrontmatterFields = new Set(['id', 'kind', 'parent', 'external'])
const allowedKinds = new Set(['person', 'system', 'container', 'component'])
const expectedParentKinds = new Map([
  ['container', 'system'],
  ['component', 'container'],
])
const elementPathPatterns = [
  /^people\/[^/]+\.md$/,
  /^systems\/[^/]+\/system\.md$/,
  /^systems\/[^/]+\/containers\/[^/]+\/container\.md$/,
  /^systems\/[^/]+\/containers\/[^/]+\/components\/[^/]+\.md$/,
]

export class ArchitectureValidationError extends Error {
  constructor(revisionRoot, errors) {
    const details = errors.map(error => `- ${error}`).join('\n')
    super(`${revisionRoot} is invalid:\n${details}`)
    this.name = 'ArchitectureValidationError'
    this.errors = errors
  }
}

async function listMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

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

function isElementPath(revisionRoot, file) {
  const relativePath = path.relative(revisionRoot, file).split(path.sep).join('/')
  return elementPathPatterns.some(pattern => pattern.test(relativePath))
}

function collectLinks(node, links = []) {
  if (!Array.isArray(node)) {
    return links
  }

  const isAstNode = typeof node[0] === 'string'
  if (isAstNode && node[0] === 'a' && node[1]?.href) {
    links.push(node[1].href)
  }

  const children = isAstNode ? node.slice(2) : node
  for (const child of children) {
    collectLinks(child, links)
  }

  return links
}

function collectNodes(node, tag, nodes = []) {
  if (!Array.isArray(node)) {
    return nodes
  }

  const isAstNode = typeof node[0] === 'string'
  if (isAstNode && node[0] === tag) {
    nodes.push(node)
  }

  const children = isAstNode ? node.slice(2) : node
  for (const child of children) {
    collectNodes(child, tag, nodes)
  }

  return nodes
}

function collectRelationshipTargets(nodes) {
  const targets = []
  let inRelationshipsSection = false

  for (const node of nodes) {
    if (node[0] === 'h2') {
      inRelationshipsSection = node[1]?.id === 'relationships'
      continue
    }

    if (!inRelationshipsSection || node[0] !== 'table') {
      continue
    }

    for (const row of collectNodes(node, 'tr')) {
      const cells = row.slice(2).filter(child => child[0] === 'td')
      if (cells.length === 0) {
        continue
      }

      targets.push(collectLinks(cells[0])[0])
    }
  }

  return targets
}

function nodeText(node) {
  if (typeof node === 'string') {
    return node
  }

  if (!Array.isArray(node)) {
    return ''
  }

  const isAstNode = typeof node[0] === 'string'
  const children = isAstNode ? node.slice(2) : node
  return children.map(nodeText).join('')
}

function isRelativeMarkdownLink(href) {
  if (typeof href !== 'string') {
    return false
  }

  return !href.startsWith('#')
    && !path.isAbsolute(href)
    && !/^[a-z][a-z\d+.-]*:/i.test(href)
    && href.split('#', 1)[0].endsWith('.md')
}

export async function validateRevision(revisionRoot) {
  const absoluteRoot = path.resolve(revisionRoot)
  const markdownFiles = await listMarkdownFiles(absoluteRoot)
  const elementFiles = markdownFiles.filter(file => isElementPath(absoluteRoot, file))
  const elementFileSet = new Set(elementFiles.map(file => path.resolve(file)))
  const elements = []
  const errors = []
  let relationshipCount = 0

  if (elementFiles.length === 0) {
    errors.push('contains no element documents')
  }

  for (const file of elementFiles) {
    const relativeFile = path.relative(absoluteRoot, file)
    const source = await readFile(file, 'utf8')
    let tree

    try {
      tree = await parse(source)
      JSON.stringify(tree)
    } catch (error) {
      errors.push(`${relativeFile}: Comark could not parse the document (${error.message})`)
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

    if (!allowedKinds.has(frontmatter.kind)) {
      errors.push(`${relativeFile}: kind must be person, system, container, or component`)
    }

    if (expectedParentKinds.has(frontmatter.kind)) {
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

    const relationshipTargets = collectRelationshipTargets(tree.nodes)
    for (const href of relationshipTargets) {
      relationshipCount += 1
      if (!isRelativeMarkdownLink(href)) {
        errors.push(
          `${relativeFile}: relationship target must be a relative Markdown link `
          + `"${href ?? '(missing link)'}"`,
        )
        continue
      }

      const hrefPath = decodeURIComponent(href.split('#', 1)[0])
      const target = path.resolve(path.dirname(file), hrefPath)

      if (!elementFileSet.has(target)) {
        errors.push(`${relativeFile}: broken relationship link "${href}"`)
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

  const elementsById = new Map()
  for (const element of elements) {
    if (elementsById.has(element.id)) {
      const first = elementsById.get(element.id)
      errors.push(
        `${element.relativeFile}: duplicate id "${element.id}" `
        + `(already declared by ${first.relativeFile})`,
      )
    } else if (element.id !== undefined) {
      elementsById.set(element.id, element)
    }
  }

  for (const element of elements) {
    const expectedParentKind = expectedParentKinds.get(element.kind)
    if (!expectedParentKind || typeof element.parent !== 'string') {
      continue
    }

    const parent = elementsById.get(element.parent)
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
  }
}

export async function validateRepository(repositoryRoot) {
  const observedRoot = path.join(repositoryRoot, 'groma', 'observed')
  const plansRoot = path.join(repositoryRoot, 'groma', 'plans')
  const planEntries = await readdir(plansRoot, { withFileTypes: true })
  const revisionRoots = [
    observedRoot,
    ...planEntries
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(plansRoot, entry.name))
      .sort(),
  ]

  return Promise.all(revisionRoots.map(validateRevision))
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
    console.error(error.message)
    process.exitCode = 1
  }
}
