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

export function createMachineObservableFreezeSignal(
  artifactSha256: string,
  frozenAtMonotonicMilliseconds: number,
): string {
  return `main-layer:frozen:sha256-${artifactSha256}:monotonic-ms-${frozenAtMonotonicMilliseconds}`;
}

export const benchmarkFailureCodes = [
  "AUDIT_MISMATCH",
  "AUDIT_PROJECT_MISMATCH",
  "FIXTURE_PREPARATION_INVALID",
  "FIXTURE_SNAPSHOT_MISMATCH",
  "WORKFLOW_MISMATCH",
  "COMMAND_FAILED",
  "COMMAND_EXECUTION_CONTEXT_MISMATCH",
  "COMMAND_TIMING_INVALID",
  "NETWORK_ISOLATION_NOT_ENFORCED",
  "STDIN_NOT_CLOSED",
  "TEMPORARY_ENVIRONMENT_NOT_ISOLATED",
  "SOURCE_OUTPUT_PATH_INVALID",
  "SOURCE_OUTPUT_OVERLAPS_PROTECTED_SOURCE",
  "SOURCE_HASH_EXCLUSIONS_MISMATCH",
  "PRE_RUN_PLAN_DIGEST_MISMATCH",
  "PRE_RUN_PLAN_NOT_FROZEN",
  "SOURCE_CAPTURE_TIMING_INVALID",
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
  "RESCAN_EXECUTION_CONTEXT_MISMATCH",
  "RESCAN_TIMING_INVALID",
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
  "COMPREHENSION_ARTIFACT_MISMATCH",
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

function hasUnsupportedWin32NamespacePrefix(value: string): boolean {
  return /^\\\\[?.]\\/.test(value);
}

const reservedWindowsRootSegment =
  /^(?:aux|clock\$|con|conin\$|conout\$|nul|prn|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu;

function win32RootSegmentIsValid(segment: string): boolean {
  return (
    segment.length > 0 &&
    segment !== "." &&
    segment !== ".." &&
    !segment.endsWith(".") &&
    !segment.endsWith(" ") &&
    !/[\u0000-\u001f<>:"|?*]/.test(segment) &&
    !reservedWindowsRootSegment.test(segment)
  );
}

function hasQualifiedWin32Root(value: string): boolean {
  if (/^[A-Za-z]:\\/.test(value)) return true;
  const uncAuthority = /^\\\\([^\\]*)\\([^\\]*)\\/.exec(value);
  return (
    uncAuthority !== null &&
    win32RootSegmentIsValid(uncAuthority[1]!) &&
    win32RootSegmentIsValid(uncAuthority[2]!)
  );
}

function temporaryRootsAreIsolated(run: BenchmarkRun): boolean {
  const { pathConvention, temporaryConfigRoot, temporaryHome } = run.execution;
  return (
    absoluteRootIsNormalized(temporaryHome, pathConvention) &&
    absoluteRootIsNormalized(temporaryConfigRoot, pathConvention) &&
    !temporaryRootsOverlap(temporaryHome, temporaryConfigRoot, pathConvention)
  );
}

function absoluteRootIsNormalized(
  value: string,
  convention: BenchmarkRun["execution"]["pathConvention"],
): boolean {
  if (convention === "posix") {
    return (
      path.posix.isAbsolute(value) &&
      value !== path.posix.parse(value).root &&
      path.posix.normalize(value) === value &&
      !value.includes("\0") &&
      !value.includes("\\")
    );
  }
  if (hasUnsupportedWin32NamespacePrefix(value) || !hasQualifiedWin32Root(value)) return false;
  const root = path.win32.parse(value).root;
  const segments = value.slice(root.length).split("\\").filter(Boolean);
  return (
    path.win32.isAbsolute(value) &&
    value.toLowerCase() !== root.toLowerCase() &&
    path.win32.normalize(value) === value &&
    segments.every(win32RootSegmentIsValid)
  );
}

function executionContextIsValid(run: BenchmarkRun): boolean {
  const { pathConvention, temporaryConfigRoot, temporaryHome, workspaceRoot } = run.execution;
  return (
    absoluteRootIsNormalized(temporaryHome, pathConvention) &&
    absoluteRootIsNormalized(temporaryConfigRoot, pathConvention) &&
    absoluteRootIsNormalized(workspaceRoot, pathConvention) &&
    !temporaryRootsOverlap(temporaryHome, temporaryConfigRoot, pathConvention) &&
    !temporaryRootsOverlap(workspaceRoot, temporaryHome, pathConvention) &&
    !temporaryRootsOverlap(workspaceRoot, temporaryConfigRoot, pathConvention)
  );
}

function expectedCommandContext(run: BenchmarkRun): {
  effectiveConfigRoot: string;
  effectiveHome: string;
  workingDirectory: string;
} {
  return {
    effectiveConfigRoot: run.execution.temporaryConfigRoot,
    effectiveHome: run.execution.temporaryHome,
    workingDirectory: run.execution.workspaceRoot,
  };
}

function commandContextProblems(
  run: BenchmarkRun,
  commands: readonly BenchmarkRun["execution"]["commands"][number][],
  prefix: string,
): string[] {
  const expected = expectedCommandContext(run);
  return commands.flatMap((command, index) =>
    (["workingDirectory", "effectiveHome", "effectiveConfigRoot"] as const)
      .filter((field) => command[field] !== expected[field])
      .map(
        (field) =>
          `${prefix}command ${index + 1} ${field}: expected ${expected[field]}, received ${command[field]}`,
      ),
  );
}

function commandTimingProblems(
  commands: readonly BenchmarkRun["execution"]["commands"][number][],
  minimumStart: number,
  maximum: number | undefined,
  prefix: string,
): string[] {
  const problems: string[] = [];
  let previousCompletion = minimumStart;
  for (const [index, command] of commands.entries()) {
    const started = command.startedAtMonotonicMilliseconds;
    const completed = command.completedAtMonotonicMilliseconds;
    if (started < previousCompletion) {
      problems.push(
        `${prefix}command ${index + 1} started ${started} before prior boundary ${previousCompletion}`,
      );
    }
    if (completed < started) {
      problems.push(`${prefix}command ${index + 1} completed ${completed} before start ${started}`);
    }
    if (maximum !== undefined && completed > maximum) {
      problems.push(`${prefix}command ${index + 1} completed ${completed} after ${maximum}`);
    }
    previousCompletion = completed;
  }
  return problems;
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

function assessedClaimBacksFact(
  audit: BenchmarkAudit,
  claim: BenchmarkRun["claims"]["assessedClaims"][number],
  factId: string,
): boolean {
  const fact = audit.facts.find((candidate) => candidate.id === factId);
  if (fact === undefined) return false;
  const expectedProvenanceKind =
    fact.category === "documentation-evidence" ? "documentation" : "source";
  const authenticatedPaths = new Set(fact.evidence.map((witness) => witness.path));
  return claim.evidence.some(
    (evidence) =>
      evidence.provenanceKind === expectedProvenanceKind &&
      authenticatedPaths.has(evidence.sourcePath),
  );
}

function assessedClaimHasValidStructuredEvidence(
  audit: BenchmarkAudit,
  claim: BenchmarkRun["claims"]["assessedClaims"][number],
): boolean {
  return (
    claim.evidence.some(
      (evidence) => evidence.observationId.length > 0 && evidence.sourcePath.length > 0,
    ) && claim.factIds.every((factId) => assessedClaimBacksFact(audit, claim, factId))
  );
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
    run.claims.assessedClaims.flatMap((claim) =>
      claim.factIds.filter((factId) => assessedClaimBacksFact(audit, claim, factId)),
    ),
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
  const initialWorkflowMatches =
    observedWorkflow.length === benchmarkWorkflow.length &&
    observedWorkflow.every((argv, index) => sameArray(argv, benchmarkWorkflow[index] ?? []));
  if (!initialWorkflowMatches) {
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
  const initialCommandsSuccessful = initialWorkflowMatches && failedCommands.length === 0;
  const recordedCommands = [
    ...run.execution.commands.map((command, index) => ({
      command,
      location: `initial command ${index + 1}`,
    })),
    ...run.repeatability.rescans.flatMap((rescan) =>
      rescan.commands.map((command, index) => ({
        command,
        location: `${rescan.id} command ${index + 1}`,
      })),
    ),
  ];
  const networkIsolationProblems = [
    ...(!run.execution.networkIsolation.enforcedAtOsLevel
      ? [`run: ${run.execution.networkIsolation.mechanism}`]
      : []),
    ...recordedCommands
      .filter(({ command }) => !command.networkIsolationEnforcedAtOsLevel)
      .map(({ location, command }) => `${location}: ${command.argv.join(" ")}`),
  ];
  if (networkIsolationProblems.length > 0) {
    addFailure(failures, "NETWORK_ISOLATION_NOT_ENFORCED", networkIsolationProblems);
  }
  const stdinProblems = [
    ...(!run.execution.stdinClosed ? ["run: stdin remained open"] : []),
    ...recordedCommands
      .filter(({ command }) => !command.stdinClosed)
      .map(({ location, command }) => `${location}: ${command.argv.join(" ")}`),
  ];
  if (stdinProblems.length > 0) addFailure(failures, "STDIN_NOT_CLOSED", stdinProblems);
  const initialCommandIsolationValid =
    run.execution.networkIsolation.enforcedAtOsLevel &&
    run.execution.stdinClosed &&
    run.execution.commands.every(
      (command) => command.networkIsolationEnforcedAtOsLevel && command.stdinClosed,
    );
  const allCommandIsolationValid =
    initialCommandIsolationValid &&
    run.repeatability.rescans.every((rescan) =>
      rescan.commands.every(
        (command) => command.networkIsolationEnforcedAtOsLevel && command.stdinClosed,
      ),
    );
  const temporaryEnvironmentIsolated = temporaryRootsAreIsolated(run);
  const globalExecutionContextValid = executionContextIsValid(run);
  if (!temporaryEnvironmentIsolated) {
    addFailure(failures, "TEMPORARY_ENVIRONMENT_NOT_ISOLATED", [
      run.execution.temporaryHome,
      run.execution.temporaryConfigRoot,
    ]);
  }
  const initialContextProblems: string[] = [];
  if (temporaryEnvironmentIsolated) {
    if (!absoluteRootIsNormalized(run.execution.workspaceRoot, run.execution.pathConvention)) {
      initialContextProblems.push(`invalid workspace root ${run.execution.workspaceRoot}`);
    } else if (
      temporaryRootsOverlap(
        run.execution.workspaceRoot,
        run.execution.temporaryHome,
        run.execution.pathConvention,
      ) ||
      temporaryRootsOverlap(
        run.execution.workspaceRoot,
        run.execution.temporaryConfigRoot,
        run.execution.pathConvention,
      )
    ) {
      initialContextProblems.push("workspace, HOME, and config roots are not isolated");
    }
    if (initialWorkflowMatches) {
      initialContextProblems.push(
        ...commandContextProblems(run, run.execution.commands, "initial "),
      );
    }
  }
  if (initialContextProblems.length > 0) {
    addFailure(failures, "COMMAND_EXECUTION_CONTEXT_MISMATCH", initialContextProblems);
  }
  const initialCommandContextValid =
    globalExecutionContextValid && initialWorkflowMatches && initialContextProblems.length === 0;
  const initialTimingProblems = initialWorkflowMatches
    ? commandTimingProblems(
        run.execution.commands,
        run.execution.spawnedInitAtMonotonicMilliseconds,
        run.execution.mainLayerFrozenAtMonotonicMilliseconds,
        "initial ",
      )
    : [];
  const initialCommandTimingValid = initialWorkflowMatches && initialTimingProblems.length === 0;
  if (initialTimingProblems.length > 0) {
    addFailure(failures, "COMMAND_TIMING_INVALID", initialTimingProblems);
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
          strictPortablePathsOverlapConservatively(outputPath, auditedInputPath),
        )
        .map((auditedInputPath) => `${outputPath}<->${auditedInputPath}`),
    ),
    ...plannedPaths.flatMap((outputPath) =>
      auditedInputPaths
        .filter((auditedInputPath) =>
          strictPortablePathsOverlapConservatively(outputPath, auditedInputPath),
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
  const preRunPlanFrozenBeforeInit =
    run.execution.preRunPlan.frozenAtMonotonicMilliseconds <=
    run.execution.spawnedInitAtMonotonicMilliseconds;
  if (!preRunPlanFrozenBeforeInit) {
    addFailure(failures, "PRE_RUN_PLAN_NOT_FROZEN", [
      `plan ${run.execution.preRunPlan.frozenAtMonotonicMilliseconds}`,
      `init ${run.execution.spawnedInitAtMonotonicMilliseconds}`,
    ]);
  }
  const initialSourceCaptureTimingProblems: string[] = [];
  if (
    preRunPlanFrozenBeforeInit &&
    run.execution.sourceBeforeCapturedAtMonotonicMilliseconds <
      run.execution.preRunPlan.frozenAtMonotonicMilliseconds
  ) {
    initialSourceCaptureTimingProblems.push(
      `source-before captured ${run.execution.sourceBeforeCapturedAtMonotonicMilliseconds} before plan freeze ${run.execution.preRunPlan.frozenAtMonotonicMilliseconds}`,
    );
  }
  if (
    run.execution.sourceBeforeCapturedAtMonotonicMilliseconds >
    run.execution.spawnedInitAtMonotonicMilliseconds
  ) {
    initialSourceCaptureTimingProblems.push(
      `source-before captured ${run.execution.sourceBeforeCapturedAtMonotonicMilliseconds} after init spawn ${run.execution.spawnedInitAtMonotonicMilliseconds}`,
    );
  }
  const firstInitialCommandStart = run.execution.commands[0]?.startedAtMonotonicMilliseconds;
  if (
    firstInitialCommandStart !== undefined &&
    run.execution.sourceBeforeCapturedAtMonotonicMilliseconds > firstInitialCommandStart
  ) {
    initialSourceCaptureTimingProblems.push(
      `source-before captured ${run.execution.sourceBeforeCapturedAtMonotonicMilliseconds} after first command start ${firstInitialCommandStart}`,
    );
  }
  if (
    run.execution.sourceAfterCapturedAtMonotonicMilliseconds <
    run.execution.mainLayerFrozenAtMonotonicMilliseconds
  ) {
    initialSourceCaptureTimingProblems.push(
      `source-after captured ${run.execution.sourceAfterCapturedAtMonotonicMilliseconds} before main-layer freeze ${run.execution.mainLayerFrozenAtMonotonicMilliseconds}`,
    );
  }
  const initialSourceCaptureTimingValid =
    preRunPlanFrozenBeforeInit && initialSourceCaptureTimingProblems.length === 0;
  if (initialSourceCaptureTimingProblems.length > 0) {
    addFailure(failures, "SOURCE_CAPTURE_TIMING_INVALID", initialSourceCaptureTimingProblems);
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
  if (
    initialSourceCaptureTimingValid &&
    run.execution.sourceBeforeSha256 !== run.execution.sourceAfterSha256
  ) {
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
  const expectedMachineFreezeSignal = createMachineObservableFreezeSignal(
    run.presentation.frozenMainLayer.artifactSha256,
    run.execution.mainLayerFrozenAtMonotonicMilliseconds,
  );
  const machineFreezeSignalValid =
    run.presentation.frozenMainLayer.machineObservableFreezeSignal === expectedMachineFreezeSignal;
  if (!machineFreezeSignalValid) {
    addFailure(failures, "MAIN_LAYER_NOT_MACHINE_FROZEN", [
      `invalid freeze signal ${JSON.stringify(run.presentation.frozenMainLayer.machineObservableFreezeSignal)}`,
      `expected ${expectedMachineFreezeSignal}`,
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
  const auditSeverityForFalseClaim = (
    claim: (typeof allFalseClaims)[number],
  ): "critical" | "noncritical" | undefined => {
    const auditSeverities = claim.forbiddenClaimIds.flatMap((id) => {
      const severity = forbiddenClaimsById.get(id)?.severity;
      return severity === undefined ? [] : [severity];
    });
    const exactTextSeverity = forbiddenClaimsByText.get(claim.claim)?.severity;
    if (exactTextSeverity !== undefined) auditSeverities.push(exactTextSeverity);
    if (auditSeverities.includes("critical")) return "critical" as const;
    if (auditSeverities.includes("noncritical")) return "noncritical" as const;
    return undefined;
  };
  const criticalBucketClaimIds = new Set(
    run.claims.criticalFalseClaims.map((claim) => claim.claimId),
  );
  const effectiveCriticalClaims = allFalseClaims.filter((claim) => {
    const auditSeverity = auditSeverityForFalseClaim(claim);
    if (auditSeverity !== undefined) return auditSeverity === "critical";
    return criticalBucketClaimIds.has(claim.claimId);
  });
  const effectiveCriticalClaimIds = new Set(effectiveCriticalClaims.map((claim) => claim.claimId));
  const effectiveNoncriticalFalseClaims = allFalseClaims.filter(
    (claim) => !effectiveCriticalClaimIds.has(claim.claimId),
  );
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
  const rescanContextProblems =
    rescanWorkflowsMatch && globalExecutionContextValid
      ? rescans.flatMap((rescan) => commandContextProblems(run, rescan.commands, `${rescan.id} `))
      : [];
  const rescanExecutionContextsMatch =
    rescanWorkflowsMatch && globalExecutionContextValid && rescanContextProblems.length === 0;
  if (rescanContextProblems.length > 0) {
    addFailure(failures, "RESCAN_EXECUTION_CONTEXT_MISMATCH", rescanContextProblems);
  }
  const rescanTimingProblems: string[] = [];
  if (rescanWorkflowsMatch) {
    let chronologicalMinimum = Math.max(
      run.execution.mainLayerFrozenAtMonotonicMilliseconds,
      run.execution.sourceAfterCapturedAtMonotonicMilliseconds,
    );
    for (const rescan of rescans) {
      if (rescan.sourceBeforeCapturedAtMonotonicMilliseconds < chronologicalMinimum) {
        rescanTimingProblems.push(
          `${rescan.id} source-before captured ${rescan.sourceBeforeCapturedAtMonotonicMilliseconds} before prior boundary ${chronologicalMinimum}`,
        );
      }
      const firstCommandStart = rescan.commands[0]!.startedAtMonotonicMilliseconds;
      if (rescan.sourceBeforeCapturedAtMonotonicMilliseconds > firstCommandStart) {
        rescanTimingProblems.push(
          `${rescan.id} source-before captured ${rescan.sourceBeforeCapturedAtMonotonicMilliseconds} after first command start ${firstCommandStart}`,
        );
      }
      rescanTimingProblems.push(
        ...commandTimingProblems(
          rescan.commands,
          Math.max(chronologicalMinimum, rescan.sourceBeforeCapturedAtMonotonicMilliseconds),
          undefined,
          `${rescan.id} `,
        ),
      );
      const finalCommandCompletion =
        rescan.commands.at(-1)?.completedAtMonotonicMilliseconds ?? chronologicalMinimum;
      if (rescan.sourceAfterCapturedAtMonotonicMilliseconds < finalCommandCompletion) {
        rescanTimingProblems.push(
          `${rescan.id} source-after captured ${rescan.sourceAfterCapturedAtMonotonicMilliseconds} before final command ${finalCommandCompletion}`,
        );
      }
      if (
        rescan.digestsCapturedAtMonotonicMilliseconds <
        rescan.sourceAfterCapturedAtMonotonicMilliseconds
      ) {
        rescanTimingProblems.push(
          `${rescan.id} digests captured ${rescan.digestsCapturedAtMonotonicMilliseconds} before source-after ${rescan.sourceAfterCapturedAtMonotonicMilliseconds}`,
        );
      }
      if (rescan.digestsCapturedAtMonotonicMilliseconds < chronologicalMinimum) {
        rescanTimingProblems.push(
          `${rescan.id} digests captured ${rescan.digestsCapturedAtMonotonicMilliseconds} before prior boundary ${chronologicalMinimum}`,
        );
      }
      chronologicalMinimum = Math.max(
        chronologicalMinimum,
        finalCommandCompletion,
        rescan.sourceAfterCapturedAtMonotonicMilliseconds,
        rescan.digestsCapturedAtMonotonicMilliseconds,
      );
    }
  }
  const rescanTimingValid = rescanWorkflowsMatch && rescanTimingProblems.length === 0;
  if (rescanTimingProblems.length > 0) {
    addFailure(failures, "RESCAN_TIMING_INVALID", rescanTimingProblems);
  }
  const expectedRescanSourceSha256 = audit.project.fixturePreparation.preparedSourceSnapshotSha256;
  const mismatchedRescanInputs = rescans.flatMap((rescan) =>
    [
      ["prepared fixture", rescan.preparedSourceSnapshotSha256],
      ["source before", rescan.sourceBeforeSha256],
      ["source after", rescan.sourceAfterSha256],
    ]
      .filter(([, digest]) => digest !== expectedRescanSourceSha256)
      .map(
        ([location, digest]) =>
          `${rescan.id} ${location}: expected ${expectedRescanSourceSha256}, received ${digest}`,
      ),
  );
  const rescanInputsMatch =
    rescanCommandsSuccessful &&
    rescanExecutionContextsMatch &&
    rescanTimingValid &&
    mismatchedRescanInputs.length === 0;
  if (rescanCommandsSuccessful && mismatchedRescanInputs.length > 0) {
    addFailure(failures, "RESCAN_INPUT_MISMATCH", mismatchedRescanInputs);
  }
  const rescansEligibleForStability =
    initialSourceCaptureTimingValid && rescanInputsMatch && allCommandIsolationValid;
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
      .filter((claim) => assessedClaimHasValidStructuredEvidence(audit, claim))
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
    !sameSet(run.provenance.inScopeClaimIds, emittedClaimIds) ||
    !sameSet(run.provenance.claimIdsWithValidWitnesses, evidenceBackedClaimIds) ||
    !sameSet(evidenceBackedClaimIds, emittedClaimIds)
  ) {
    addFailure(
      failures,
      "PROVENANCE_INCOMPLETE",
      missingStructuredEvidence.length > 0
        ? missingStructuredEvidence.map((id) => `${id}: no valid structured witness evidence`)
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
  const comprehensionArtifactMatches =
    run.comprehension.evaluatedMainLayerArtifactSha256 ===
    run.presentation.frozenMainLayer.artifactSha256;
  if (!comprehensionArtifactMatches) {
    addFailure(failures, "COMPREHENSION_ARTIFACT_MISMATCH", [
      `evaluated ${run.comprehension.evaluatedMainLayerArtifactSha256}`,
      `frozen ${run.presentation.frozenMainLayer.artifactSha256}`,
    ]);
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
  const evidenceBackedClaimIdSet = new Set(evidenceBackedClaimIds);
  const declaredInScopeClaimIdSet = new Set(run.provenance.inScopeClaimIds);
  const declaredValidWitnessClaimIdSet = new Set(run.provenance.claimIdsWithValidWitnesses);
  const provenanceCovered = emittedClaimIds.filter(
    (id) =>
      evidenceBackedClaimIdSet.has(id) &&
      declaredInScopeClaimIdSet.has(id) &&
      declaredValidWitnessClaimIdSet.has(id),
  ).length;
  const answeredCorrectRequiredQuestions = requiredQuestionIds.filter(
    (id) =>
      run.comprehension.answeredQuestionIds.includes(id) &&
      run.comprehension.correctQuestionIds.includes(id),
  ).length;
  const dimensions = {
    falseClaims: Math.max(
      0,
      20 -
        (effectiveCriticalClaims.length + exactCriticalAssessedClaims.length) * 20 -
        effectiveNoncriticalFalseClaims.length * 2 -
        exactNoncriticalAssessedClaims.length * 2,
    ),
    firstMinute:
      initialCommandsSuccessful &&
      initialCommandIsolationValid &&
      initialCommandTimingValid &&
      initialCommandContextValid &&
      initialSourceCaptureTimingValid &&
      machineFreezeSignalValid &&
      firstMinuteMilliseconds >= 0 &&
      firstMinuteMilliseconds <= maximumFirstMinuteMilliseconds
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
    provenance: portion(provenanceCovered, emittedClaimIds.length, 10),
    repeatability: (rawStable ? 5 : 0) + (rawDigestStable ? 5 : 0),
    stableIdentityAndCanonicalBytes:
      (observationIdentityStable ? 5 : 0) +
      (canonicalIdentityStable ? 5 : 0) +
      (canonicalBytesStable ? 5 : 0),
    unaidedComprehension:
      comprehensionUnaided &&
      comprehensionArtifactMatches &&
      run.comprehension.criticalMisunderstandings.length === 0
        ? portion(answeredCorrectRequiredQuestions, requiredQuestionIds.length, 10)
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
