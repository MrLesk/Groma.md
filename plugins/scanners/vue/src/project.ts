import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { proxyCreateProgram } from '@volar/typescript'
import { createParsedCommandLine, createVueLanguagePlugin, SourceMap, VueVirtualCode, type Language } from '@vue/language-core'
import ts from 'typescript'

// Hoisted tooling declarations see the host SDK; the bundled runtime uses pinned TS 5.9.3.
export const vueTypeScript = ts as unknown as Parameters<typeof createVueLanguagePlugin>[0]

export function relative(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/')
}

export function nodeAt(node: ts.Node, position: number): ts.Node {
  let result = node
  node.forEachChild(child => {
    if (child.getStart() <= position && child.end > position) result = nodeAt(child, position)
  })
  return result
}

export function failDiagnostics(diagnostics: readonly ts.Diagnostic[]): void {
  const errors = diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(errors.map(item =>
    `${item.file?.fileName ?? 'Vue'}: ${ts.flattenDiagnosticMessageText(item.messageText, '\n')}`).join('\n'))
}

export class VueProject {
  readonly program: ts.Program
  readonly checker: ts.TypeChecker
  readonly files: ts.SourceFile[]
  readonly root: string
  readonly options
  private language!: Language<string>
  private readonly plugin

  constructor(root: string) {
    this.root = root
    const configFile = path.join(root, 'tsconfig.json')
    const config = ts.readJsonConfigFile(configFile, ts.sys.readFile)
    const vue = createParsedCommandLine(vueTypeScript, ts.sys, configFile)
    this.options = vue.vueOptions
    this.plugin = createVueLanguagePlugin<string>(vueTypeScript, vue.options, vue.vueOptions, id => id)
    const parsed = ts.parseJsonSourceFileConfigFileContent(config, ts.sys, root, {}, configFile,
      undefined, this.plugin.typescript!.extraFileExtensions)
    failDiagnostics(parsed.errors)
    parsed.options.allowNonTsExtensions = true
    const host = ts.createCompilerHost(parsed.options)
    host.getCurrentDirectory = () => root
    this.program = proxyCreateProgram(vueTypeScript, ts.createProgram, () => ({
      languagePlugins: [this.plugin], setup: language => { this.language = language },
    }))({ rootNames: parsed.fileNames, options: parsed.options, host })
    failDiagnostics(this.program.getSyntacticDiagnostics())
    this.checker = this.program.getTypeChecker()
    this.files = this.program.getSourceFiles().filter(source => this.owned(source))
    for (const source of this.files) this.validateSfc(source.fileName)
  }

  owned(source: ts.SourceFile): boolean {
    return !source.isDeclarationFile && !relative(this.root, source.fileName).startsWith('../')
      && !source.fileName.includes('/node_modules/')
  }

  sfc(file: string): VueVirtualCode | undefined {
    const code = this.language.scripts.get(file)?.generated?.root
    return code instanceof VueVirtualCode ? code : undefined
  }

  private validateSfc(file: string): void {
    const sfc = this.sfc(file)
    if (!sfc) return
    const errors = [...sfc.vueSfc?.errors ?? [], ...sfc.ir.template?.errors ?? []]
    if (errors.length) throw new Error(`${file}: ${errors.map(error => typeof error === 'string' ? error : error.message).join('\n')}`)
  }

  private mapping(file: string) {
    const sfc = this.sfc(file)
    const service = sfc && this.plugin.typescript!.getServiceScript(sfc)
    return service && { map: new SourceMap(service.code.mappings), offset: service.preventLeadingOffset ? 0 : sfc!.snapshot.getLength() }
  }

  /** Query compiler nodes through Volar mappings, never generated identifier spellings. */
  nodes(file: string, position: number): ts.Node[] {
    const source = this.program.getSourceFile(file)
    if (!source) return []
    const mapping = this.mapping(file)
    if (!mapping) return [nodeAt(source, position)]
    return [...mapping.map.toGeneratedLocation(position)].map(([offset]) => nodeAt(source, offset + mapping.offset))
  }

  position(node: ts.Node): number | undefined {
    const mapping = this.mapping(node.getSourceFile().fileName)
    if (!mapping) return node.getStart()
    const positions = new Set([...mapping.map.toSourceLocation(node.getStart() - mapping.offset)].map(([offset]) => offset))
    return positions.size === 1 ? [...positions][0] : undefined
  }

  text(file: string): string {
    return this.sfc(file)?.ir.content ?? this.program.getSourceFile(file)!.text
  }

  line(file: string, position: number): number {
    return this.text(file).slice(0, position).split('\n').length
  }
}

export function vueProject(root: string) {
  const manifestFile = path.join(root, 'package.json')
  if (!existsSync(manifestFile)) return undefined
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
  if (!manifest.dependencies?.vue && !manifest.devDependencies?.vue) return undefined
  try {
    createRequire(manifestFile).resolve('vue/package.json')
    return { manifest, project: new VueProject(root) }
  } catch (error) {
    throw new Error(`VUE_PROJECT_PREPARATION: Install project dependencies with its declared package manager and lockfile; ensure root tsconfig.json and Vue sources are valid. ${error}`)
  }
}
