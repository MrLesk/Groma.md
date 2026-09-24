import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { proxyCreateProgram } from '@volar/typescript'
import { createParsedCommandLine, createVueLanguagePlugin, SourceMap, VueVirtualCode, type Language } from '@vue/language-core'
import ts from 'typescript'
import type { ScanDiagnostic, ScanSourceUnit } from '@groma/scanner'
import { hasDependency } from '../../projects.ts'

// Hoisted tooling declarations see the host SDK; the bundled runtime uses the package's pinned TypeScript.
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

function projectConfig(root: string, repositoryRoot: string): string {
  for (let directory = root; ; directory = path.dirname(directory)) {
    const file = path.join(directory, 'tsconfig.json')
    if (existsSync(file)) return file
    if (directory === repositoryRoot) throw new Error(`${root}: no TypeScript config in the package or its repository ancestors`)
  }
}

export class VueProject {
  readonly program: ts.Program
  readonly checker: ts.TypeChecker
  readonly files: ts.SourceFile[]
  readonly root: string
  readonly options
  readonly diagnostics: ScanDiagnostic[]
  private language!: Language<string>
  private readonly plugin

  constructor(root: string, repositoryRoot: string, sources: readonly string[], owners: ReadonlyMap<string, string>,
    excluded: (file: string) => boolean) {
    this.root = repositoryRoot
    const assigned = new Set(sources.map(file => path.resolve(repositoryRoot, file)))
    // A file the config includes is this project's source unless a nested project owns it or the exclusions name
    // it. Exclusions take repository paths, and their matcher throws on a path outside the repository, which a
    // config may include, so such a file is never tested against them.
    const selected = (file: string) => {
      const local = relative(repositoryRoot, file)
      return (owners.get(local) ?? root) === root && (local.startsWith('../') || !excluded(local))
    }
    const configFile = projectConfig(root, repositoryRoot)
    const configRoot = path.dirname(configFile)
    const config = ts.readJsonConfigFile(configFile, ts.sys.readFile)
    const vue = createParsedCommandLine(vueTypeScript, ts.sys, configFile)
    this.options = vue.vueOptions
    this.plugin = createVueLanguagePlugin<string>(vueTypeScript, vue.options, vue.vueOptions, id => id)
    const parsed = ts.parseJsonSourceFileConfigFileContent(config, ts.sys, configRoot, {}, configFile,
      undefined, this.plugin.typescript!.extraFileExtensions)
    failDiagnostics(parsed.errors.filter(item => item.code !== 5083))
    this.diagnostics = parsed.errors.filter(item => item.code === 5083).map(item => ({
      severity: 'warning', code: 'vue-missing-config-base', file: relative(repositoryRoot, configFile),
      message: `The extended TypeScript config is absent; source uses the available settings. ${ts.flattenDiagnosticMessageText(item.messageText, ' ')}`,
    }))
    parsed.options.allowNonTsExtensions = true
    const host = ts.createCompilerHost(parsed.options)
    host.getCurrentDirectory = () => root
    this.program = proxyCreateProgram(vueTypeScript, ts.createProgram, () => ({
      languagePlugins: [this.plugin], setup: language => { this.language = language },
    }))({ rootNames: [...new Set([...assigned, ...parsed.fileNames.filter(selected)])], options: parsed.options, host })
    failDiagnostics(this.program.getSyntacticDiagnostics())
    this.diagnostics.push(...this.program.getOptionsDiagnostics().filter(item => item.code === 6053).map(item => ({
      severity: 'warning', code: 'vue-missing-config-source', file: relative(repositoryRoot, configFile),
      message: `A declared TypeScript source is absent; available source was still scanned. ${ts.flattenDiagnosticMessageText(item.messageText, ' ')}`,
    })))
    this.checker = this.program.getTypeChecker()
    this.files = this.program.getSourceFiles().filter(source => this.owned(source) && selected(source.fileName))
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

  sourceUnit(file: string): ScanSourceUnit | undefined {
    const sfc = this.sfc(file)
    if (!sfc) return undefined
    const primary = relative(this.root, file)
    const blocks = [sfc.ir.script, sfc.ir.template, ...sfc.ir.styles]
    const companions = blocks.flatMap(block => {
      const src = block?.attrs.src
      if (typeof src !== 'string' || !src.startsWith('.')) return []
      const filename = path.resolve(path.dirname(file), src)
      const member = relative(this.root, filename)
      if (member.startsWith('../')) return []
      readFileSync(filename, 'utf8')
      return [member]
    })
    return { primary, files: [primary, ...companions] }
  }

  private validateSfc(file: string): void {
    const sfc = this.sfc(file)
    if (!sfc) return
    if (sfc.ir.scriptSetup && (sfc.ir.scriptSetup.attrs.src !== undefined || sfc.ir.script?.attrs.src !== undefined)) {
      throw new Error(`${file}: script setup cannot use src or be combined with an external script block`)
    }
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

export function vueProject(root: string, repositoryRoot = root, sources: readonly string[] = [], owners: ReadonlyMap<string, string> = new Map(),
  excluded: (file: string) => boolean = () => false) {
  const manifestFile = path.join(root, 'package.json')
  if (!existsSync(manifestFile)) return undefined
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
  if (!hasDependency(manifest, 'vue')) return undefined
  try {
    return { manifest, project: new VueProject(root, repositoryRoot, sources, owners, excluded) }
  } catch (error) {
    throw new Error(`VUE_SOURCE_INVALID: Check the project tsconfig.json and Vue syntax. ${error}`)
  }
}
