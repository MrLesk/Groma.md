import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { parse } from "@babel/parser";

const layerNames = ["core", "standard-model", "persistence", "application", "host", "cli"] as const;

type LayerName = (typeof layerNames)[number];

const knownLayers = new Set<string>(layerNames);

const allowedLayerDependencies: Readonly<Record<LayerName, ReadonlySet<LayerName>>> = {
  core: new Set(["core"]),
  "standard-model": new Set(["core", "standard-model"]),
  persistence: new Set(["core", "standard-model", "persistence"]),
  application: new Set(["core", "standard-model", "application"]),
  host: new Set(layerNames),
  cli: new Set(["application", "host", "cli"]),
};

const layersWithoutProductionExternalDependencies = new Set<LayerName>([
  "core",
  "standard-model",
  "application",
]);

export interface BoundaryViolation {
  file: string;
  reason: string;
  specifier?: string;
}

function isLayerName(value: string): value is LayerName {
  return knownLayers.has(value);
}

function layerForFile(sourceRoot: string, file: string): LayerName | undefined {
  const relativePath = path.relative(sourceRoot, file);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return undefined;
  }

  const [directory] = relativePath.split(path.sep);
  return directory !== undefined && isLayerName(directory) ? directory : undefined;
}

interface AstNode {
  type: string;
  [key: string]: unknown;
}

function isAstNode(value: unknown): value is AstNode {
  return (
    typeof value === "object" && value !== null && "type" in value && typeof value.type === "string"
  );
}

function stringLiteralValue(value: unknown): string | undefined {
  if (!isAstNode(value) || value.type !== "StringLiteral") {
    return undefined;
  }

  return typeof value.value === "string" ? value.value : undefined;
}

interface LexicalScope {
  readonly bindings: Set<string>;
  readonly kind: "block" | "function";
  readonly parent?: LexicalScope;
}

const functionNodeTypes = new Set([
  "ArrowFunctionExpression",
  "ClassMethod",
  "ClassPrivateMethod",
  "FunctionDeclaration",
  "FunctionExpression",
  "ObjectMethod",
]);
const blockScopeNodeTypes = new Set([
  "BlockStatement",
  "CatchClause",
  "ForInStatement",
  "ForOfStatement",
  "ForStatement",
  "StaticBlock",
  "SwitchStatement",
]);

function identifierName(value: unknown): string | undefined {
  return isAstNode(value) && value.type === "Identifier" && typeof value.name === "string"
    ? value.name
    : undefined;
}

function addPatternBindings(pattern: unknown, scope: LexicalScope): void {
  if (!isAstNode(pattern)) return;

  const name = identifierName(pattern);
  if (name !== undefined) {
    scope.bindings.add(name);
    return;
  }

  if (pattern.type === "AssignmentPattern") {
    addPatternBindings(pattern.left, scope);
  } else if (pattern.type === "RestElement") {
    addPatternBindings(pattern.argument, scope);
  } else if (pattern.type === "TSParameterProperty") {
    addPatternBindings(pattern.parameter, scope);
  } else if (pattern.type === "ArrayPattern" && Array.isArray(pattern.elements)) {
    for (const element of pattern.elements) addPatternBindings(element, scope);
  } else if (pattern.type === "ObjectPattern" && Array.isArray(pattern.properties)) {
    for (const property of pattern.properties) {
      if (!isAstNode(property)) continue;
      addPatternBindings(
        property.type === "RestElement" ? property.argument : property.value,
        scope,
      );
    }
  }
}

function nearestFunctionScope(scope: LexicalScope): LexicalScope {
  let current = scope;
  while (current.kind !== "function" && current.parent !== undefined) {
    current = current.parent;
  }
  return current;
}

