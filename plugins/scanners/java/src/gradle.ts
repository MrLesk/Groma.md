import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createScanObservation, type ScanDiagnostic, type ScanObservation } from '@groma/scanner'
import { lang, type lexer, type parser } from 'good-enough-parser'
import parserPackage from 'good-enough-parser/package.json'
import { projectFiles } from '../../projects.ts'

type Node = parser.Node

export const buildScripts = ['build.gradle', 'build.gradle.kts']
export const settingsScripts = ['settings.gradle', 'settings.gradle.kts']

// Groovy and Kotlin build scripts share the tokens, brackets and strings these declarations use.
const groovy = lang.createLang('groovy')
const conventionalSources = 'src/main/java'
const skipped = new Set(['whitespace', 'comment', '_start', '_end'])
const listWrappers = new Set(['file', 'files', 'listOf', 'setOf'])
const versionWrappers = new Set(['JavaVersion', 'JavaLanguageVersion', 'of', 'toVersion'])
const sourceSetters = new Set(['srcDir', 'srcDirs', 'setSrcDirs'])
// Declarations under control flow or inside a function apply only when a Gradle run takes that path.
const controlFlow = new Set(['if', 'else', 'when', 'switch', 'for', 'while', 'do', 'try', 'catch', 'finally'])
/** Stands in the path for a function body, such as `private def f() {` or `fun f() {`. */
const functionBody = '<function>'
/** Stands in the path for a selector the scanner cannot read, such as `named(name)`. */
const unreadable = '?'
/** Stands in the path for the selector of `project(...)` or `configure(...)`, which name other projects. */
const otherProjects = '<other projects>'
const projectSelectors = new Set(['project', 'configure'])
/** Blocks that configure every element of a collection, such as every source set. */
const everyElement = new Set(['all', 'configureEach', 'each', 'forEach'])

/** Literal declarations read from one Gradle script; nothing is evaluated. */
export interface GradleScript {
  name?: string
  includes: string[]
  release?: string
  sourceRoots: string[]
  diagnostics: ScanDiagnostic[]
}

interface Statement {
  path: string[]
  values: Node[]
  /** `=` and `.set(...)` replace a value; calls such as `srcDir(...)` add to it. */
  assigned: boolean
  line: number
}

type Versions = Partial<Record<'release' | 'source' | 'toolchain', string>>
/** Reads one declaration; returns why it was not fully read, or undefined. */
type Reader = (script: GradleScript, versions: Versions, statement: Statement) => string | undefined

const unresolved = 'needs a Gradle run to resolve; the scan uses literal declarations and Gradle conventions.'
const configuresOthers = 'applies to this project; the other projects it configures need a Gradle run to resolve.'

function isTree(node: Node | undefined, bracket: string): node is parser.WrappedTree {
  return node?.type === 'wrapped-tree' && node.startsWith.value === bracket
}

function isOperator(node: Node | undefined, value?: string): boolean {
  return node?.type === 'operator' && (value === undefined || node.value === value)
}

function significant(nodes: Node[]): Node[] {
  return nodes.filter(node => !skipped.has(node.type) && node.type !== 'newline')
}

function stringValue(node: Node): string | undefined {
  if (node.type !== 'string-tree') return undefined
  let value = ''
  for (const part of node.children) {
    if (part.type === 'string-value') value += part.value
    else if (!skipped.has(part.type)) return undefined
  }
  return value
}

/** A line ends a statement unless it ends with an operator such as `,`. */
function statements(children: Node[]): Node[][] {
  const found: Node[][] = []
  let current: Node[] = []
  for (const node of children) {
    if (skipped.has(node.type)) continue
    if (node.type !== 'newline' && !isOperator(node, ';')) current.push(node)
    else if (current.length > 0 && !isOperator(current.at(-1))) {
      found.push(current)
      current = []
    }
  }
  if (current.length > 0) found.push(current)
  return found
}

