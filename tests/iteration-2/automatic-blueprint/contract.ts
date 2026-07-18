import { createHash } from "node:crypto";

export const benchmarkSchemaVersion = 1 as const;

export const fixturePreparationMethod = "remove-declared-groma-state-v1" as const;

export const auditCategories = [
  "bun-route",
  "cross-boundary-dependency",
  "documentation-evidence",
  "public-action",
  "workspace-boundary",
] as const;

export type AuditCategory = (typeof auditCategories)[number];

export interface SourceWitness {
  readonly anchor: {
    readonly endLine: number;
    readonly startLine: number;
    readonly symbol?: string;
  };
  readonly blobOid: string;
  readonly contentSha256: string;
  readonly path: string;
}

export interface AuditFact {
  readonly category: AuditCategory;
  readonly claim: {
    readonly kind: "absence" | "documentation" | "edge-set" | "set";
    readonly objects: readonly string[];
    readonly predicate: string;
    readonly subject: string;
  };
  readonly evidence: readonly SourceWitness[];
  readonly derivation?: {
    readonly method: string;
    readonly resultSha256: string;
    readonly sourceScopeId: string;
  };
  readonly id: string;
  readonly importance: "required" | "supporting";
  readonly summary: string;
}

export interface BenchmarkAudit {
  readonly auditId: string;
  readonly comprehensionQuestions: readonly {
    readonly factIds: readonly string[];
    readonly id: string;
    readonly prompt: string;
    readonly required: boolean;
  }[];
  readonly exclusions: readonly {
    readonly id: string;
    readonly reason: string;
    readonly scope: string;
  }[];
  readonly facts: readonly AuditFact[];
  readonly forbiddenClaims: readonly {
    readonly claim: string;
    readonly evidence: readonly SourceWitness[];
    readonly id: string;
    readonly reason: string;
    readonly severity: "critical" | "noncritical";
  }[];
  readonly project: {
    readonly ecosystem: readonly string[];
    readonly fixturePreparation: {
      readonly method: typeof fixturePreparationMethod;
      readonly preexistingGromaOwnedPaths: readonly string[];
      readonly preparedSourceSnapshotPathCount: number;
      readonly preparedSourceSnapshotSha256: string;
    };
    readonly name: string;
    readonly packageMetadataVersion: string;
    readonly repository: string;
    readonly revision: string;
    readonly sourceScopes: readonly {
      readonly excluded: readonly string[];
      readonly id: string;
      readonly included: readonly string[];
      readonly pathCount: number;
      readonly pathInventorySha256: string;
      readonly protectedRoots: readonly string[];
    }[];
    readonly tree: string;
  };
  readonly reservation: {
    readonly genericImprovementRequiresNonHeldOutEvidence: boolean;
    readonly heldOut: boolean;
    readonly projectSpecificExceptionsProhibited: boolean;
    readonly publicReproducibleReferenceNotSecret: boolean;
    readonly scannerFrozenBeforeHeldOutRun: boolean;
    readonly scoredResultsMayTuneScanner: boolean;
  };
  readonly schemaVersion: typeof benchmarkSchemaVersion;
}