function collectLexicalScopes(syntaxTree: unknown): WeakMap<AstNode, LexicalScope> {
  const scopes = new WeakMap<AstNode, LexicalScope>();
  const rootScope: LexicalScope = { bindings: new Set(), kind: "function" };

  function collect(value: unknown, currentScope: LexicalScope, ambientContext = false): void {
    if (Array.isArray(value)) {
      for (const item of value) collect(item, currentScope, ambientContext);
      return;
    }
    if (!isAstNode(value)) return;

    let nodeScope = currentScope;
    if (value.type === "Program") {
      nodeScope = { bindings: new Set(), kind: "function", parent: currentScope };
    } else if (functionNodeTypes.has(value.type)) {
      if (!ambientContext && value.type === "FunctionDeclaration") {
        addPatternBindings(value.id, currentScope);
      }
      nodeScope = { bindings: new Set(), kind: "function", parent: currentScope };
      if (!ambientContext && value.type === "FunctionExpression") {
        addPatternBindings(value.id, nodeScope);
      }
      if (!ambientContext && Array.isArray(value.params)) {
        for (const parameter of value.params) addPatternBindings(parameter, nodeScope);
      }
    } else if (value.type === "ClassDeclaration" || value.type === "ClassExpression") {
      if (!ambientContext && value.type === "ClassDeclaration") {
        addPatternBindings(value.id, currentScope);
      }
      nodeScope = { bindings: new Set(), kind: "block", parent: currentScope };
      if (!ambientContext) addPatternBindings(value.id, nodeScope);
    } else if (value.type === "TSModuleDeclaration") {
      const moduleIsAmbient = ambientContext || value.declare === true || value.kind === "global";
      if (!moduleIsAmbient) addPatternBindings(value.id, currentScope);
      nodeScope = { bindings: new Set(), kind: "function", parent: currentScope };
      ambientContext = moduleIsAmbient;
    } else if (blockScopeNodeTypes.has(value.type)) {
      nodeScope = { bindings: new Set(), kind: "block", parent: currentScope };
      if (!ambientContext && value.type === "CatchClause") {
        addPatternBindings(value.param, nodeScope);
      }
    }
    scopes.set(value, nodeScope);

    if (
      !ambientContext &&
      value.type === "VariableDeclaration" &&
      Array.isArray(value.declarations)
    ) {
      const bindingScope = value.kind === "var" ? nearestFunctionScope(nodeScope) : nodeScope;
      for (const declaration of value.declarations) {
        if (isAstNode(declaration)) addPatternBindings(declaration.id, bindingScope);
      }
    } else if (
      !ambientContext &&
      value.type === "ImportDeclaration" &&
      value.importKind !== "type" &&
      Array.isArray(value.specifiers)
    ) {
      for (const specifier of value.specifiers) {
        if (isAstNode(specifier) && specifier.importKind !== "type") {
          addPatternBindings(specifier.local, nodeScope);
        }
      }
    } else if (
      !ambientContext &&
      value.type === "TSImportEqualsDeclaration" &&
      value.importKind !== "type"
    ) {
      addPatternBindings(value.id, nodeScope);
    } else if (!ambientContext && value.type === "TSDeclareFunction") {
      addPatternBindings(value.id, nodeScope);
    } else if (!ambientContext && value.type === "TSEnumDeclaration") {
      addPatternBindings(value.id, nodeScope);
    }

    for (const child of Object.values(value)) collect(child, nodeScope, ambientContext);
  }

  collect(syntaxTree, rootScope);
  return scopes;
}

function hasLexicalBinding(scope: LexicalScope | undefined, name: string): boolean {
  let current = scope;
  while (current !== undefined) {
    if (current.bindings.has(name)) return true;
    current = current.parent;
  }
  return false;
}

function isReferencedValue(
  node: AstNode,
  parent: AstNode | undefined,
  grandparent: AstNode | undefined,
): boolean {
  if (parent === undefined) return false;
  if (parent.type.startsWith("TS")) {
    return (
      [
        "TSAsExpression",
        "TSInstantiationExpression",
        "TSNonNullExpression",
        "TSSatisfiesExpression",
      ].includes(parent.type) && parent.expression === node
    );
  }

  switch (parent.type) {
    case "MemberExpression":
    case "OptionalMemberExpression":
      return parent.property === node && parent.computed === true;
    case "VariableDeclarator":
      return parent.init === node;
    case "ClassMethod":
    case "ClassPrivateMethod":
    case "ObjectMethod":
      return parent.key === node ? parent.computed === true : false;
    case "ObjectProperty":
      if (parent.key === node) return parent.computed === true;
      return grandparent?.type !== "ObjectPattern";
    case "ClassProperty":
    case "ClassAccessorProperty":
      return parent.key === node ? parent.computed === true : true;
    case "ClassPrivateProperty":
      return parent.key !== node;
    case "ClassDeclaration":
    case "ClassExpression":
      return parent.superClass === node;
    case "AssignmentExpression":
    case "AssignmentPattern":
      return parent.right === node;
    case "LabeledStatement":
    case "CatchClause":
    case "RestElement":
    case "BreakStatement":
    case "ContinueStatement":
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ImportDefaultSpecifier":
    case "ImportNamespaceSpecifier":
    case "ImportSpecifier":
    case "ImportAttribute":
    case "MetaProperty":
    case "ObjectPattern":
    case "ArrayPattern":
      return false;
    case "ExportSpecifier":
      return grandparent?.source === undefined && parent.local === node;
    case "TSEnumMember":
      return parent.id !== node;
    default:
      return true;
  }
}

type UnverifiableDependency = "dynamic import" | "require" | "require escape";

interface CollectedDependencies {
  readonly specifiers: readonly string[];
  readonly unverifiable: readonly UnverifiableDependency[];
}