/** The literal string a selector or block-call argument names, or `unreadable` when it holds anything else. */
function selected(node: Node): string[] {
  const [only, ...others] = 'children' in node ? significant(node.children) : []
  if (only === undefined) return []
  const value = others.length === 0 ? stringValue(only) : undefined
  return [value ?? unreadable]
}

/** The names a selector after `name` adds to the path. */
function selector(name: string | undefined, node: Node): string[] {
  return name !== undefined && projectSelectors.has(name) ? [otherProjects] : selected(node)
}

/** `sourceSets["main"].java` and `getByName("main").java` name the element they select. */
function chain(nodes: Node[]): { names: string[]; rest: Node[] } {
  const names: string[] = []
  let index = 0
  for (let node = nodes[0]; node?.type === 'symbol'; node = nodes[index]) {
    names.push(node.value)
    index += 1
    while (isTree(nodes[index], '[') || (isTree(nodes[index], '(') && isOperator(nodes[index + 1], '.'))) {
      names.push(...selector(names.at(-1), nodes[index]!))
      index += 1
    }
    if (!isOperator(nodes[index], '.')) break
    index += 1
  }
  return { names, rest: nodes.slice(index) }
}

function statementOf(path: string[], rest: Node[], line: number): Statement {
  const [first] = rest
  if (isOperator(first, '=')) return { path, values: rest.slice(1), assigned: true, line }
  if (isTree(first, '(') && rest.length === 1) {
    const setter = path.at(-1) === 'set'
    return { path: setter ? path.slice(0, -1) : path, values: first.children, assigned: setter, line }
  }
  return { path, values: isOperator(first, '+=') ? rest.slice(1) : rest, assigned: false, line }
}

/**
 * The path a statement's blocks configure. Block-call arguments join it: `named("main") {` scopes like `main {`.
 * A name after the chain, as in `def f() {`, declares a function.
 */
function blockScope(path: string[], rest: Node[]): string[] {
  const body = rest[0]?.type === 'symbol' ? [functionBody] : []
  return [...path, ...body, ...rest.filter(node => isTree(node, '(')).flatMap(node => selector(path.at(-1), node))]
}

function readBlock(children: Node[], scope: string[], visit: (statement: Statement) => void): void {
  for (const nodes of statements(children)) {
    const { names, rest } = chain(nodes)
    if (names.length === 0) continue
    const path = [...scope, ...names]
    if (isTree(rest.at(-1), '{') && !rest.some(node => isOperator(node, '='))) {
      // Every block is read, such as both of `if (...) { } else { }`.
      const scoped = blockScope(path, rest)
      for (const block of rest) if (isTree(block, '{')) readBlock(block.children, scoped, visit)
    } else visit(statementOf(path, rest, (nodes[0] as lexer.Token).line))
  }
}

function elements(nodes: Node[]): Node[][] {
  const found: Node[][] = [[]]
  for (const node of significant(nodes)) {
    if (isOperator(node, ',')) found.push([])
    else found.at(-1)!.push(node)
  }
  return found.filter(element => element.length > 0)
}

/** A string, a bracketed list, or a `file`, `files`, `listOf` or `setOf` call, which only groups strings. */
function literalElement([first, second, ...others]: Node[]): { values: string[]; complete: boolean } | undefined {
  const value = first !== undefined && second === undefined ? stringValue(first) : undefined
  if (value !== undefined) return { values: [value], complete: true }
  const wrapper = first?.type === 'symbol' && listWrappers.has(first.value) && others.length === 0
  const list = second === undefined ? first : wrapper ? second : undefined
  return list?.type === 'wrapped-tree' ? literalStrings(list.children) : undefined
}

/** String values of a comma-separated value; `complete` is false when any element needs evaluation. */
function literalStrings(nodes: Node[]): { values: string[]; complete: boolean } {
  const result = { values: [] as string[], complete: true }
  for (const element of elements(nodes)) {
    const inner = literalElement(element)
    result.values.push(...inner?.values ?? [])
    result.complete &&= inner?.complete ?? false
  }
  return result
}