export interface BenchmarkCommandRecord {
  readonly argv: readonly string[];
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

export interface FalseClaimEvidence {
  readonly claim: string;
  readonly claimId: string;
  readonly evidence: readonly {
    readonly detail: string;
    readonly observationId?: string;
    readonly sourcePath?: string;
  }[];
  readonly forbiddenClaimIds: readonly string[];
}

export interface AssessedClaimEvidence {
  readonly claim: string;
  readonly claimId: string;
  readonly evidence: readonly {
    readonly detail: string;
    readonly observationId: string;
    readonly sourcePath: string;
  }[];
  readonly factIds: readonly string[];
}

export interface BenchmarkRun {
  readonly auditId: string;
  readonly claims: {
    readonly assessedClaims: readonly AssessedClaimEvidence[];
    readonly coveredRequiredFactIds: readonly string[];
    readonly coveredSupportingFactIds: readonly string[];
    readonly criticalFalseClaims: readonly FalseClaimEvidence[];
    readonly noncriticalFalseClaims: readonly FalseClaimEvidence[];
  };
  readonly comprehension: {
    readonly answeredQuestionIds: readonly string[];
    readonly correctQuestionIds: readonly string[];
    readonly criticalMisunderstandings: readonly string[];
    readonly evaluatorHadAgentAssistance: boolean;
    readonly evaluatorHadPriorProjectKnowledge: boolean;
    readonly materials: readonly string[];
    readonly startedAfterFreeze: boolean;
    readonly usedOnlyFrozenInitialMainLayer: boolean;
  };
  readonly execution: {
    readonly aiOrHelperInferenceUsed: boolean;
    readonly commands: readonly BenchmarkCommandRecord[];
    readonly fixturePreparation: {
      readonly completedAtMonotonicMilliseconds: number;
      readonly declaredPreexistingGromaOwnedPaths: readonly string[];
      readonly gromaOwnedStateAbsentBeforeInit: boolean;
      readonly method: typeof fixturePreparationMethod;
      readonly preparedSourceSnapshotPathCount: number;
      readonly preparedSourceSnapshotSha256: string;
      readonly removedPreexistingGromaOwnedPaths: readonly string[];
    };
    readonly gromaOwnedOutputPaths: readonly string[];
    readonly humanCorrectionBeforeFreeze: boolean;
    readonly humanGroundTruthAuditCompletedBeforeRun: boolean;
    readonly mainLayerFrozenAtMonotonicMilliseconds: number;
    readonly networkIsolation: {
      readonly enforcedAtOsLevel: boolean;
      readonly mechanism: string;
    };
    readonly outputsFrozenBeforeHumanEvaluation: boolean;
    readonly pathConvention: "posix" | "win32";
    readonly preRunPlan: {
      readonly commitmentSha256: string;
      readonly frozenAtMonotonicMilliseconds: number;
      readonly gromaOwnedOutputPaths: readonly string[];
      readonly pathConvention: "posix" | "win32";
      readonly preparedSourceSnapshotSha256: string;
      readonly rendererDeclaredMainLayerBudget: {
        readonly nodes: number;
        readonly relationships: number;
      };
      readonly sourceHashExcludedPaths: readonly string[];
    };
    readonly project: {
      readonly repository: string;
      readonly revision: string;
      readonly tree: string;
    };
    readonly scannerAndRulesFrozenBeforeHeldOutRun: boolean;
    readonly sourceAfterSha256: string;
    readonly sourceBeforeSha256: string;
    readonly sourceHashExcludedPaths: readonly string[];
    readonly spawnedInitAtMonotonicMilliseconds: number;
    readonly stdinClosed: boolean;
    readonly temporaryConfigRoot: string;
    readonly temporaryHome: string;
  };
  readonly presentation: {
    readonly declaredMainLayerBudget: {
      readonly nodes: number;
      readonly relationships: number;
    };
    readonly frozenMainLayer: {
      readonly artifactSha256: string;
      readonly machineObservableFreezeSignal: string;
      readonly nodes: number;
      readonly relationships: number;
    };
    readonly uncertainty: {
      readonly coverageGapCount: number;
      readonly nonColorCue: "none" | "shape" | "text" | "text-and-shape";
      readonly visible: boolean;
    };
  };
  readonly provenance: {
    readonly claimIdsWithValidWitnesses: readonly string[];
    readonly inScopeClaimIds: readonly string[];
  };
  readonly repeatability: {
    readonly rescans: readonly {
      readonly canonicalByteDigest: string;
      readonly canonicalIdentityDigest: string;
      readonly commands: readonly BenchmarkCommandRecord[];
      readonly id: string;
      readonly observationIdentityDigest: string;
      readonly ordinal: number;
      readonly preparedSourceSnapshotSha256: string;
      readonly rawObservationDigest: string;
      readonly rawObservationOrderingDigest: string;
    }[];
  };
  readonly schemaVersion: typeof benchmarkSchemaVersion;
}

export class BenchmarkContractError extends Error {
  constructor(
    readonly code: "INVALID_AUDIT" | "INVALID_RUN",
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = "BenchmarkContractError";
  }
}

function record(value: unknown, location: string, code: BenchmarkContractError["code"]) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BenchmarkContractError(code, `${location} must be an object`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, location: string, code: BenchmarkContractError["code"]): unknown[] {
  if (!Array.isArray(value)) {
    throw new BenchmarkContractError(code, `${location} must be an array`);
  }
  return value;
}

function string(value: unknown, location: string, code: BenchmarkContractError["code"]): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new BenchmarkContractError(code, `${location} must be a nonempty string`);
  }
  return value;
}

function boolean(value: unknown, location: string, code: BenchmarkContractError["code"]): boolean {
  if (typeof value !== "boolean") {
    throw new BenchmarkContractError(code, `${location} must be a boolean`);
  }
  return value;
}

function nonnegativeNumber(
  value: unknown,
  location: string,
  code: BenchmarkContractError["code"],
): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new BenchmarkContractError(code, `${location} must be a nonnegative safe integer`);
  }
  return value;
}

function stringArray(
  value: unknown,
  location: string,
  code: BenchmarkContractError["code"],
): string[] {
  return array(value, location, code).map((item, index) =>
    string(item, `${location}[${index}]`, code),
  );
}

function unique(
  values: readonly string[],
  location: string,
  code: BenchmarkContractError["code"],
): void {
  if (new Set(values).size !== values.length) {
    throw new BenchmarkContractError(code, `${location} must not contain duplicates`);
  }
}

function sha256(value: unknown, location: string, code: BenchmarkContractError["code"]): string {
  const parsed = string(value, location, code);
  if (!/^[0-9a-f]{64}$/.test(parsed)) {
    throw new BenchmarkContractError(code, `${location} must be a lowercase SHA-256 digest`);
  }
  return parsed;
}

