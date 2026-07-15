import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { parse } from "@babel/parser";

const layerNames = [
  "core",
  "plugin-sdk",
  "standard-model",
  "persistence",
  "application",
  "host",
  "cli",
] as const;

type LayerName = (typeof layerNames)[number];

const knownLayers = new Set<string>(layerNames);

const allowedLayerDependencies: Readonly<Record<LayerName, ReadonlySet<LayerName>>> = {
  core: new Set(["core"]),
  "plugin-sdk": new Set(["core", "plugin-sdk"]),
  "standard-model": new Set(["core", "standard-model"]),
  persistence: new Set(["core", "standard-model", "persistence"]),
  application: new Set(["core", "standard-model", "application"]),
  host: new Set(layerNames),
  cli: new Set(["application", "host", "cli"]),
};

const layersWithoutProductionExternalDependencies = new Set<LayerName>([
  "core",
  "plugin-sdk",
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

const propertyKeyNodeTypes = new Set([
  "ClassMethod",
  "ClassPrivateMethod",
  "ClassProperty",
  "ClassAccessorProperty",
  "ImportAttribute",
  "ObjectMethod",
  "ObjectProperty",
  "TSEnumMember",
  "TSMethodSignature",
  "TSPropertySignature",
]);

function isBareRequireIdentifier(
  node: AstNode,
  parent: AstNode | undefined,
  grandparent: AstNode | undefined,
): boolean {
  if (node.type !== "Identifier" || node.name !== "require") return false;
  if (parent === undefined) return true;

  if (parent.type === "MemberExpression" || parent.type === "OptionalMemberExpression") {
    return parent.property !== node || parent.computed === true;
  }
  if (propertyKeyNodeTypes.has(parent.type) && parent.key === node) {
    return parent.computed === true;
  }
  if (
    parent.type === "PrivateName" ||
    (parent.type === "TSQualifiedName" && parent.right === node)
  ) {
    return false;
  }
  if (parent.type === "ImportSpecifier") {
    return parent.local === node;
  }
  if (parent.type === "ExportSpecifier") {
    return grandparent?.source == null && parent.local === node;
  }
  return true;
}

type UnverifiableDependency = "dynamic import" | "require";

interface CollectedDependencies {
  readonly hasReservedRequire: boolean;
  readonly specifiers: readonly string[];
  readonly unverifiable: readonly UnverifiableDependency[];
}

function collectModuleDependencies(
  sourceText: string,
  reserveBareRequire: boolean,
): CollectedDependencies {
  const syntaxTree: unknown = parse(sourceText, {
    plugins: ["typescript", "jsx"],
    sourceType: "unambiguous",
  });
  const specifiers: string[] = [];
  const unverifiable: UnverifiableDependency[] = [];
  let hasReservedRequire = false;

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
        isAstNode(callee) && callee.type === "Identifier" && callee.name === "require";
      if (isDynamicImport || (isRequire && !reserveBareRequire)) {
        const argumentsList = value.arguments;
        addRuntimeDependency(
          Array.isArray(argumentsList) ? argumentsList[0] : undefined,
          isDynamicImport ? "dynamic import" : "require",
        );
      }
    }

    if (reserveBareRequire && isBareRequireIdentifier(value, parent, grandparent)) {
      hasReservedRequire = true;
    }

    for (const child of Object.values(value)) {
      visit(child, value, parent);
    }
  }

  visit(syntaxTree);
  return {
    hasReservedRequire,
    specifiers: specifiers.sort(),
    unverifiable: unverifiable.sort(),
  };
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
    const reserveBareRequire =
      !isTest && layersWithoutProductionExternalDependencies.has(importerLayer);
    let dependencies: CollectedDependencies;
    try {
      dependencies = collectModuleDependencies(await readFile(file, "utf8"), reserveBareRequire);
    } catch (error) {
      violations.push({
        file: displayFile,
        reason: `TypeScript source could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }

    if (dependencies.hasReservedRequire) {
      violations.push({
        file: displayFile,
        reason: `${importerLayer} production code reserves bare require identifiers; use ESM imports or an injected capability`,
      });
    }

    for (const kind of dependencies.unverifiable) {
      violations.push({
        file: displayFile,
        reason: `${kind === "dynamic import" ? "Dynamic import" : "Require"} dependency must use a string literal so its architectural boundary can be verified`,
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
