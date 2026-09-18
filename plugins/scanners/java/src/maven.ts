const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/** Character data with its character and predefined entity references resolved. */
function decoded(text: string): string {
  return text.replace(/&(?:#x([\da-fA-F]+)|#(\d+)|(amp|lt|gt|quot|apos));/g, (_, hex, decimal, name) => (
    hex ? String.fromCodePoint(Number.parseInt(hex, 16)) : decimal ? String.fromCodePoint(Number(decimal)) : ENTITIES[name]!
  ))
}

/** Comments dropped and CDATA sections re-escaped as ordinary character data. */
function markup(pom: string): string {
  return pom.replace(/<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, cdata?: string) => (
    cdata === undefined ? '' : cdata.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  ))
}

interface PomElement {
  name: string
  /** The character data that opens the element, which is all of a leaf's text. */
  text: string
  children: PomElement[]
}

/** The POM's elements as a tree under an unnamed document root. */
function pomTree(pom: string): PomElement {
  const document: PomElement = { name: '', text: '', children: [] }
  const open = [document]
  for (const [, closing, name, attributes, text] of markup(pom).matchAll(/<(\/?)([A-Za-z_][\w.:-]*)([^>]*)>([^<]*)/g)) {
    if (closing) {
      if (open.length > 1) open.pop()
      continue
    }
    const empty = attributes!.endsWith('/')
    const element = { name: name!, text: empty ? '' : decoded(text!).trim(), children: [] }
    open.at(-1)!.children.push(element)
    if (!empty) open.push(element)
  }
  return document
}

/** The first element down this path of child names. */
function at(element: PomElement | undefined, ...names: string[]): PomElement | undefined {
  return names.reduce<PomElement | undefined>((current, name) => current?.children.find(child => child.name === name), element)
}

export interface MavenProject {
  /** Empty when the POM declares none; the bundled compiler's version then applies. */
  release: string
  encoding: string
  name: string
  sourceRoots: string[]
}

/**
 * A Maven project's declared settings, read without Maven: its source root (project/build/sourceDirectory or
 * src/main/java), language version and encoding (the maven-compiler-plugin configuration, then the conventional
 * properties) and artifactId. `${basedir}` and `${project.basedir}` are the project directory, and a value that is
 * one `${name}` takes project/properties/name. Undefined for an aggregator (packaging pom), which has no sources.
 */
export function readMavenProject(directory: string, pom: string): MavenProject | undefined {
  const project = at(pomTree(pom), 'project')
  const value = (element: PomElement | undefined) => {
    const resolve = (text: string) => text.replaceAll(/\$\{(?:project\.)?basedir\}/g, () => directory)
    let text = resolve(element?.text ?? '')
    for (let count = 0; count < 20 && text.startsWith('${') && text.endsWith('}'); count++) {
      text = resolve(at(project, 'properties', text.slice(2, -1))?.text ?? '')
    }
    return text
  }
  const first = (...elements: (PomElement | undefined)[]) => elements.map(value).find(text => text !== '') ?? ''
  if (value(at(project, 'packaging')) === 'pom') return undefined
  const compiler = at(at(project, 'build', 'plugins')?.children
    .find(plugin => plugin.name === 'plugin' && at(plugin, 'artifactId')?.text === 'maven-compiler-plugin'), 'configuration')
  const property = (name: string) => at(project, 'properties', name)
  const release = first(at(compiler, 'release'), property('maven.compiler.release'), property('java.version'), property('maven.compiler.source'))
  return {
    release: release.startsWith('1.') ? release.slice(2) : release,
    encoding: first(at(compiler, 'encoding'), property('project.build.sourceEncoding')) || 'UTF-8',
    name: value(at(project, 'artifactId')),
    sourceRoots: [value(at(project, 'build', 'sourceDirectory')) || 'src/main/java'],
  }
}