const reservedWindowsName =
  /^(?:aux|clock\$|con|conin\$|conout\$|nul|prn|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu;

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      if (index + 1 >= value.length) return true;
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

export function isStrictPortableWorkspaceDescendant(value: string): boolean {
  if (
    value.length === 0 ||
    value.startsWith("/") ||
    value.endsWith("/") ||
    value.includes("\\") ||
    value.includes("//") ||
    /^[A-Za-z]:/.test(value) ||
    /[\u0000-\u001f:*?"<>|{}!\[\]]/.test(value) ||
    hasUnpairedSurrogate(value)
  ) {
    return false;
  }
  return value
    .split("/")
    .every(
      (segment) =>
        segment.length > 0 &&
        segment !== "." &&
        segment !== ".." &&
        !segment.endsWith(".") &&
        !segment.endsWith(" ") &&
        !reservedWindowsName.test(segment),
    );
}

export function strictPortablePathsOverlapConservatively(left: string, right: string): boolean {
  const comparableLeft = left.toLowerCase();
  const comparableRight = right.toLowerCase();
  return (
    comparableLeft === comparableRight ||
    comparableLeft.startsWith(`${comparableRight}/`) ||
    comparableRight.startsWith(`${comparableLeft}/`)
  );
}

export function createBenchmarkStringArrayDigest(values: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify(values)).digest("hex");
}

function commandRecord(
  value: unknown,
  location: string,
  code: BenchmarkContractError["code"],
): BenchmarkCommandRecord {
  const command = record(value, location, code);
  stringArray(command.argv, `${location}.argv`, code);
  if (typeof command.exitCode !== "number" || !Number.isSafeInteger(command.exitCode)) {
    throw new BenchmarkContractError(code, `${location}.exitCode must be a safe integer`);
  }
  if (typeof command.stdout !== "string" || typeof command.stderr !== "string") {
    throw new BenchmarkContractError(
      code,
      `${location} stdout and stderr must be preserved strings`,
    );
  }
  return value as BenchmarkCommandRecord;
}

function sourceWitness(
  value: unknown,
  location: string,
  code: BenchmarkContractError["code"],
): SourceWitness {
  const parsed = record(value, location, code);
  const path = string(parsed.path, `${location}.path`, code);
  if (!isStrictPortableWorkspaceDescendant(path)) {
    throw new BenchmarkContractError(
      code,
      `${location}.path must be a strict portable workspace descendant`,
    );
  }
  const blobOid = string(parsed.blobOid, `${location}.blobOid`, code);
  if (!/^[0-9a-f]{40}$/.test(blobOid)) {
    throw new BenchmarkContractError(code, `${location}.blobOid must be a Git SHA-1 blob id`);
  }
  sha256(parsed.contentSha256, `${location}.contentSha256`, code);
  const anchor = record(parsed.anchor, `${location}.anchor`, code);
  const startLine = nonnegativeNumber(anchor.startLine, `${location}.anchor.startLine`, code);
  const endLine = nonnegativeNumber(anchor.endLine, `${location}.anchor.endLine`, code);
  if (startLine === 0 || endLine < startLine || endLine - startLine > 80) {
    throw new BenchmarkContractError(code, `${location}.anchor must span 1 to 81 source lines`);
  }
  if (anchor.symbol !== undefined) string(anchor.symbol, `${location}.anchor.symbol`, code);
  return value as SourceWitness;
}

function witnesses(
  value: unknown,
  location: string,
  code: BenchmarkContractError["code"],
): SourceWitness[] {
  const parsed = array(value, location, code).map((item, index) =>
    sourceWitness(item, `${location}[${index}]`, code),
  );
  if (parsed.length === 0) {
    throw new BenchmarkContractError(code, `${location} must contain at least one witness`);
  }
  return parsed;
}

export function parseBenchmarkAudit(value: unknown): BenchmarkAudit {
  const code = "INVALID_AUDIT" as const;
  const parsed = record(value, "audit", code);
  if (parsed.schemaVersion !== benchmarkSchemaVersion) {
    throw new BenchmarkContractError(code, `audit.schemaVersion must be ${benchmarkSchemaVersion}`);
  }
  string(parsed.auditId, "audit.auditId", code);
  const project = record(parsed.project, "audit.project", code);
  string(project.name, "audit.project.name", code);
  string(project.repository, "audit.project.repository", code);
  string(project.packageMetadataVersion, "audit.project.packageMetadataVersion", code);
  const revision = string(project.revision, "audit.project.revision", code);
  const tree = string(project.tree, "audit.project.tree", code);
  if (!/^[0-9a-f]{40}$/.test(revision) || !/^[0-9a-f]{40}$/.test(tree)) {
    throw new BenchmarkContractError(code, "audit project revision and tree must be full Git ids");
  }
  const ecosystem = stringArray(project.ecosystem, "audit.project.ecosystem", code);
  unique(ecosystem, "audit.project.ecosystem", code);
  const fixturePreparation = record(
    project.fixturePreparation,
    "audit.project.fixturePreparation",
    code,
  );
  if (fixturePreparation.method !== fixturePreparationMethod) {
    throw new BenchmarkContractError(code, "audit fixture preparation method is unsupported");
  }
  const preexistingGromaOwnedPaths = stringArray(
    fixturePreparation.preexistingGromaOwnedPaths,
    "audit.project.fixturePreparation.preexistingGromaOwnedPaths",
    code,
  );
  unique(
    preexistingGromaOwnedPaths,
    "audit.project.fixturePreparation.preexistingGromaOwnedPaths",
    code,
  );
  if (preexistingGromaOwnedPaths.some((value) => !isStrictPortableWorkspaceDescendant(value))) {
    throw new BenchmarkContractError(
      code,
      "audit fixture preparation paths must be strict portable workspace descendants",
    );
  }
  nonnegativeNumber(
    fixturePreparation.preparedSourceSnapshotPathCount,
    "audit.project.fixturePreparation.preparedSourceSnapshotPathCount",
    code,
  );
  sha256(
    fixturePreparation.preparedSourceSnapshotSha256,
    "audit.project.fixturePreparation.preparedSourceSnapshotSha256",
    code,
  );
  const sourceScopeIds: string[] = [];
  const auditedInputPaths: string[] = [];
  for (const [index, item] of array(
    project.sourceScopes,
    "audit.project.sourceScopes",
    code,
  ).entries()) {
    const scope = record(item, `audit.project.sourceScopes[${index}]`, code);
    sourceScopeIds.push(string(scope.id, `audit.project.sourceScopes[${index}].id`, code));
    const included = stringArray(
      scope.included,
      `audit.project.sourceScopes[${index}].included`,
      code,
    );
    const excluded = stringArray(
      scope.excluded,
      `audit.project.sourceScopes[${index}].excluded`,
      code,
    );
    const protectedRoots = stringArray(
      scope.protectedRoots,
      `audit.project.sourceScopes[${index}].protectedRoots`,
      code,
    );
    if (included.length === 0) {
      throw new BenchmarkContractError(
        code,
        "audit source scope must include at least one pattern",
      );
    }
    if (protectedRoots.length === 0) {
      throw new BenchmarkContractError(
        code,
        "audit source scope must protect at least one source root",
      );
    }
    unique(included, `audit.project.sourceScopes[${index}].included`, code);
    unique(excluded, `audit.project.sourceScopes[${index}].excluded`, code);
    unique(protectedRoots, `audit.project.sourceScopes[${index}].protectedRoots`, code);
    if (protectedRoots.some((value) => !isStrictPortableWorkspaceDescendant(value))) {
      throw new BenchmarkContractError(
        code,
        "audit protected source roots must be strict portable workspace descendants",
      );
    }
    auditedInputPaths.push(...protectedRoots);
    const pathCount = nonnegativeNumber(
      scope.pathCount,
      `audit.project.sourceScopes[${index}].pathCount`,
      code,
    );
    if (pathCount === 0) {
      throw new BenchmarkContractError(code, "audit source scope path count must be positive");
    }
    sha256(
      scope.pathInventorySha256,
      `audit.project.sourceScopes[${index}].pathInventorySha256`,
      code,
    );
  }
  if (sourceScopeIds.length === 0) {
    throw new BenchmarkContractError(code, "audit.project.sourceScopes must not be empty");
  }
  unique(sourceScopeIds, "audit project source scope ids", code);

  const facts = array(parsed.facts, "audit.facts", code);
  const factIds: string[] = [];
  const presentCategories = new Set<AuditCategory>();
  for (const [index, item] of facts.entries()) {
    const fact = record(item, `audit.facts[${index}]`, code);
    const id = string(fact.id, `audit.facts[${index}].id`, code);
    if (!id.startsWith("audit.") || /\b(?:ent|rel|obs)_/.test(id)) {
      throw new BenchmarkContractError(code, `${id} is not an audit-stable fact id`);
    }
    factIds.push(id);
    const category = string(fact.category, `audit.facts[${index}].category`, code);
    if (!(auditCategories as readonly string[]).includes(category)) {
      throw new BenchmarkContractError(code, `${id} has an unknown category`);
    }
    presentCategories.add(category as AuditCategory);
    if (fact.importance !== "required" && fact.importance !== "supporting") {
      throw new BenchmarkContractError(code, `${id} has an unknown importance`);
    }
    string(fact.summary, `${id}.summary`, code);
    const claim = record(fact.claim, `${id}.claim`, code);
    if (!["absence", "documentation", "edge-set", "set"].includes(String(claim.kind))) {
      throw new BenchmarkContractError(code, `${id} has an unknown claim kind`);
    }
    string(claim.subject, `${id}.claim.subject`, code);
    string(claim.predicate, `${id}.claim.predicate`, code);
    const objects = stringArray(claim.objects, `${id}.claim.objects`, code);
    if (objects.length === 0) {
      throw new BenchmarkContractError(code, `${id}.claim.objects must not be empty`);
    }
    unique(objects, `${id}.claim.objects`, code);
    auditedInputPaths.push(
      ...witnesses(fact.evidence, `${id}.evidence`, code).map((witness) => witness.path),
    );
    const requiresDerivation = claim.kind === "absence" || claim.predicate === "contains-exactly";
    if (requiresDerivation || fact.derivation !== undefined) {
      const derivation = record(fact.derivation, `${id}.derivation`, code);
      string(derivation.method, `${id}.derivation.method`, code);
      const sourceScopeId = string(
        derivation.sourceScopeId,
        `${id}.derivation.sourceScopeId`,
        code,
      );
      if (!sourceScopeIds.includes(sourceScopeId)) {
        throw new BenchmarkContractError(code, `${id} references an unknown source scope`);
      }
      const resultSha256 = sha256(derivation.resultSha256, `${id}.derivation.resultSha256`, code);
      if (resultSha256 !== createBenchmarkStringArrayDigest(objects)) {
        throw new BenchmarkContractError(
          code,
          `${id} derivation digest does not bind claim objects`,
        );
      }
    }
  }
  if (facts.length === 0) throw new BenchmarkContractError(code, "audit.facts must not be empty");
  unique(factIds, "audit fact ids", code);
  if (!facts.some((item) => record(item, "audit fact", code).importance === "required")) {
    throw new BenchmarkContractError(code, "audit must contain at least one required fact");
  }
  for (const category of auditCategories) {
    if (!presentCategories.has(category)) {
      throw new BenchmarkContractError(code, `audit is missing category ${category}`);
    }
  }

  const forbiddenClaims = array(parsed.forbiddenClaims, "audit.forbiddenClaims", code);
  const forbiddenIds: string[] = [];
  const forbiddenTexts: string[] = [];
  for (const [index, item] of forbiddenClaims.entries()) {
    const forbidden = record(item, `audit.forbiddenClaims[${index}]`, code);
    const forbiddenId = string(forbidden.id, `audit.forbiddenClaims[${index}].id`, code);
    if (!forbiddenId.startsWith("forbidden.")) {
      throw new BenchmarkContractError(code, `${forbiddenId} is not a stable forbidden claim id`);
    }
    forbiddenIds.push(forbiddenId);
    forbiddenTexts.push(string(forbidden.claim, `audit.forbiddenClaims[${index}].claim`, code));
    string(forbidden.reason, `audit.forbiddenClaims[${index}].reason`, code);
    if (forbidden.severity !== "critical" && forbidden.severity !== "noncritical") {
      throw new BenchmarkContractError(code, "forbidden claim severity is invalid");
    }
    auditedInputPaths.push(
      ...witnesses(forbidden.evidence, `audit.forbiddenClaims[${index}].evidence`, code).map(
        (witness) => witness.path,
      ),
    );
  }
  if (forbiddenClaims.length === 0) {
    throw new BenchmarkContractError(code, "audit.forbiddenClaims must not be empty");
  }
  unique(forbiddenIds, "audit forbidden claim ids", code);
  unique(forbiddenTexts, "audit forbidden claim text", code);
  const unsafePreparationOverlaps = preexistingGromaOwnedPaths.flatMap((preparationPath) =>
    auditedInputPaths
      .filter((auditedInputPath) =>
        strictPortablePathsOverlapConservatively(preparationPath, auditedInputPath),
      )
      .map((auditedInputPath) => `${preparationPath}<->${auditedInputPath}`),
  );
  if (unsafePreparationOverlaps.length > 0) {
    throw new BenchmarkContractError(
      code,
      `audit fixture preparation overlaps audited input: ${unsafePreparationOverlaps.join(", ")}`,
    );
  }

  const exclusions = array(parsed.exclusions, "audit.exclusions", code);
  const exclusionIds: string[] = [];
  for (const [index, item] of exclusions.entries()) {
    const exclusion = record(item, `audit.exclusions[${index}]`, code);
    exclusionIds.push(string(exclusion.id, `audit.exclusions[${index}].id`, code));
    string(exclusion.scope, `audit.exclusions[${index}].scope`, code);
    string(exclusion.reason, `audit.exclusions[${index}].reason`, code);
  }
  if (exclusions.length === 0) throw new BenchmarkContractError(code, "audit.exclusions is empty");
  unique(exclusionIds, "audit exclusion ids", code);

  const questions = array(parsed.comprehensionQuestions, "audit.comprehensionQuestions", code);
  const questionIds: string[] = [];
  for (const [index, item] of questions.entries()) {
    const question = record(item, `audit.comprehensionQuestions[${index}]`, code);
    questionIds.push(string(question.id, `audit.comprehensionQuestions[${index}].id`, code));
    string(question.prompt, `audit.comprehensionQuestions[${index}].prompt`, code);
    boolean(question.required, `audit.comprehensionQuestions[${index}].required`, code);
    const linkedFacts = stringArray(
      question.factIds,
      `audit.comprehensionQuestions[${index}].factIds`,
      code,
    );
    if (linkedFacts.length === 0 || linkedFacts.some((id) => !factIds.includes(id))) {
      throw new BenchmarkContractError(code, "comprehension question references unknown facts");
    }
  }
  if (questions.length === 0) {
    throw new BenchmarkContractError(code, "audit.comprehensionQuestions must not be empty");
  }
  unique(questionIds, "audit comprehension question ids", code);
  if (!questions.some((item) => record(item, "audit question", code).required === true)) {
    throw new BenchmarkContractError(code, "audit must contain at least one required question");
  }

  const reservation = record(parsed.reservation, "audit.reservation", code);
  for (const field of [
    "genericImprovementRequiresNonHeldOutEvidence",
    "heldOut",
    "projectSpecificExceptionsProhibited",
    "publicReproducibleReferenceNotSecret",
    "scannerFrozenBeforeHeldOutRun",
    "scoredResultsMayTuneScanner",
  ] as const) {
    boolean(reservation[field], `audit.reservation.${field}`, code);
  }
  if (
    reservation.heldOut === true &&
    (reservation.genericImprovementRequiresNonHeldOutEvidence !== true ||
      reservation.projectSpecificExceptionsProhibited !== true ||
      reservation.publicReproducibleReferenceNotSecret !== true ||
      reservation.scannerFrozenBeforeHeldOutRun !== true ||
      reservation.scoredResultsMayTuneScanner !== false)
  ) {
    throw new BenchmarkContractError(code, "held-out audit reservation is not fail-closed");
  }
  return value as BenchmarkAudit;
}

export function parseBenchmarkRun(value: unknown): BenchmarkRun {
  const code = "INVALID_RUN" as const;
  const parsed = record(value, "run", code);
  if (parsed.schemaVersion !== benchmarkSchemaVersion) {
    throw new BenchmarkContractError(code, `run.schemaVersion must be ${benchmarkSchemaVersion}`);
  }
  string(parsed.auditId, "run.auditId", code);

  const claims = record(parsed.claims, "run.claims", code);
  for (const field of ["coveredRequiredFactIds", "coveredSupportingFactIds"] as const) {
    const ids = stringArray(claims[field], `run.claims.${field}`, code);
    unique(ids, `run.claims.${field}`, code);
  }
  const assessedClaimIds: string[] = [];
  for (const [index, item] of array(
    claims.assessedClaims,
    "run.claims.assessedClaims",
    code,
  ).entries()) {
    const assessed = record(item, `run.claims.assessedClaims[${index}]`, code);
    assessedClaimIds.push(
      string(assessed.claimId, `run.claims.assessedClaims[${index}].claimId`, code),
    );
    string(assessed.claim, `run.claims.assessedClaims[${index}].claim`, code);
    const factIds = stringArray(
      assessed.factIds,
      `run.claims.assessedClaims[${index}].factIds`,
      code,
    );
    if (factIds.length === 0) {
      throw new BenchmarkContractError(code, "assessed claims must map to at least one audit fact");
    }
    unique(factIds, `run.claims.assessedClaims[${index}].factIds`, code);
    const evidence = array(assessed.evidence, `run.claims.assessedClaims[${index}].evidence`, code);
    if (evidence.length === 0) {
      throw new BenchmarkContractError(code, "assessed claims must retain raw evidence");
    }
    for (const [evidenceIndex, evidenceItem] of evidence.entries()) {
      const raw = record(evidenceItem, `assessedClaim.evidence[${evidenceIndex}]`, code);
      string(raw.detail, `assessedClaim.evidence[${evidenceIndex}].detail`, code);
      string(raw.observationId, `assessedClaim.evidence[${evidenceIndex}].observationId`, code);
      const sourcePath = string(
        raw.sourcePath,
        `assessedClaim.evidence[${evidenceIndex}].sourcePath`,
        code,
      );
      if (!isStrictPortableWorkspaceDescendant(sourcePath)) {
        throw new BenchmarkContractError(
          code,
          `assessedClaim.evidence[${evidenceIndex}].sourcePath must be a strict portable workspace descendant`,
        );
      }
    }
  }
  if (assessedClaimIds.length === 0) {
    throw new BenchmarkContractError(code, "run.claims.assessedClaims must not be empty");
  }
  unique(assessedClaimIds, "run.claims assessed claim ids", code);
  const emittedClaimIds = [...assessedClaimIds];
  for (const field of ["criticalFalseClaims", "noncriticalFalseClaims"] as const) {
    for (const [index, item] of array(claims[field], `run.claims.${field}`, code).entries()) {
      const falseClaim = record(item, `run.claims.${field}[${index}]`, code);
      emittedClaimIds.push(
        string(falseClaim.claimId, `run.claims.${field}[${index}].claimId`, code),
      );
      string(falseClaim.claim, `run.claims.${field}[${index}].claim`, code);
      const forbiddenClaimIds = stringArray(
        falseClaim.forbiddenClaimIds,
        `run.claims.${field}[${index}].forbiddenClaimIds`,
        code,
      );
      unique(forbiddenClaimIds, `run.claims.${field}[${index}].forbiddenClaimIds`, code);
      const evidence = array(falseClaim.evidence, `run.claims.${field}[${index}].evidence`, code);
      if (evidence.length === 0) {
        throw new BenchmarkContractError(code, "false claims must retain raw evidence");
      }
      for (const [evidenceIndex, evidenceItem] of evidence.entries()) {
        const raw = record(evidenceItem, `falseClaim.evidence[${evidenceIndex}]`, code);
        string(raw.detail, `falseClaim.evidence[${evidenceIndex}].detail`, code);
        if (raw.observationId !== undefined) {
          string(raw.observationId, `falseClaim.evidence[${evidenceIndex}].observationId`, code);
        }
        if (raw.sourcePath !== undefined) {
          const sourcePath = string(
            raw.sourcePath,
            `falseClaim.evidence[${evidenceIndex}].sourcePath`,
            code,
          );
          if (!isStrictPortableWorkspaceDescendant(sourcePath)) {
            throw new BenchmarkContractError(
              code,
              `falseClaim.evidence[${evidenceIndex}].sourcePath must be a strict portable workspace descendant`,
            );
          }
        }
      }
    }
  }
  unique(emittedClaimIds, "run emitted claim ids", code);

  const execution = record(parsed.execution, "run.execution", code);
  for (const field of [
    "aiOrHelperInferenceUsed",
    "humanCorrectionBeforeFreeze",
    "humanGroundTruthAuditCompletedBeforeRun",
    "outputsFrozenBeforeHumanEvaluation",
    "scannerAndRulesFrozenBeforeHeldOutRun",
    "stdinClosed",
  ] as const) {
    boolean(execution[field], `run.execution.${field}`, code);
  }
  if (execution.pathConvention !== "posix" && execution.pathConvention !== "win32") {
    throw new BenchmarkContractError(code, "run.execution.pathConvention is invalid");
  }
  const project = record(execution.project, "run.execution.project", code);
  string(project.repository, "run.execution.project.repository", code);
  const revision = string(project.revision, "run.execution.project.revision", code);
  const tree = string(project.tree, "run.execution.project.tree", code);
  if (!/^[0-9a-f]{40}$/.test(revision) || !/^[0-9a-f]{40}$/.test(tree)) {
    throw new BenchmarkContractError(code, "run execution revision and tree must be full Git ids");
  }
  nonnegativeNumber(
    execution.spawnedInitAtMonotonicMilliseconds,
    "run.execution.spawnedInitAtMonotonicMilliseconds",
    code,
  );
  nonnegativeNumber(
    execution.mainLayerFrozenAtMonotonicMilliseconds,
    "run.execution.mainLayerFrozenAtMonotonicMilliseconds",
    code,
  );
  sha256(execution.sourceBeforeSha256, "run.execution.sourceBeforeSha256", code);
  sha256(execution.sourceAfterSha256, "run.execution.sourceAfterSha256", code);
  string(execution.temporaryHome, "run.execution.temporaryHome", code);
  string(execution.temporaryConfigRoot, "run.execution.temporaryConfigRoot", code);
  for (const field of ["gromaOwnedOutputPaths", "sourceHashExcludedPaths"] as const) {
    const paths = stringArray(execution[field], `run.execution.${field}`, code);
    unique(paths, `run.execution.${field}`, code);
  }
  const fixturePreparation = record(
    execution.fixturePreparation,
    "run.execution.fixturePreparation",
    code,
  );
  if (fixturePreparation.method !== fixturePreparationMethod) {
    throw new BenchmarkContractError(code, "run fixture preparation method is unsupported");
  }
  nonnegativeNumber(
    fixturePreparation.completedAtMonotonicMilliseconds,
    "run.execution.fixturePreparation.completedAtMonotonicMilliseconds",
    code,
  );
  boolean(
    fixturePreparation.gromaOwnedStateAbsentBeforeInit,
    "run.execution.fixturePreparation.gromaOwnedStateAbsentBeforeInit",
    code,
  );
  for (const field of [
    "declaredPreexistingGromaOwnedPaths",
    "removedPreexistingGromaOwnedPaths",
  ] as const) {
    const paths = stringArray(
      fixturePreparation[field],
      `run.execution.fixturePreparation.${field}`,
      code,
    );
    unique(paths, `run.execution.fixturePreparation.${field}`, code);
    if (paths.some((value) => !isStrictPortableWorkspaceDescendant(value))) {
      throw new BenchmarkContractError(
        code,
        `run.execution.fixturePreparation.${field} must contain strict portable workspace descendants`,
      );
    }
  }
  nonnegativeNumber(
    fixturePreparation.preparedSourceSnapshotPathCount,
    "run.execution.fixturePreparation.preparedSourceSnapshotPathCount",
    code,
  );
  sha256(
    fixturePreparation.preparedSourceSnapshotSha256,
    "run.execution.fixturePreparation.preparedSourceSnapshotSha256",
    code,
  );
  const preRunPlan = record(execution.preRunPlan, "run.execution.preRunPlan", code);
  sha256(preRunPlan.commitmentSha256, "run.execution.preRunPlan.commitmentSha256", code);
  nonnegativeNumber(
    preRunPlan.frozenAtMonotonicMilliseconds,
    "run.execution.preRunPlan.frozenAtMonotonicMilliseconds",
    code,
  );
  if (preRunPlan.pathConvention !== "posix" && preRunPlan.pathConvention !== "win32") {
    throw new BenchmarkContractError(code, "run.execution.preRunPlan.pathConvention is invalid");
  }
  sha256(
    preRunPlan.preparedSourceSnapshotSha256,
    "run.execution.preRunPlan.preparedSourceSnapshotSha256",
    code,
  );
  for (const field of ["gromaOwnedOutputPaths", "sourceHashExcludedPaths"] as const) {
    const paths = stringArray(preRunPlan[field], `run.execution.preRunPlan.${field}`, code);
    unique(paths, `run.execution.preRunPlan.${field}`, code);
  }
  const plannedBudget = record(
    preRunPlan.rendererDeclaredMainLayerBudget,
    "run.execution.preRunPlan.rendererDeclaredMainLayerBudget",
    code,
  );
  nonnegativeNumber(
    plannedBudget.nodes,
    "run.execution.preRunPlan.rendererDeclaredMainLayerBudget.nodes",
    code,
  );
  nonnegativeNumber(
    plannedBudget.relationships,
    "run.execution.preRunPlan.rendererDeclaredMainLayerBudget.relationships",
    code,
  );
  const isolation = record(execution.networkIsolation, "run.execution.networkIsolation", code);
  boolean(isolation.enforcedAtOsLevel, "run.execution.networkIsolation.enforcedAtOsLevel", code);
  string(isolation.mechanism, "run.execution.networkIsolation.mechanism", code);
  const commands = array(execution.commands, "run.execution.commands", code);
  for (const [index, item] of commands.entries()) {
    commandRecord(item, `run.execution.commands[${index}]`, code);
  }

  const repeatability = record(parsed.repeatability, "run.repeatability", code);
  for (const [index, item] of array(
    repeatability.rescans,
    "run.repeatability.rescans",
    code,
  ).entries()) {
    const rescan = record(item, `run.repeatability.rescans[${index}]`, code);
    string(rescan.id, `run.repeatability.rescans[${index}].id`, code);
    nonnegativeNumber(rescan.ordinal, `run.repeatability.rescans[${index}].ordinal`, code);
    sha256(
      rescan.preparedSourceSnapshotSha256,
      `run.repeatability.rescans[${index}].preparedSourceSnapshotSha256`,
      code,
    );
    for (const field of [
      "canonicalByteDigest",
      "canonicalIdentityDigest",
      "observationIdentityDigest",
      "rawObservationDigest",
      "rawObservationOrderingDigest",
    ] as const) {
      sha256(rescan[field], `run.repeatability.rescans[${index}].${field}`, code);
    }
    for (const [commandIndex, command] of array(
      rescan.commands,
      `run.repeatability.rescans[${index}].commands`,
      code,
    ).entries()) {
      commandRecord(command, `run.repeatability.rescans[${index}].commands[${commandIndex}]`, code);
    }
  }

  const provenance = record(parsed.provenance, "run.provenance", code);
  for (const field of ["claimIdsWithValidWitnesses", "inScopeClaimIds"] as const) {
    const ids = stringArray(provenance[field], `run.provenance.${field}`, code);
    unique(ids, `run.provenance.${field}`, code);
  }

  const presentation = record(parsed.presentation, "run.presentation", code);
  const budget = record(
    presentation.declaredMainLayerBudget,
    "run.presentation.declaredMainLayerBudget",
    code,
  );
  nonnegativeNumber(budget.nodes, "run.presentation.declaredMainLayerBudget.nodes", code);
  nonnegativeNumber(
    budget.relationships,
    "run.presentation.declaredMainLayerBudget.relationships",
    code,
  );
  const layer = record(presentation.frozenMainLayer, "run.presentation.frozenMainLayer", code);
  nonnegativeNumber(layer.nodes, "run.presentation.frozenMainLayer.nodes", code);
  nonnegativeNumber(layer.relationships, "run.presentation.frozenMainLayer.relationships", code);
  sha256(layer.artifactSha256, "run.presentation.frozenMainLayer.artifactSha256", code);
  if (typeof layer.machineObservableFreezeSignal !== "string") {
    throw new BenchmarkContractError(code, "main-layer freeze signal must be a string");
  }
  const uncertainty = record(presentation.uncertainty, "run.presentation.uncertainty", code);
  boolean(uncertainty.visible, "run.presentation.uncertainty.visible", code);
  nonnegativeNumber(
    uncertainty.coverageGapCount,
    "run.presentation.uncertainty.coverageGapCount",
    code,
  );
  if (!["none", "shape", "text", "text-and-shape"].includes(String(uncertainty.nonColorCue))) {
    throw new BenchmarkContractError(code, "uncertainty non-color cue is invalid");
  }

  const comprehension = record(parsed.comprehension, "run.comprehension", code);
  for (const field of [
    "evaluatorHadAgentAssistance",
    "evaluatorHadPriorProjectKnowledge",
    "startedAfterFreeze",
    "usedOnlyFrozenInitialMainLayer",
  ] as const) {
    boolean(comprehension[field], `run.comprehension.${field}`, code);
  }
  for (const field of [
    "answeredQuestionIds",
    "correctQuestionIds",
    "criticalMisunderstandings",
    "materials",
  ] as const) {
    const values = stringArray(comprehension[field], `run.comprehension.${field}`, code);
    unique(values, `run.comprehension.${field}`, code);
  }
  return value as BenchmarkRun;
}
