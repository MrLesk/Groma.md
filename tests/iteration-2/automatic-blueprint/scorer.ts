import { createHash } from "node:crypto";
import path from "node:path";

import {
  isStrictPortableWorkspaceDescendant,
  strictPortablePathsOverlapConservatively,
  type BenchmarkAudit,
  type BenchmarkRun,
} from "./contract.ts";

export const benchmarkWorkflow = [["groma", "init"], ["groma", "scan"], ["groma"]] as const;

export const maximumFirstMinuteMilliseconds = 60_000;

export const benchmarkFailureCodes = [
  "AUDIT_MISMATCH",
  "AUDIT_PROJECT_MISMATCH",
  "FIXTURE_PREPARATION_INVALID",
  "FIXTURE_SNAPSHOT_MISMATCH",
  "WORKFLOW_MISMATCH",
  "COMMAND_FAILED",
  "NETWORK_ISOLATION_NOT_ENFORCED",
  "STDIN_NOT_CLOSED",
  "TEMPORARY_ENVIRONMENT_NOT_ISOLATED",
  "SOURCE_OUTPUT_PATH_INVALID",
  "SOURCE_OUTPUT_OVERLAPS_PROTECTED_SOURCE",
  "SOURCE_HASH_EXCLUSIONS_MISMATCH",
  "PRE_RUN_PLAN_DIGEST_MISMATCH",
  "PRE_RUN_PLAN_NOT_FROZEN",
  "PRE_RUN_PLAN_MISMATCH",
  "SOURCE_MUTATED",
  "AI_OR_HELPER_INFERENCE_USED",
  "HUMAN_CORRECTION_BEFORE_FREEZE",
  "GROUND_TRUTH_AUDIT_NOT_PRECOMMITTED",
  "HELD_OUT_SCANNER_NOT_FROZEN",
  "OUTPUT_NOT_FROZEN_BEFORE_EVALUATION",
  "MAIN_LAYER_NOT_MACHINE_FROZEN",
  "FIRST_MINUTE_EXCEEDED",
  "FALSE_CLAIM_FORBIDDEN_LINK_INVALID",
  "CRITICAL_FALSE_CLAIM",
  "REQUIRED_FACT_COVERAGE_INCOMPLETE",
  "RESCAN_RECORDS_INCOMPLETE",
  "RESCAN_WORKFLOW_MISMATCH",
  "RESCAN_COMMAND_FAILED",
  "RESCAN_INPUT_MISMATCH",
  "RAW_OBSERVATION_ORDER_CHANGED",
  "RAW_OBSERVATION_DIGEST_CHANGED",
  "OBSERVATION_IDENTITY_CHANGED",
  "CANONICAL_IDENTITY_CHANGED",
  "CANONICAL_BYTES_CHANGED",
  "PROVENANCE_INCOMPLETE",
  "MAIN_LAYER_BUDGET_UNDECLARED",
  "MAIN_LAYER_BUDGET_EXCEEDED",
  "UNCERTAINTY_NOT_VISIBLE",
  "UNCERTAINTY_COLOR_ONLY",
  "COMPREHENSION_NOT_UNAIDED",
  "COMPREHENSION_INCOMPLETE",
  "COMPREHENSION_CRITICAL_MISUNDERSTANDING",
] as const;

export type BenchmarkFailureCode = (typeof benchmarkFailureCodes)[number];

export interface BenchmarkScore {
  readonly dimensions: {
    readonly falseClaims: number;
    readonly firstMinute: number;
    readonly observableFactCoverage: number;
    readonly presentationIntegrity: number;
    readonly provenance: number;
    readonly repeatability: number;
    readonly stableIdentityAndCanonicalBytes: number;
    readonly unaidedComprehension: number;
  };
  readonly failures: readonly {
    readonly code: BenchmarkFailureCode;
    readonly evidence: readonly string[];
  }[];
  readonly passed: boolean;
  readonly total: number;
}

function sameArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

const utf8Encoder = new TextEncoder();

function compareUtf8(left: string, right: string): number {
  const leftBytes = utf8Encoder.encode(left);
  const rightBytes = utf8Encoder.encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return leftBytes[index]! - rightBytes[index]!;
  }
  return leftBytes.length - rightBytes.length;
}

function isSorted(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || compareUtf8(values[index - 1]!, value) < 0);
}

function pathsOverlap(
  left: string,
  right: string,
  convention: BenchmarkRun["execution"]["pathConvention"],
): boolean {
  const comparableLeft = convention === "win32" ? left.toLowerCase() : left;
  const comparableRight = convention === "win32" ? right.toLowerCase() : right;
  return (
    comparableLeft === comparableRight ||
    comparableLeft.startsWith(`${comparableRight}/`) ||
    comparableRight.startsWith(`${comparableLeft}/`)
  );
}