function versionPart(node: Node): string[] | undefined {
  if (node.type === 'wrapped-tree') return versionParts(node.children)
  const text = stringValue(node) ?? (node.type === 'number' ? node.value : undefined)
  if (text !== undefined) return [text]
  if (node.type !== 'symbol') return isOperator(node, '.') ? [] : undefined
  if (/^VERSION_[\d_]+$/.test(node.value)) return [node.value.slice(8).replace('_', '.')]
  return versionWrappers.has(node.value) ? [] : undefined
}

function versionParts(nodes: Node[]): string[] | undefined {
  const parts: string[] = []
  for (const node of significant(nodes)) {
    // The tokenizer splits `1.8` into `1` and `.8`.
    if (node.type === 'number' && node.value.startsWith('.') && parts.length > 0) {
      parts[parts.length - 1] += node.value
      continue
    }
    const found = versionPart(node)
    if (found === undefined) return undefined
    parts.push(...found)
  }
  return parts
}

/** `17`, `'17'`, `1.8`, `JavaVersion.VERSION_17` or `JavaLanguageVersion.of(17)`. */
function literalVersion(nodes: Node[]): string | undefined {
  const parts = versionParts(nodes)
  const version = parts?.length === 1 ? parts[0]!.replace(/^1\./, '') : undefined
  return version !== undefined && /^\d+$/.test(version) ? version : undefined
}

function versionReader(key: keyof Versions): Reader {
  return (_script, versions, { values }) => {
    const version = literalVersion(values)
    if (version === undefined) return unresolved
    versions[key] = version
    return undefined
  }
}

type Readers = [matches: (path: string[]) => boolean, read: Reader][]

const settingsReaders: Readers = [
  [path => path.join('.') === 'rootProject.name', (script, _versions, { values }) => {
    const { values: names, complete } = literalStrings(values)
    if (!complete || names.length !== 1) return unresolved
    script.name = names[0]
    return undefined
  }],
  [path => path.at(-1) === 'include', (script, _versions, { values }) => {
    const found = literalStrings(values)
    script.includes.push(...found.values)
    return found.complete ? undefined : unresolved
  }],
  // Even a literal value is reported: the scanner does not relocate projects.
  [path => path.at(-1) === 'projectDir' || path.at(-1) === 'buildFileName',
    () => "is not applied; the scan uses Gradle's default project directory and build script name."],
]

/** A source set the scanner cannot name, such as `named(name)` or every source set in `all { }`, may be `main`. */
function unnamedSourceSet(path: string[]): boolean {
  return path.some(name => name === unreadable || everyElement.has(name))
}

/**
 * Blocks, dotted chains and selectors such as `named("main")` spell the same source set, so the path only needs `main`
 * and `java`.
 */
function mainSources(path: string[]): boolean {
  return sourceSetters.has(path.at(-1)!) && path.includes('java') && (path.includes('main') || unnamedSourceSet(path))
}

const buildReaders: Readers = [
  [mainSources, (script, _versions, statement) => {
    if (unnamedSourceSet(statement.path)) return unresolved
    const found = literalStrings(statement.values)
    const replace = statement.assigned || statement.path.at(-1) === 'setSrcDirs'
    script.sourceRoots = replace ? found.values : [...script.sourceRoots, ...found.values]
    return found.complete ? undefined : unresolved
  }],
  [path => path.at(-1) === 'release' && path.includes('options'), versionReader('release')],
  [path => path.at(-1) === 'sourceCompatibility', versionReader('source')],
  [path => path.at(-1) === 'languageVersion' && path.includes('toolchain'), versionReader('toolchain')],
]

/**
 * A declaration under control flow or in a function applies only when a Gradle run takes that path, and a build
 * declaration for other projects, such as in `subprojects`, `rootProject` or `project(...)`, only in their runs.
 */
