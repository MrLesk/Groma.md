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

/** The text of each element path in a POM, such as `project/build/sourceDirectory`, first occurrence only. */
function pomValues(pom: string): Map<string, string> {
  const values = new Map<string, string>()
  const open: string[] = []
  for (const [, closing, name, attributes, text] of markup(pom).matchAll(/<(\/?)([A-Za-z_][\w.:-]*)([^>]*)>([^<]*)/g)) {
    if (closing) open.pop()
    else if (!attributes!.endsWith('/')) {
      open.push(name!)
      const key = open.join('/')
      if (!values.has(key)) values.set(key, decoded(text!).trim())
    }
  }
  return values
}

/**
 * The source roots a Maven project's scan and listing read, without starting a JVM: none for an aggregator
 * (packaging pom); otherwise project/build/sourceDirectory or src/main/java, where a value that is one `${name}`
 * takes project/properties/name, and `${project.basedir}` or `${basedir}` is the project directory.
 */
export function mavenSourceRoots(directory: string, pom: string): string[] {
  const values = pomValues(pom)
  const text = (key: string) => {
    let value = values.get(key) ?? ''
    for (let count = 0; count < 20 && value.startsWith('${') && value.endsWith('}'); count++) {
      value = values.get(`project/properties/${value.slice(2, -1)}`) ?? ''
    }
    return value
  }
  if (text('project/packaging') === 'pom') return []
  const source = text('project/build/sourceDirectory') || 'src/main/java'
  return [source.replaceAll(/\$\{(?:project\.)?basedir\}/g, () => directory)]
}