function temporaryRootsOverlap(
  left: string,
  right: string,
  convention: BenchmarkRun["execution"]["pathConvention"],
): boolean {
  const separator = convention === "win32" ? "\\" : "/";
  const canonicalize = (value: string) => {
    const withoutTrailingSeparator = value.endsWith(separator) ? value.slice(0, -1) : value;
    return convention === "win32"
      ? withoutTrailingSeparator.toLowerCase()
      : withoutTrailingSeparator;
  };
  const comparableLeft = canonicalize(left);
  const comparableRight = canonicalize(right);
  return (
    comparableLeft === comparableRight ||
    comparableLeft.startsWith(`${comparableRight}${separator}`) ||
    comparableRight.startsWith(`${comparableLeft}${separator}`)
  );
}

function temporaryRootsAreIsolated(run: BenchmarkRun): boolean {
  const { pathConvention, temporaryConfigRoot, temporaryHome } = run.execution;
  if (pathConvention === "posix") {
    const valid = (value: string) =>
      path.posix.isAbsolute(value) &&
      value !== path.posix.parse(value).root &&
      path.posix.normalize(value) === value &&
      !value.includes("\\");
    return (
      valid(temporaryHome) &&
      valid(temporaryConfigRoot) &&
      !temporaryRootsOverlap(temporaryHome, temporaryConfigRoot, pathConvention)
    );
  }
  const reservedWindowsRootSegment =
    /^(?:aux|clock\$|con|conin\$|conout\$|nul|prn|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu;
  const valid = (value: string) => {
    const root = path.win32.parse(value).root;
    const segments = value.slice(root.length).split("\\").filter(Boolean);
    return (
      path.win32.isAbsolute(value) &&
      value.toLowerCase() !== root.toLowerCase() &&
      path.win32.normalize(value) === value &&
      segments.every(
        (segment) =>
          !segment.endsWith(".") &&
          !segment.endsWith(" ") &&
          !/[\u0000-\u001f<>:"|?*]/.test(segment) &&
          !reservedWindowsRootSegment.test(segment),
      )
    );
  };
  return (
    valid(temporaryHome) &&
    valid(temporaryConfigRoot) &&
    !temporaryRootsOverlap(temporaryHome, temporaryConfigRoot, pathConvention)
  );
}

export function createPreRunPlanCommitment(plan: BenchmarkRun["execution"]["preRunPlan"]): string {
  const canonicalInput = {
    gromaOwnedOutputPaths: [...plan.gromaOwnedOutputPaths],
    pathConvention: plan.pathConvention,
    preparedSourceSnapshotSha256: plan.preparedSourceSnapshotSha256,
    rendererDeclaredMainLayerBudget: {
      nodes: plan.rendererDeclaredMainLayerBudget.nodes,
      relationships: plan.rendererDeclaredMainLayerBudget.relationships,
    },
    schemaVersion: 1,
    sourceHashExcludedPaths: [...plan.sourceHashExcludedPaths],
  };
  return createHash("sha256").update(JSON.stringify(canonicalInput)).digest("hex");
}

function allSame(values: readonly string[]): boolean {
  return values.length >= 2 && values.every((value) => value === values[0]);
}

function portion(numerator: number, denominator: number, maximum: number): number {
  if (denominator === 0) return maximum;
  return Math.round((Math.min(numerator, denominator) / denominator) * maximum * 100) / 100;
}

function commandLines(run: BenchmarkRun): readonly (readonly string[])[] {
  return run.execution.commands.map((command) => command.argv);
}

function collectAuditedInputPaths(audit: BenchmarkAudit): string[] {
  const paths = [
    ...audit.project.sourceScopes.flatMap((scope) => scope.protectedRoots),
    ...audit.facts.flatMap((fact) => fact.evidence.map((witness) => witness.path)),
    ...audit.forbiddenClaims.flatMap((claim) => claim.evidence.map((witness) => witness.path)),
  ];
  return paths.filter((value, index) => paths.indexOf(value) === index);
}

function addFailure(
  failures: { code: BenchmarkFailureCode; evidence: string[] }[],
  code: BenchmarkFailureCode,
  evidence: readonly string[],
): void {
  failures.push({ code, evidence: [...evidence] });
}

export function scoreBenchmarkRun(audit: BenchmarkAudit, run: BenchmarkRun): BenchmarkScore {
  const failures: { code: BenchmarkFailureCode; evidence: string[] }[] = [];
  const requiredFactIds = audit.facts
    .filter((fact) => fact.importance === "required")
    .map((fact) => fact.id);
  const allFactIds = new Set(audit.facts.map((fact) => fact.id));
  const requiredCovered = run.claims.coveredRequiredFactIds.filter((id) =>
    requiredFactIds.includes(id),
  );
  const unknownCovered = [
    ...run.claims.coveredRequiredFactIds,
    ...run.claims.coveredSupportingFactIds,
    ...run.claims.assessedClaims.flatMap((claim) => claim.factIds),
  ].filter((id) => !allFactIds.has(id));
  const factsBackedByRawClaims = new Set(
    run.claims.assessedClaims.flatMap((claim) => claim.factIds),
  );
  const auditedInputPaths = collectAuditedInputPaths(audit);

  if (run.auditId !== audit.auditId) {
    addFailure(failures, "AUDIT_MISMATCH", [
      `expected ${audit.auditId}`,
      `received ${run.auditId}`,
    ]);
  }
  const projectIdentityFields = ["repository", "revision", "tree"] as const;
  const projectIdentityMismatches = projectIdentityFields
    .filter((field) => run.execution.project[field] !== audit.project[field])
    .map(
      (field) =>
        `${field}: expected ${audit.project[field]}, received ${run.execution.project[field]}`,
    );
  if (projectIdentityMismatches.length > 0) {
    addFailure(failures, "AUDIT_PROJECT_MISMATCH", projectIdentityMismatches);
  }
  const auditPreparation = audit.project.fixturePreparation;
  const runPreparation = run.execution.fixturePreparation;
  const preparationProblems: string[] = [];
  if (runPreparation.method !== auditPreparation.method) {
    preparationProblems.push(
      `method: expected ${auditPreparation.method}, received ${runPreparation.method}`,
    );
  }
  if (
    !sameArray(
      runPreparation.declaredPreexistingGromaOwnedPaths,
      auditPreparation.preexistingGromaOwnedPaths,
    )
  ) {
    preparationProblems.push("declared pre-existing Groma-owned paths do not match the audit");
  }
  if (
    !sameArray(
      runPreparation.removedPreexistingGromaOwnedPaths,
      auditPreparation.preexistingGromaOwnedPaths,
    )
  ) {
    preparationProblems.push("removed pre-existing Groma-owned paths do not match the audit");
  }
  if (!runPreparation.gromaOwnedStateAbsentBeforeInit) {
    preparationProblems.push("Groma-owned state remained before groma init");
  }
  const unsafePreparationOverlaps = [
    ...runPreparation.declaredPreexistingGromaOwnedPaths.map(
      (value) => ["declared", value] as const,
    ),
    ...runPreparation.removedPreexistingGromaOwnedPaths.map((value) => ["removed", value] as const),
  ].flatMap(([kind, preparationPath]) =>
    auditedInputPaths
      .filter((auditedInputPath) =>
        strictPortablePathsOverlapConservatively(preparationPath, auditedInputPath),
      )
      .map((auditedInputPath) => `${kind} ${preparationPath}<->${auditedInputPath}`),
  );
  if (unsafePreparationOverlaps.length > 0) {
    preparationProblems.push(...unsafePreparationOverlaps);
  }
  if (
    runPreparation.completedAtMonotonicMilliseconds >
      run.execution.preRunPlan.frozenAtMonotonicMilliseconds ||
    runPreparation.completedAtMonotonicMilliseconds >=
      run.execution.spawnedInitAtMonotonicMilliseconds
  ) {
    preparationProblems.push("fixture preparation was not completed before planning and timing");
  }
  if (preparationProblems.length > 0) {
    addFailure(failures, "FIXTURE_PREPARATION_INVALID", preparationProblems);
  }
  const snapshotMismatches = [
    ["prepared fixture", runPreparation.preparedSourceSnapshotSha256],
    ["committed plan", run.execution.preRunPlan.preparedSourceSnapshotSha256],
    ["pre-execution source", run.execution.sourceBeforeSha256],
  ]
    .filter(([, digest]) => digest !== auditPreparation.preparedSourceSnapshotSha256)
    .map(
      ([location, digest]) =>
        `${location}: expected ${auditPreparation.preparedSourceSnapshotSha256}, received ${digest}`,
    );
  if (
    runPreparation.preparedSourceSnapshotPathCount !==
    auditPreparation.preparedSourceSnapshotPathCount
  ) {
    snapshotMismatches.push(
      `path count: expected ${auditPreparation.preparedSourceSnapshotPathCount}, received ${runPreparation.preparedSourceSnapshotPathCount}`,
    );
  }
  if (snapshotMismatches.length > 0) {
    addFailure(failures, "FIXTURE_SNAPSHOT_MISMATCH", snapshotMismatches);
  }
  const observedWorkflow = commandLines(run);
  if (
    observedWorkflow.length !== benchmarkWorkflow.length ||
    !observedWorkflow.every((argv, index) => sameArray(argv, benchmarkWorkflow[index] ?? []))
  ) {
    addFailure(
      failures,
      "WORKFLOW_MISMATCH",
      observedWorkflow.length === 0
        ? ["no commands recorded"]
        : observedWorkflow.map((argv) => argv.join(" ")),
    );
  }
  const failedCommands = run.execution.commands
    .filter((command) => command.exitCode !== 0)
    .map((command) => `${command.argv.join(" ")} exited ${command.exitCode}: ${command.stderr}`);
  if (failedCommands.length > 0) addFailure(failures, "COMMAND_FAILED", failedCommands);
  if (!run.execution.networkIsolation.enforcedAtOsLevel) {
    addFailure(failures, "NETWORK_ISOLATION_NOT_ENFORCED", [
      run.execution.networkIsolation.mechanism,
    ]);
  }
  if (!run.execution.stdinClosed) addFailure(failures, "STDIN_NOT_CLOSED", ["stdin remained open"]);
  if (!temporaryRootsAreIsolated(run)) {
    addFailure(failures, "TEMPORARY_ENVIRONMENT_NOT_ISOLATED", [
      run.execution.temporaryHome,
      run.execution.temporaryConfigRoot,
    ]);
  }
  const executionPaths = [
    ...run.execution.gromaOwnedOutputPaths,
    ...run.execution.sourceHashExcludedPaths,
  ];
  const plannedPaths = [
    ...run.execution.preRunPlan.gromaOwnedOutputPaths,
    ...run.execution.preRunPlan.sourceHashExcludedPaths,
  ];
  if (
    executionPaths.some((value) => !isStrictPortableWorkspaceDescendant(value)) ||
    plannedPaths.some((value) => !isStrictPortableWorkspaceDescendant(value)) ||
    !isSorted(run.execution.gromaOwnedOutputPaths) ||
    !isSorted(run.execution.sourceHashExcludedPaths) ||
    !isSorted(run.execution.preRunPlan.gromaOwnedOutputPaths) ||
    !isSorted(run.execution.preRunPlan.sourceHashExcludedPaths)
  ) {
    addFailure(failures, "SOURCE_OUTPUT_PATH_INVALID", [...executionPaths, ...plannedPaths]);
  }
  const protectedOverlaps = [
    ...executionPaths.flatMap((outputPath) =>
      auditedInputPaths
        .filter((auditedInputPath) =>
          pathsOverlap(outputPath, auditedInputPath, run.execution.pathConvention),
        )
        .map((auditedInputPath) => `${outputPath}<->${auditedInputPath}`),
    ),
    ...plannedPaths.flatMap((outputPath) =>
      auditedInputPaths
        .filter((auditedInputPath) =>
          pathsOverlap(outputPath, auditedInputPath, run.execution.preRunPlan.pathConvention),
        )
        .map((auditedInputPath) => `${outputPath}<->${auditedInputPath}`),
    ),
  ];
  if (protectedOverlaps.length > 0) {
    addFailure(failures, "SOURCE_OUTPUT_OVERLAPS_PROTECTED_SOURCE", protectedOverlaps);
  }
  if (
    run.execution.gromaOwnedOutputPaths.length === 0 ||
    !sameArray(run.execution.gromaOwnedOutputPaths, run.execution.sourceHashExcludedPaths) ||
    run.execution.preRunPlan.gromaOwnedOutputPaths.length === 0 ||
    !sameArray(
      run.execution.preRunPlan.gromaOwnedOutputPaths,
      run.execution.preRunPlan.sourceHashExcludedPaths,
    )
  ) {
    addFailure(failures, "SOURCE_HASH_EXCLUSIONS_MISMATCH", [
      `owned=${run.execution.gromaOwnedOutputPaths.join(",")}`,
      `excluded=${run.execution.sourceHashExcludedPaths.join(",")}`,
    ]);
  }
  const computedPlanCommitment = createPreRunPlanCommitment(run.execution.preRunPlan);
  if (computedPlanCommitment !== run.execution.preRunPlan.commitmentSha256) {
    addFailure(failures, "PRE_RUN_PLAN_DIGEST_MISMATCH", [
      run.execution.preRunPlan.commitmentSha256,
      computedPlanCommitment,
    ]);
  }
  if (
    run.execution.preRunPlan.frozenAtMonotonicMilliseconds >
    run.execution.spawnedInitAtMonotonicMilliseconds
  ) {
    addFailure(failures, "PRE_RUN_PLAN_NOT_FROZEN", [
      `plan ${run.execution.preRunPlan.frozenAtMonotonicMilliseconds}`,
      `init ${run.execution.spawnedInitAtMonotonicMilliseconds}`,
    ]);
  }
  if (
    run.execution.preRunPlan.pathConvention !== run.execution.pathConvention ||
    !sameArray(
      run.execution.preRunPlan.gromaOwnedOutputPaths,
      run.execution.gromaOwnedOutputPaths,
    ) ||
    !sameArray(
      run.execution.preRunPlan.sourceHashExcludedPaths,
      run.execution.sourceHashExcludedPaths,
    ) ||
    run.execution.preRunPlan.rendererDeclaredMainLayerBudget.nodes !==
      run.presentation.declaredMainLayerBudget.nodes ||
    run.execution.preRunPlan.rendererDeclaredMainLayerBudget.relationships !==
      run.presentation.declaredMainLayerBudget.relationships
  ) {
    addFailure(failures, "PRE_RUN_PLAN_MISMATCH", ["pre-run plan does not match scored run"]);
  }
  if (run.execution.sourceBeforeSha256 !== run.execution.sourceAfterSha256) {
    addFailure(failures, "SOURCE_MUTATED", [
      run.execution.sourceBeforeSha256,
      run.execution.sourceAfterSha256,
    ]);
  }
  if (run.execution.aiOrHelperInferenceUsed) {
    addFailure(failures, "AI_OR_HELPER_INFERENCE_USED", ["execution recorded helper inference"]);
  }
  if (run.execution.humanCorrectionBeforeFreeze) {
    addFailure(failures, "HUMAN_CORRECTION_BEFORE_FREEZE", ["execution recorded human correction"]);
  }
  if (!run.execution.humanGroundTruthAuditCompletedBeforeRun) {
    addFailure(failures, "GROUND_TRUTH_AUDIT_NOT_PRECOMMITTED", ["ground truth was not frozen"]);
  }
  if (audit.reservation.heldOut && !run.execution.scannerAndRulesFrozenBeforeHeldOutRun) {
    addFailure(failures, "HELD_OUT_SCANNER_NOT_FROZEN", [audit.auditId]);
  }
  if (!run.execution.outputsFrozenBeforeHumanEvaluation) {
    addFailure(failures, "OUTPUT_NOT_FROZEN_BEFORE_EVALUATION", [
      "human evaluation preceded freeze",
    ]);
  }
  if (
    !/^[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)+$/.test(
      run.presentation.frozenMainLayer.machineObservableFreezeSignal,
    )
  ) {
    addFailure(failures, "MAIN_LAYER_NOT_MACHINE_FROZEN", [
      `invalid freeze signal ${JSON.stringify(run.presentation.frozenMainLayer.machineObservableFreezeSignal)}`,
    ]);
  }

  const firstMinuteMilliseconds =
    run.execution.mainLayerFrozenAtMonotonicMilliseconds -
    run.execution.spawnedInitAtMonotonicMilliseconds;
  if (firstMinuteMilliseconds < 0 || firstMinuteMilliseconds > maximumFirstMinuteMilliseconds) {
    addFailure(failures, "FIRST_MINUTE_EXCEEDED", [`${firstMinuteMilliseconds}ms`]);
  }
  const forbiddenClaimsById = new Map(
    audit.forbiddenClaims.map((claim) => [claim.id, claim] as const),
  );
  const forbiddenClaimsByText = new Map(
    audit.forbiddenClaims.map((claim) => [claim.claim, claim] as const),
  );
  const allFalseClaims = [...run.claims.criticalFalseClaims, ...run.claims.noncriticalFalseClaims];
  const invalidForbiddenLinks = allFalseClaims.flatMap((claim) =>
    claim.forbiddenClaimIds
      .filter((id) => !forbiddenClaimsById.has(id))
      .map((id) => `${claim.claimId}->${id}`),
  );
  if (invalidForbiddenLinks.length > 0) {
    addFailure(failures, "FALSE_CLAIM_FORBIDDEN_LINK_INVALID", invalidForbiddenLinks);
  }
  const linkedCriticalClaims = run.claims.noncriticalFalseClaims.filter(
    (claim) =>
      claim.forbiddenClaimIds.some((id) => forbiddenClaimsById.get(id)?.severity === "critical") ||
      forbiddenClaimsByText.get(claim.claim)?.severity === "critical",
  );
  const effectiveCriticalClaims = [...run.claims.criticalFalseClaims, ...linkedCriticalClaims];
  const exactCriticalAssessedClaims = run.claims.assessedClaims.filter(
    (claim) => forbiddenClaimsByText.get(claim.claim)?.severity === "critical",
  );
  const exactNoncriticalAssessedClaims = run.claims.assessedClaims.filter(
    (claim) => forbiddenClaimsByText.get(claim.claim)?.severity === "noncritical",
  );
  if (effectiveCriticalClaims.length > 0 || exactCriticalAssessedClaims.length > 0) {
    addFailure(failures, "CRITICAL_FALSE_CLAIM", [
      ...effectiveCriticalClaims.flatMap((claim) => [
        `${claim.claimId}: ${claim.claim}`,
        ...claim.forbiddenClaimIds.map((id) => `forbidden ${id}`),
        ...(claim.forbiddenClaimIds.length === 0 && forbiddenClaimsByText.has(claim.claim)
          ? [`matched forbidden text ${forbiddenClaimsByText.get(claim.claim)!.id}`]
          : []),
        ...claim.evidence.map((evidence) => evidence.detail),
      ]),
      ...exactCriticalAssessedClaims.flatMap((claim) => [
        `${claim.claimId}: ${claim.claim}`,
        `matched forbidden text ${forbiddenClaimsByText.get(claim.claim)!.id}`,
        ...claim.evidence.flatMap((evidence) => [
          evidence.detail,
          `observation ${evidence.observationId}`,
          `source ${evidence.sourcePath}`,
        ]),
      ]),
    ]);
  }
  const missingRequired = requiredFactIds.filter(
    (id) => !run.claims.coveredRequiredFactIds.includes(id),
  );
  const reportedCoverage = [
    ...run.claims.coveredRequiredFactIds,
    ...run.claims.coveredSupportingFactIds,
  ];
  const coverageWithoutRawClaim = reportedCoverage.filter((id) => !factsBackedByRawClaims.has(id));
  const unreportedRawClaimCoverage = [...factsBackedByRawClaims].filter(
    (id) => !reportedCoverage.includes(id),
  );
  if (
    missingRequired.length > 0 ||
    unknownCovered.length > 0 ||
    coverageWithoutRawClaim.length > 0 ||
    unreportedRawClaimCoverage.length > 0
  ) {
    addFailure(failures, "REQUIRED_FACT_COVERAGE_INCOMPLETE", [
      ...missingRequired.map((id) => `missing ${id}`),
      ...unknownCovered.map((id) => `unknown ${id}`),
      ...coverageWithoutRawClaim.map((id) => `no raw claim for ${id}`),
      ...unreportedRawClaimCoverage.map((id) => `raw claim not reported for ${id}`),
    ]);
  }
  const rescans = run.repeatability.rescans;
  const rescanIds = rescans.map((rescan) => rescan.id);
  const rescanRecordsComplete =
    rescans.length >= 2 &&
    new Set(rescanIds).size === rescanIds.length &&
    rescans.every((rescan, index) => rescan.ordinal === index + 1);
  if (!rescanRecordsComplete) {
    addFailure(
      failures,
      "RESCAN_RECORDS_INCOMPLETE",
      rescans.length === 0
        ? ["no rescan instances recorded"]
        : [
            `recorded ${rescans.length} rescan instances`,
            ...rescans.map((rescan) => `${rescan.ordinal}:${rescan.id}`),
          ],
    );
  }
  const expectedRescanWorkflow = benchmarkWorkflow.slice(1);
  const rescanWorkflowsMatch =
    rescanRecordsComplete &&
    rescans.every(
      (rescan) =>
        rescan.commands.length === expectedRescanWorkflow.length &&
        rescan.commands.every((command, index) =>
          sameArray(command.argv, expectedRescanWorkflow[index] ?? []),
        ),
    );
  if (rescanRecordsComplete && !rescanWorkflowsMatch) {
    addFailure(
      failures,
      "RESCAN_WORKFLOW_MISMATCH",
      rescans.flatMap((rescan) =>
        rescan.commands.length === 0
          ? [`${rescan.id}: no commands recorded`]
          : rescan.commands.map((command) => `${rescan.id}: ${command.argv.join(" ")}`),
      ),
    );
  }
  const failedRescanCommands = rescans.flatMap((rescan) =>
    rescan.commands
      .filter((command) => command.exitCode !== 0)
      .map(
        (command) =>
          `${rescan.id}: ${command.argv.join(" ")} exited ${command.exitCode}: ${command.stderr}`,
      ),
  );
  const rescanCommandsSuccessful = rescanWorkflowsMatch && failedRescanCommands.length === 0;
  if (rescanWorkflowsMatch && failedRescanCommands.length > 0) {
    addFailure(failures, "RESCAN_COMMAND_FAILED", failedRescanCommands);
  }
  const mismatchedRescanInputs = rescans
    .filter(
      (rescan) =>
        rescan.preparedSourceSnapshotSha256 !==
        audit.project.fixturePreparation.preparedSourceSnapshotSha256,
    )
    .map(
      (rescan) =>
        `${rescan.id}: expected ${audit.project.fixturePreparation.preparedSourceSnapshotSha256}, received ${rescan.preparedSourceSnapshotSha256}`,
    );
  const rescanInputsMatch = rescanCommandsSuccessful && mismatchedRescanInputs.length === 0;
  if (rescanCommandsSuccessful && mismatchedRescanInputs.length > 0) {
    addFailure(failures, "RESCAN_INPUT_MISMATCH", mismatchedRescanInputs);
  }
  const rescansEligibleForStability = rescanInputsMatch;
  const rescanDigests = <Field extends keyof BenchmarkRun["repeatability"]["rescans"][number]>(
    field: Field,
  ): string[] => rescans.map((rescan) => String(rescan[field]));
  if (rescansEligibleForStability && !allSame(rescanDigests("rawObservationOrderingDigest"))) {
    addFailure(failures, "RAW_OBSERVATION_ORDER_CHANGED", [
      ...rescanDigests("rawObservationOrderingDigest"),
    ]);
  }
  if (rescansEligibleForStability && !allSame(rescanDigests("rawObservationDigest"))) {
    addFailure(failures, "RAW_OBSERVATION_DIGEST_CHANGED", [
      ...rescanDigests("rawObservationDigest"),
    ]);
  }
  if (rescansEligibleForStability && !allSame(rescanDigests("observationIdentityDigest"))) {
    addFailure(failures, "OBSERVATION_IDENTITY_CHANGED", [
      ...rescanDigests("observationIdentityDigest"),
    ]);
  }
  if (rescansEligibleForStability && !allSame(rescanDigests("canonicalIdentityDigest"))) {
    addFailure(failures, "CANONICAL_IDENTITY_CHANGED", [
      ...rescanDigests("canonicalIdentityDigest"),
    ]);
  }
  if (rescansEligibleForStability && !allSame(rescanDigests("canonicalByteDigest"))) {
    addFailure(failures, "CANONICAL_BYTES_CHANGED", [...rescanDigests("canonicalByteDigest")]);
  }
  const emittedClaimIds = [
    ...run.claims.assessedClaims.map((claim) => claim.claimId),
    ...allFalseClaims.map((claim) => claim.claimId),
  ];
  const evidenceBackedClaimIds = [
    ...run.claims.assessedClaims
      .filter((claim) =>
        claim.evidence.some(
          (evidence) => evidence.observationId.length > 0 && evidence.sourcePath.length > 0,
        ),
      )
      .map((claim) => claim.claimId),
    ...allFalseClaims
      .filter((claim) =>
        claim.evidence.some(
          (evidence) => evidence.observationId !== undefined && evidence.sourcePath !== undefined,
        ),
      )
      .map((claim) => claim.claimId),
  ];
  const missingStructuredEvidence = emittedClaimIds.filter(
    (id) => !evidenceBackedClaimIds.includes(id),
  );
  if (
    run.provenance.inScopeClaimIds.length === 0 ||
    !sameSet(run.provenance.inScopeClaimIds, emittedClaimIds) ||
    !sameSet(run.provenance.inScopeClaimIds, evidenceBackedClaimIds) ||
    !sameSet(run.provenance.claimIdsWithValidWitnesses, evidenceBackedClaimIds)
  ) {
    addFailure(
      failures,
      "PROVENANCE_INCOMPLETE",
      missingStructuredEvidence.length > 0
        ? missingStructuredEvidence.map((id) => `${id}: no structured witness evidence`)
        : ["claim inventory, structured evidence, and provenance do not match"],
    );
  }

  const { declaredMainLayerBudget: budget, frozenMainLayer: layer } = run.presentation;
  if (budget.nodes < 1 || budget.relationships < 1) {
    addFailure(failures, "MAIN_LAYER_BUDGET_UNDECLARED", [JSON.stringify(budget)]);
  } else if (layer.nodes > budget.nodes || layer.relationships > budget.relationships) {
    addFailure(failures, "MAIN_LAYER_BUDGET_EXCEEDED", [
      `nodes ${layer.nodes}/${budget.nodes}`,
      `relationships ${layer.relationships}/${budget.relationships}`,
    ]);
  }
  if (!run.presentation.uncertainty.visible || run.presentation.uncertainty.coverageGapCount < 1) {
    addFailure(failures, "UNCERTAINTY_NOT_VISIBLE", [
      `coverage gaps ${run.presentation.uncertainty.coverageGapCount}`,
    ]);
  } else if (run.presentation.uncertainty.nonColorCue === "none") {
    addFailure(failures, "UNCERTAINTY_COLOR_ONLY", ["no text or shape cue"]);
  }

  const requiredQuestionIds = audit.comprehensionQuestions
    .filter((question) => question.required)
    .map((question) => question.id);
  const comprehensionUnaided =
    !run.comprehension.evaluatorHadAgentAssistance &&
    !run.comprehension.evaluatorHadPriorProjectKnowledge &&
    run.comprehension.startedAfterFreeze &&
    run.comprehension.usedOnlyFrozenInitialMainLayer &&
    sameArray(run.comprehension.materials, ["frozen-initial-main-layer"]);
  if (!comprehensionUnaided) {
    addFailure(failures, "COMPREHENSION_NOT_UNAIDED", [...run.comprehension.materials]);
  }
  const missingAnswers = requiredQuestionIds.filter(
    (id) =>
      !run.comprehension.answeredQuestionIds.includes(id) ||
      !run.comprehension.correctQuestionIds.includes(id),
  );
  if (missingAnswers.length > 0) {
    addFailure(failures, "COMPREHENSION_INCOMPLETE", missingAnswers);
  }
  if (run.comprehension.criticalMisunderstandings.length > 0) {
    addFailure(
      failures,
      "COMPREHENSION_CRITICAL_MISUNDERSTANDING",
      run.comprehension.criticalMisunderstandings,
    );
  }

  const rawStable =
    rescansEligibleForStability && allSame(rescanDigests("rawObservationOrderingDigest"));
  const rawDigestStable =
    rescansEligibleForStability && allSame(rescanDigests("rawObservationDigest"));
  const observationIdentityStable =
    rescansEligibleForStability && allSame(rescanDigests("observationIdentityDigest"));
  const canonicalIdentityStable =
    rescansEligibleForStability && allSame(rescanDigests("canonicalIdentityDigest"));
  const canonicalBytesStable =
    rescansEligibleForStability && allSame(rescanDigests("canonicalByteDigest"));
  const provenanceCovered = run.provenance.inScopeClaimIds.filter((id) =>
    evidenceBackedClaimIds.includes(id),
  ).length;
  const correctRequiredQuestions = requiredQuestionIds.filter((id) =>
    run.comprehension.correctQuestionIds.includes(id),
  ).length;
  const dimensions = {
    falseClaims: Math.max(
      0,
      20 -
        (effectiveCriticalClaims.length + exactCriticalAssessedClaims.length) * 20 -
        run.claims.noncriticalFalseClaims.filter((claim) => !linkedCriticalClaims.includes(claim))
          .length *
          2 -
        exactNoncriticalAssessedClaims.length * 2,
    ),
    firstMinute:
      firstMinuteMilliseconds >= 0 && firstMinuteMilliseconds <= maximumFirstMinuteMilliseconds
        ? 10
        : 0,
    observableFactCoverage: portion(
      requiredCovered.filter((id) => factsBackedByRawClaims.has(id)).length,
      requiredFactIds.length,
      20,
    ),
    presentationIntegrity:
      (budget.nodes > 0 &&
      budget.relationships > 0 &&
      layer.nodes <= budget.nodes &&
      layer.relationships <= budget.relationships
        ? 2
        : 0) +
      (run.presentation.uncertainty.visible &&
      run.presentation.uncertainty.coverageGapCount > 0 &&
      run.presentation.uncertainty.nonColorCue !== "none"
        ? 3
        : 0),
    provenance:
      run.provenance.inScopeClaimIds.length === 0
        ? 0
        : portion(provenanceCovered, run.provenance.inScopeClaimIds.length, 10),
    repeatability: (rawStable ? 5 : 0) + (rawDigestStable ? 5 : 0),
    stableIdentityAndCanonicalBytes:
      (observationIdentityStable ? 5 : 0) +
      (canonicalIdentityStable ? 5 : 0) +
      (canonicalBytesStable ? 5 : 0),
    unaidedComprehension:
      comprehensionUnaided && run.comprehension.criticalMisunderstandings.length === 0
        ? portion(correctRequiredQuestions, requiredQuestionIds.length, 10)
        : 0,
  };
  const total =
    Math.round(Object.values(dimensions).reduce((sum, score) => sum + score, 0) * 100) / 100;
  const orderedFailures = benchmarkFailureCodes.flatMap((code) =>
    failures.filter((failure) => failure.code === code),
  );
  return Object.freeze({
    dimensions: Object.freeze(dimensions),
    failures: Object.freeze(
      orderedFailures.map((failure) =>
        Object.freeze({ code: failure.code, evidence: Object.freeze(failure.evidence) }),
      ),
    ),
    passed: orderedFailures.length === 0,
    total,
  });
}