function collectModuleDependencies(sourceText: string): CollectedDependencies {
  const syntaxTree: unknown = parse(sourceText, {
    plugins: ["typescript", "jsx"],
    sourceType: "unambiguous",
  });
  const scopes = collectLexicalScopes(syntaxTree);
  const specifiers: string[] = [];
  const unverifiable: UnverifiableDependency[] = [];

  function addStringLiteral(value: unknown): void {
    const specifier = stringLiteralValue(value);
    if (specifier !== undefined) {
      specifiers.push(specifier);
    }
  }

  function addRuntimeDependency(value: unknown, kind: UnverifiableDependency): void {
    const specifier = stringLiteralValue(value);
    if (specifier === undefined) {
      unverifiable.push(kind);
    } else {
      specifiers.push(specifier);
    }
  }

  function visit(value: unknown, parent?: AstNode, grandparent?: AstNode): void {
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item, parent, grandparent);
      }
      return;
    }

    if (!isAstNode(value)) {
      return;
    }

    if (
      value.type === "ImportDeclaration" ||
      value.type === "ExportNamedDeclaration" ||
      value.type === "ExportAllDeclaration"
    ) {
      addStringLiteral(value.source);
    } else if (value.type === "ImportExpression") {
      addRuntimeDependency(value.source, "dynamic import");
    } else if (value.type === "TSImportType") {
      addStringLiteral(value.source ?? value.argument);
    } else if (value.type === "TSImportEqualsDeclaration") {
      const moduleReference = value.moduleReference;
      if (isAstNode(moduleReference) && moduleReference.type === "TSExternalModuleReference") {
        addStringLiteral(moduleReference.expression);
      }
    } else if (value.type === "CallExpression" || value.type === "OptionalCallExpression") {
      const callee = value.callee;
      const isDynamicImport = isAstNode(callee) && callee.type === "Import";
      const isRequire =
        isAstNode(callee) &&
        callee.type === "Identifier" &&
        callee.name === "require" &&
        !hasLexicalBinding(scopes.get(callee), "require");
      if (isDynamicImport || isRequire) {
        const argumentsList = value.arguments;
        addRuntimeDependency(
          Array.isArray(argumentsList) ? argumentsList[0] : undefined,
          isDynamicImport ? "dynamic import" : "require",
        );
      }
    }

    if (
      value.type === "Identifier" &&
      value.name === "require" &&
      !hasLexicalBinding(scopes.get(value), "require") &&
      isReferencedValue(value, parent, grandparent)
    ) {
      const isDirectCall =
        parent !== undefined &&
        (parent.type === "CallExpression" || parent.type === "OptionalCallExpression") &&
        parent.callee === value;
      if (!isDirectCall) unverifiable.push("require escape");
    }

    for (const child of Object.values(value)) {
      visit(child, value, parent);
    }
  }

  visit(syntaxTree);
  return { specifiers: specifiers.sort(), unverifiable: unverifiable.sort() };
}

async function pathExists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function resolveRelativeImport(
  importer: string,
  specifier: string,
): Promise<string | undefined> {
  const unresolved = path.resolve(path.dirname(importer), specifier);
  const candidates = path.extname(unresolved)
    ? [unresolved]
    : [
        `${unresolved}.ts`,
        `${unresolved}.tsx`,
        path.join(unresolved, "index.ts"),
        path.join(unresolved, "index.tsx"),
      ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const files: string[] = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listTypeScriptFiles(entryPath)));
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

export async function checkArchitectureBoundaries(
  sourceRoot: string,
): Promise<BoundaryViolation[]> {
  const violations: BoundaryViolation[] = [];

  for (const file of await listTypeScriptFiles(sourceRoot)) {
    const importerLayer = layerForFile(sourceRoot, file);
    const displayFile = path.relative(sourceRoot, file).split(path.sep).join("/");

    if (importerLayer === undefined) {
      violations.push({
        file: displayFile,
        reason: "TypeScript source must live in a declared architectural boundary",
      });
      continue;
    }

    const isTest = /\.(?:test|spec)\.tsx?$/.test(file);
    let dependencies: CollectedDependencies;
    try {
      dependencies = collectModuleDependencies(await readFile(file, "utf8"));
    } catch (error) {
      violations.push({
        file: displayFile,
        reason: `TypeScript source could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }

    for (const kind of dependencies.unverifiable) {
      violations.push({
        file: displayFile,
        reason:
          kind === "require escape"
            ? "Ambient require cannot be aliased or used as a value because its dependencies cannot be verified"
            : `${kind === "dynamic import" ? "Dynamic import" : "Require"} dependency must use a string literal so its architectural boundary can be verified`,
      });
    }

    for (const specifier of dependencies.specifiers) {
      if (!specifier.startsWith(".")) {
        if (isTest && specifier === "bun:test") {
          continue;
        }

        if (layersWithoutProductionExternalDependencies.has(importerLayer)) {
          violations.push({
            file: displayFile,
            reason: `${importerLayer} production code cannot import external modules`,
            specifier,
          });
        }
        continue;
      }

      const target = await resolveRelativeImport(file, specifier);
      if (target === undefined) {
        violations.push({
          file: displayFile,
          reason: "Relative import does not resolve to a TypeScript source file",
          specifier,
        });
        continue;
      }

      const targetLayer = layerForFile(sourceRoot, target);
      if (targetLayer === undefined || !allowedLayerDependencies[importerLayer].has(targetLayer)) {
        violations.push({
          file: displayFile,
          reason: `${importerLayer} cannot depend on ${targetLayer ?? "source outside a boundary"}`,
          specifier,
        });
      }
    }
  }

  return violations.sort((left, right) => {
    return (
      left.file.localeCompare(right.file) ||
      (left.specifier ?? "").localeCompare(right.specifier ?? "") ||
      left.reason.localeCompare(right.reason)
    );
  });
}