function conditional(path: string[], settings: boolean): boolean {
  const others = !settings && path.some(name => name === otherProjects || name === 'subprojects' || name === 'rootProject')
  return others || path.some(name => controlFlow.has(name) || name === functionBody)
}

export function readGradleScript(source: string, file: string): GradleScript {
  const script: GradleScript = { includes: [], sourceRoots: [conventionalSources], diagnostics: [] }
  const versions: Versions = {}
  const settings = settingsScripts.includes(path.posix.basename(file))
  const readers = settings ? settingsReaders : buildReaders
  readBlock((groovy.parse(source).node as parser.RootTree).children, [], statement => {
    const reader = readers.find(([matches]) => matches(statement.path))?.[1]
    if (reader === undefined) return
    // `allprojects` also configures the project whose script declares it.
    const others = !settings && statement.path.includes('allprojects') ? configuresOthers : undefined
    const reason = conditional(statement.path, settings) ? unresolved : (reader(script, versions, statement) ?? others)
    if (reason === undefined) return
    script.diagnostics.push({
      severity: 'warning', code: 'JAVA_GRADLE_UNRESOLVED', file, line: statement.line,
      message: `${statement.path.join('.')} ${reason}`,
    })
  })
  const release = versions.release ?? versions.source ?? versions.toolchain
  return { ...script, ...(release === undefined ? {} : { release }) }
}

async function readOptional(file: string): Promise<string | undefined> {
  return readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined
    throw error
  })
}

/** Existing directories of every Gradle project under root: script directories and literal includes. */
export async function gradleProjects(root: string): Promise<{ directories: string[]; diagnostics: ScanDiagnostic[] }> {
  const files = await projectFiles(root, file => [...buildScripts, ...settingsScripts].includes(path.posix.basename(file)))
  const directories = new Set<string>()
  const diagnostics: ScanDiagnostic[] = []
  for (const file of files) {
    const directory = path.posix.dirname(file)
    const script = readGradleScript(await readFile(path.join(root, file), 'utf8'), file)
    directories.add(directory)
    diagnostics.push(...script.diagnostics)
    // Only settings scripts include projects. Gradle's default directory for `:a:b` is `a/b` below that script.
    for (const include of script.includes) directories.add(path.posix.join(directory, ...include.split(':').filter(Boolean)))
  }
  const found = [...directories].map(directory => path.join(root, directory))
  return { directories: found.filter(directory => existsSync(directory)), diagnostics }
}

export interface GradleProject {
  name: string
  file?: string
  release?: string
  sourceRoots: string[]
}

/**
 * One project's own literal declarations; the settings script beside it names a root project.
 * The shared project scanner passes each project only its directory, so its scripts are read again here;
 * warnings come from gradleProjects.
 */
export async function readGradleProject(directory: string): Promise<GradleProject> {
  const project: GradleProject = { name: path.basename(directory), sourceRoots: [conventionalSources] }
  for (const file of [...settingsScripts, ...buildScripts]) {
    const source = await readOptional(path.join(directory, file))
    if (source === undefined) continue
    const script = readGradleScript(source, file)
    project.file = file
    if (settingsScripts.includes(file)) project.name = script.name ?? project.name
    else return { ...project, sourceRoots: script.sourceRoots, ...(script.release ? { release: script.release } : {}) }
  }
  return project
}

const scriptReader = { id: 'java', technology: 'java', engine: 'good-enough-parser', engineVersion: parserPackage.version }

/** Gradle warnings join the Java evidence, and still reach the scan report when no project produced any. */
export function withGradleDiagnostics(observation: ScanObservation | undefined, diagnostics: ScanDiagnostic[]): ScanObservation | undefined {
  if (diagnostics.length === 0) return observation
  const base = observation ?? { scanner: scriptReader, roots: [], files: [], diagnostics: [] }
  return createScanObservation({ ...base, diagnostics: [...base.diagnostics, ...diagnostics] })
}
