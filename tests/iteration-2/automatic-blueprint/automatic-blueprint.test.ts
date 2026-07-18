import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import {
  BenchmarkContractError,
  benchmarkSchemaVersion,
  createBenchmarkStringArrayDigest,
  parseBenchmarkAudit,
  parseBenchmarkRun,
  type BenchmarkAudit,
  type BenchmarkRun,
} from "./contract.ts";
import {
  benchmarkFailureCodes,
  benchmarkWorkflow,
  createPreRunPlanCommitment,
  scoreBenchmarkRun,
  type BenchmarkFailureCode,
} from "./scorer.ts";

const auditDirectory = new URL("./audits/", import.meta.url);
const digestA = "a".repeat(64);
const digestB = "b".repeat(64);

type Mutable<T> = {
  -readonly [Property in keyof T]: T[Property] extends readonly (infer Item)[]
    ? Mutable<Item>[]
    : T[Property] extends object
      ? Mutable<T[Property]>
      : T[Property];
};

async function loadAudit(name: string): Promise<BenchmarkAudit> {
  const text = await readFile(new URL(name, auditDirectory), "utf8");
  return parseBenchmarkAudit(JSON.parse(text));
}

function passingRun(audit: BenchmarkAudit): BenchmarkRun {
  const requiredFactIds = audit.facts
    .filter((fact) => fact.importance === "required")
    .map((fact) => fact.id);
  const supportingFactIds = audit.facts
    .filter((fact) => fact.importance === "supporting")
    .map((fact) => fact.id);
  const requiredQuestionIds = audit.comprehensionQuestions
    .filter((question) => question.required)
    .map((question) => question.id);
  const run: Mutable<BenchmarkRun> = {
    schemaVersion: benchmarkSchemaVersion,
    auditId: audit.auditId,
    claims: {
      assessedClaims: audit.facts.map((fact) => ({
        claimId: `claim:${fact.id}`,
        claim: fact.summary,
        evidence: [
          {
            detail: `raw evidence for ${fact.id}`,
            observationId: `observation:${fact.id}`,
            sourcePath: fact.evidence[0]!.path,
          },
        ],
        factIds: [fact.id],
      })),
      coveredRequiredFactIds: requiredFactIds,
      coveredSupportingFactIds: supportingFactIds,
      criticalFalseClaims: [],
      noncriticalFalseClaims: [],
    },
    comprehension: {
      answeredQuestionIds: requiredQuestionIds,
      correctQuestionIds: requiredQuestionIds,
      criticalMisunderstandings: [],
      evaluatorHadAgentAssistance: false,
      evaluatorHadPriorProjectKnowledge: false,
      materials: ["frozen-initial-main-layer"],
      startedAfterFreeze: true,
      usedOnlyFrozenInitialMainLayer: true,
    },
    execution: {
      aiOrHelperInferenceUsed: false,
      commands: benchmarkWorkflow.map((argv) => ({
        argv: [...argv],
        exitCode: 0,
        stderr: "",
        stdout: `${argv.join(" ")} raw output`,
      })),
      fixturePreparation: {
        completedAtMonotonicMilliseconds: 250,
        declaredPreexistingGromaOwnedPaths: [
          ...audit.project.fixturePreparation.preexistingGromaOwnedPaths,
        ],
        gromaOwnedStateAbsentBeforeInit: true,
        method: audit.project.fixturePreparation.method,
        preparedSourceSnapshotPathCount:
          audit.project.fixturePreparation.preparedSourceSnapshotPathCount,
        preparedSourceSnapshotSha256: audit.project.fixturePreparation.preparedSourceSnapshotSha256,
        removedPreexistingGromaOwnedPaths: [
          ...audit.project.fixturePreparation.preexistingGromaOwnedPaths,
        ],
      },
      gromaOwnedOutputPaths: [".groma/automatic-blueprint.html", "groma"],
      humanCorrectionBeforeFreeze: false,
      humanGroundTruthAuditCompletedBeforeRun: true,
      mainLayerFrozenAtMonotonicMilliseconds: 50_000,
      networkIsolation: {
        enforcedAtOsLevel: true,
        mechanism: "sandbox network namespace",
      },
      outputsFrozenBeforeHumanEvaluation: true,
      pathConvention: "posix",
      preRunPlan: {
        commitmentSha256: digestA,
        frozenAtMonotonicMilliseconds: 500,
        gromaOwnedOutputPaths: [".groma/automatic-blueprint.html", "groma"],
        pathConvention: "posix",
        preparedSourceSnapshotSha256: audit.project.fixturePreparation.preparedSourceSnapshotSha256,
        rendererDeclaredMainLayerBudget: { nodes: 40, relationships: 80 },
        sourceHashExcludedPaths: [".groma/automatic-blueprint.html", "groma"],
      },
      project: {
        repository: audit.project.repository,
        revision: audit.project.revision,
        tree: audit.project.tree,
      },
      scannerAndRulesFrozenBeforeHeldOutRun: true,
      sourceAfterSha256: audit.project.fixturePreparation.preparedSourceSnapshotSha256,
      sourceBeforeSha256: audit.project.fixturePreparation.preparedSourceSnapshotSha256,
      sourceHashExcludedPaths: [".groma/automatic-blueprint.html", "groma"],
      spawnedInitAtMonotonicMilliseconds: 1_000,
      stdinClosed: true,
      temporaryConfigRoot: "/tmp/groma-benchmark/config",
      temporaryHome: "/tmp/groma-benchmark/home",
    },
    presentation: {
      declaredMainLayerBudget: { nodes: 40, relationships: 80 },
      frozenMainLayer: {
        artifactSha256: digestA,
        machineObservableFreezeSignal: "main-layer:frozen",
        nodes: 30,
        relationships: 55,
      },
      uncertainty: {
        coverageGapCount: 2,
        nonColorCue: "text-and-shape",
        visible: true,
      },
    },
    provenance: {
      claimIdsWithValidWitnesses: audit.facts.map((fact) => `claim:${fact.id}`),
      inScopeClaimIds: audit.facts.map((fact) => `claim:${fact.id}`),
    },
    repeatability: {
      rescans: [1, 2].map((ordinal) => ({
        canonicalByteDigest: digestA,
        canonicalIdentityDigest: digestA,
        commands: benchmarkWorkflow.slice(1).map((argv) => ({
          argv: [...argv],
          exitCode: 0,
          stderr: "",
          stdout: `${argv.join(" ")} rescan ${ordinal} raw output`,
        })),
        id: `rescan-${ordinal}`,
        observationIdentityDigest: digestA,
        ordinal,
        preparedSourceSnapshotSha256: audit.project.fixturePreparation.preparedSourceSnapshotSha256,
        rawObservationDigest: digestA,
        rawObservationOrderingDigest: digestA,
      })),
    },
  };
  recommitPlan(run);
  return run;
}

function cloneRun(run: BenchmarkRun): Mutable<BenchmarkRun> {
  return structuredClone(run) as Mutable<BenchmarkRun>;
}

function recommitPlan(run: Mutable<BenchmarkRun>): void {
  run.execution.preRunPlan.commitmentSha256 = createPreRunPlanCommitment(run.execution.preRunPlan);
}

function recordFalseClaim(run: Mutable<BenchmarkRun>, claimId: string): void {
  run.provenance.inScopeClaimIds.push(claimId);
  run.provenance.claimIdsWithValidWitnesses.push(claimId);
}

describe("automatic-blueprint reference audits", () => {
  test("validate both immutable audit snapshots and reservation posture", async () => {
    const [groma, backlog] = await Promise.all([
      loadAudit("groma.json"),
      loadAudit("backlog-md-v1.48.0.json"),
    ]);

    expect(groma.project.revision).toBe("66fe7c616ccb06f8dbd52cafef006cc77f864217");
    expect(groma.project.tree).toBe("71323cd120c867b5c8ac9fffcc07cb9baf6079d4");
    expect(groma.project.fixturePreparation).toEqual({
      method: "remove-declared-groma-state-v1",
      preexistingGromaOwnedPaths: ["groma"],
      preparedSourceSnapshotPathCount: 203,
      preparedSourceSnapshotSha256:
        "606066e22b59427c0ecc63f3668d26bb47e623145c9e211266de712909478838",
    });
    expect(groma.project.sourceScopes).toEqual([
      {
        excluded: ["src/**/tests/**", "src/**/*.test.ts", "src/**/*.test.tsx"],
        id: "production",
        included: ["src/**/*.ts", "src/**/*.tsx"],
        pathCount: 61,
        pathInventorySha256: "03a89e1b3fc78e39c09c885490126521d9cbb15987a63e3742829eb3d92c004b",
        protectedRoots: ["src"],
      },
    ]);
    expect(groma.reservation.heldOut).toBeFalse();
    expect(backlog.project.revision).toBe("da0784d41ad3807fdc34e5501afe3fa950deff94");
    expect(backlog.project.tree).toBe("7ad9138045134a21426f72d26fa828b496e6443c");
    expect(backlog.project.packageMetadataVersion).toBe("1.47.1");
    expect(backlog.project.fixturePreparation).toEqual({
      method: "remove-declared-groma-state-v1",
      preexistingGromaOwnedPaths: [],
      preparedSourceSnapshotPathCount: 1053,
      preparedSourceSnapshotSha256:
        "90bfd9403212b68b47161a9bad874bf5ed78a5c9c00f0355392272c0308bc3b4",
    });
    expect(backlog.project.sourceScopes).toEqual([
      {
        excluded: ["src/test/**", "src/**/*.test.ts", "src/**/*.test.tsx"],
        id: "production",
        included: ["src/**/*.ts", "src/**/*.tsx"],
        pathCount: 176,
        pathInventorySha256: "914e0e13f1c40ff54b3ae8b31f4f110275175fbb38429e29bcf3dde17e8dfece",
        protectedRoots: ["src"],
      },
    ]);
    expect(backlog.reservation).toEqual({
      genericImprovementRequiresNonHeldOutEvidence: true,
      heldOut: true,
      projectSpecificExceptionsProhibited: true,
      publicReproducibleReferenceNotSecret: true,
      scannerFrozenBeforeHeldOutRun: true,
      scoredResultsMayTuneScanner: false,
    });
    for (const audit of [groma, backlog]) {
      for (const fact of audit.facts.filter(
        ({ claim }) => claim.kind === "absence" || claim.predicate === "contains-exactly",
      )) {
        expect(fact.derivation?.resultSha256).toBe(
          createBenchmarkStringArrayDigest(fact.claim.objects),
        );
      }
    }
  });

  test("rejects scanner or canonical identities as audit fact ids", async () => {
    const audit = structuredClone(await loadAudit("groma.json")) as unknown as Record<
      string,
      unknown
    >;
    const facts = audit.facts as Record<string, unknown>[];
    facts[0]!.id = "obs_automatic_1";

    expect(() => parseBenchmarkAudit(audit)).toThrow(BenchmarkContractError);
  });

  test("requires bounded immutable provenance witnesses", async () => {
    const audit = structuredClone(await loadAudit("groma.json")) as unknown as Record<
      string,
      unknown
    >;
    const facts = audit.facts as Record<string, unknown>[];
    const evidence = facts[0]!.evidence as Record<string, unknown>[];
    evidence[0]!.contentSha256 = "current-file";

    expect(() => parseBenchmarkAudit(audit)).toThrow(
      "INVALID_AUDIT: audit.groma.bun-routes.absent.evidence[0].contentSha256 must be a lowercase SHA-256 digest",
    );
  });

  test("rejects witness paths outside the strict portable workspace namespace", async () => {
    const source = await loadAudit("groma.json");
    for (const invalidPath of [
      "C:/outside.ts",
      "src\\outside.ts",
      "/outside.ts",
      "../outside.ts",
      ".",
      "src/*.ts",
      "src/",
      "src/file.",
      "src/file ",
      "NUL/evidence.ts",
    ]) {
      const audit = structuredClone(source) as Mutable<BenchmarkAudit>;
      audit.facts[0]!.evidence[0]!.path = invalidPath;

      expect(() => parseBenchmarkAudit(audit), invalidPath).toThrow(
        "must be a strict portable workspace descendant",
      );
    }
  });

  test("rejects fixture cleanup that can delete a protected root or audited witness", async () => {
    const source = await loadAudit("groma.json");
    for (const unsafePath of [
      "SRC",
      "package.json",
      "scripts",
      "package.json/generated",
    ] as const) {
      const audit = structuredClone(source) as Mutable<BenchmarkAudit>;
      audit.project.fixturePreparation.preexistingGromaOwnedPaths = [unsafePath];

      expect(() => parseBenchmarkAudit(audit), unsafePath).toThrow(
        "INVALID_AUDIT: audit fixture preparation overlaps audited input",
      );
    }
  });

  test("binds exact-set and absence derivations to a declared source scope", async () => {
    const audit = structuredClone(await loadAudit("groma.json")) as Mutable<BenchmarkAudit>;
    const derivation = audit.facts[0]!.derivation as {
      resultSha256: string;
      sourceScopeId: string;
    };
    const validResultSha256 = derivation.resultSha256;
    derivation.resultSha256 = digestB;

    expect(() => parseBenchmarkAudit(audit)).toThrow(
      "INVALID_AUDIT: audit.groma.bun-routes.absent derivation digest does not bind claim objects",
    );

    derivation.resultSha256 = validResultSha256;
    derivation.sourceScopeId = "unknown-scope";
    expect(() => parseBenchmarkAudit(audit)).toThrow(BenchmarkContractError);
  });

  test("rejects a held-out audit that can tune the scanner", async () => {
    const audit = structuredClone(await loadAudit("backlog-md-v1.48.0.json")) as unknown as Record<
      string,
      unknown
    >;
    const reservation = audit.reservation as Record<string, unknown>;
    reservation.scoredResultsMayTuneScanner = true;

    expect(() => parseBenchmarkAudit(audit)).toThrow(
      "INVALID_AUDIT: held-out audit reservation is not fail-closed",
    );
  });
});

describe("automatic-blueprint conjunctive scorecard", () => {
  test("passes a complete run with a diagnostic score of 100", async () => {
    const audit = await loadAudit("backlog-md-v1.48.0.json");
    const run = parseBenchmarkRun(passingRun(audit));

    expect(scoreBenchmarkRun(audit, run)).toEqual({
      dimensions: {
        falseClaims: 20,
        firstMinute: 10,
        observableFactCoverage: 20,
        presentationIntegrity: 5,
        provenance: 10,
        repeatability: 10,
        stableIdentityAndCanonicalBytes: 15,
        unaidedComprehension: 10,
      },
      failures: [],
      passed: true,
      total: 100,
    });
  });

  test("binds the run to the audit repository, revision, and tree independently", async () => {
    const audit = await loadAudit("groma.json");
    const cases = [
      ["repository", "https://example.com/wrong"],
      ["revision", "c".repeat(40)],
      ["tree", "d".repeat(40)],
    ] as const;

    for (const [field, value] of cases) {
      const run = cloneRun(passingRun(audit));
      run.execution.project[field] = value;

      expect(
        scoreBenchmarkRun(audit, parseBenchmarkRun(run)).failures.map(({ code }) => code),
        field,
      ).toEqual(["AUDIT_PROJECT_MISMATCH"]);
    }
  });

  test("requires declared fixture cleanup before planning and the timed workflow", async () => {
    const audit = await loadAudit("groma.json");
    const priorState = cloneRun(passingRun(audit));
    priorState.execution.fixturePreparation.gromaOwnedStateAbsentBeforeInit = false;
    expect(
      scoreBenchmarkRun(audit, parseBenchmarkRun(priorState)).failures.map(({ code }) => code),
    ).toEqual(["FIXTURE_PREPARATION_INVALID"]);

    const unrecordedCleanup = cloneRun(passingRun(audit));
    unrecordedCleanup.execution.fixturePreparation.removedPreexistingGromaOwnedPaths = [];
    expect(
      scoreBenchmarkRun(audit, parseBenchmarkRun(unrecordedCleanup)).failures.map(
        ({ code }) => code,
      ),
    ).toEqual(["FIXTURE_PREPARATION_INVALID"]);

    const latePreparation = cloneRun(passingRun(audit));
    latePreparation.execution.fixturePreparation.completedAtMonotonicMilliseconds =
      latePreparation.execution.preRunPlan.frozenAtMonotonicMilliseconds + 1;
    expect(
      scoreBenchmarkRun(audit, parseBenchmarkRun(latePreparation)).failures.map(({ code }) => code),
    ).toEqual(["FIXTURE_PREPARATION_INVALID"]);
  });

  test("defensively rejects a run whose declared cleanup overlaps audited input", async () => {
    const source = await loadAudit("groma.json");
    for (const unsafePath of [
      "SRC",
      "package.json",
      "scripts",
      "package.json/generated",
    ] as const) {
      const audit = structuredClone(source) as Mutable<BenchmarkAudit>;
      audit.project.fixturePreparation.preexistingGromaOwnedPaths = [unsafePath];
      const run = parseBenchmarkRun(passingRun(audit));

      expect(
        scoreBenchmarkRun(audit, run).failures.map(({ code }) => code),
        unsafePath,
      ).toEqual(["FIXTURE_PREPARATION_INVALID"]);
    }
  });

  test("accepts isolated Win32 benchmark roots when the convention is explicit", async () => {
    const audit = await loadAudit("groma.json");
    const run = cloneRun(passingRun(audit));
    run.execution.pathConvention = "win32";
    run.execution.temporaryHome = "C:\\groma-benchmark\\home";
    run.execution.temporaryConfigRoot = "C:\\groma-benchmark\\config";
    run.execution.preRunPlan.pathConvention = "win32";
    recommitPlan(run);

    expect(scoreBenchmarkRun(audit, parseBenchmarkRun(run)).passed).toBeTrue();
  });

  test("rejects Win32 dot, space, and trailing-separator temporary-root aliases", async () => {
    const audit = await loadAudit("groma.json");
    for (const temporaryHome of ["C:\\groma-benchmark\\home.", "C:\\groma-benchmark\\home "]) {
      const run = cloneRun(passingRun(audit));
      run.execution.pathConvention = "win32";
      run.execution.temporaryHome = temporaryHome;
      run.execution.temporaryConfigRoot = "C:\\groma-benchmark\\config";
      run.execution.preRunPlan.pathConvention = "win32";
      recommitPlan(run);

      expect(
        scoreBenchmarkRun(audit, parseBenchmarkRun(run)).failures.map(({ code }) => code),
        temporaryHome,
      ).toEqual(["TEMPORARY_ENVIRONMENT_NOT_ISOLATED"]);
    }

    const trailingAlias = cloneRun(passingRun(audit));
    trailingAlias.execution.pathConvention = "win32";
    trailingAlias.execution.temporaryHome = "C:\\groma-benchmark\\home\\";
    trailingAlias.execution.temporaryConfigRoot = "c:\\groma-benchmark\\home";
    trailingAlias.execution.preRunPlan.pathConvention = "win32";
    recommitPlan(trailingAlias);
    expect(
      scoreBenchmarkRun(audit, parseBenchmarkRun(trailingAlias)).failures.map(({ code }) => code),
    ).toEqual(["TEMPORARY_ENVIRONMENT_NOT_ISOLATED"]);

    const validTrailingRoot = cloneRun(passingRun(audit));
    validTrailingRoot.execution.pathConvention = "win32";
    validTrailingRoot.execution.temporaryHome = "C:\\groma-benchmark\\home\\";
    validTrailingRoot.execution.temporaryConfigRoot = "C:\\groma-benchmark\\config";
    validTrailingRoot.execution.preRunPlan.pathConvention = "win32";
    recommitPlan(validTrailingRoot);
    expect(scoreBenchmarkRun(audit, parseBenchmarkRun(validTrailingRoot)).passed).toBeTrue();
  });

  test("reports nonempty workflow evidence when no commands were recorded", async () => {
    const audit = await loadAudit("groma.json");
    const run = cloneRun(passingRun(audit));
    run.execution.commands = [];

    expect(scoreBenchmarkRun(audit, parseBenchmarkRun(run)).failures).toEqual([
      { code: "WORKFLOW_MISMATCH", evidence: ["no commands recorded"] },
    ]);
  });

  test("retains noncritical false-claim evidence without turning points into a compensating gate", async () => {
    const audit = await loadAudit("groma.json");
    const run = cloneRun(passingRun(audit));
    run.claims.noncriticalFalseClaims.push({
      claimId: "claim:minor",
      claim: "An optional label was misstated",
      evidence: [
        {
          detail: "raw label differed",
          observationId: "observed-label",
          sourcePath: audit.facts[0]!.evidence[0]!.path,
        },
      ],
      forbiddenClaimIds: [],
    });
    recordFalseClaim(run, "claim:minor");

    const result = scoreBenchmarkRun(audit, parseBenchmarkRun(run));
    expect(result.passed).toBeTrue();
    expect(result.dimensions.falseClaims).toBe(18);
    expect(result.total).toBe(98);
  });

  test("promotes a misbucketed false claim to the audit's effective critical severity", async () => {
    const audit = await loadAudit("backlog-md-v1.48.0.json");
    const run = cloneRun(passingRun(audit));
    run.claims.noncriticalFalseClaims.push({
      claimId: "claim:misbucketed",
      claim: "Backlog contains built-in AI inference",
      evidence: [
        {
          detail: "the scanner invented an AI runtime",
          observationId: "observation:misbucketed",
          sourcePath: audit.facts[0]!.evidence[0]!.path,
        },
      ],
      forbiddenClaimIds: ["forbidden.backlog.ai-runtime"],
    });
    recordFalseClaim(run, "claim:misbucketed");

    const result = scoreBenchmarkRun(audit, parseBenchmarkRun(run));
    expect(result.passed).toBeFalse();
    expect(result.dimensions.falseClaims).toBe(0);
    expect(result.failures.map((failure) => failure.code)).toEqual(["CRITICAL_FALSE_CLAIM"]);
  });

  test("inherits exact predeclared critical severity when its forbidden link is omitted", async () => {
    const audit = await loadAudit("backlog-md-v1.48.0.json");
    const run = cloneRun(passingRun(audit));
    const forbidden = audit.forbiddenClaims.find(
      ({ id }) => id === "forbidden.backlog.ai-runtime",
    )!;
    run.claims.noncriticalFalseClaims.push({
      claimId: "claim:unlinked-critical",
      claim: forbidden.claim,
      evidence: [
        {
          detail: "the scanner emitted the exact predeclared false claim",
          observationId: "observation:unlinked-critical",
          sourcePath: forbidden.evidence[0]!.path,
        },
      ],
      forbiddenClaimIds: [],
    });
    recordFalseClaim(run, "claim:unlinked-critical");

    const result = scoreBenchmarkRun(audit, parseBenchmarkRun(run));
    expect(result.passed).toBeFalse();
    expect(result.dimensions.falseClaims).toBe(0);
    expect(result.failures.map((failure) => failure.code)).toEqual(["CRITICAL_FALSE_CLAIM"]);
  });

  test("hard-fails exact critical forbidden text emitted as a successful assessed claim", async () => {
    const audit = await loadAudit("backlog-md-v1.48.0.json");
    const run = cloneRun(passingRun(audit));
    const forbidden = audit.forbiddenClaims.find(
      ({ id }) => id === "forbidden.backlog.ai-runtime",
    )!;
    run.claims.assessedClaims[0]!.claim = forbidden.claim;

    const result = scoreBenchmarkRun(audit, parseBenchmarkRun(run));
    expect(result.passed).toBeFalse();
    expect(result.dimensions.falseClaims).toBe(0);
    expect(result.failures).toEqual([
      {
        code: "CRITICAL_FALSE_CLAIM",
        evidence: expect.arrayContaining([
          `matched forbidden text ${forbidden.id}`,
          run.claims.assessedClaims[0]!.evidence[0]!.detail,
          `observation ${run.claims.assessedClaims[0]!.evidence[0]!.observationId}`,
          `source ${run.claims.assessedClaims[0]!.evidence[0]!.sourcePath}`,
        ]),
      },
    ]);
  });

  test("deducts exact noncritical forbidden text emitted as an assessed claim once", async () => {
    const candidate = structuredClone(await loadAudit("groma.json")) as Mutable<BenchmarkAudit>;
    candidate.forbiddenClaims[0]!.severity = "noncritical";
    const audit = parseBenchmarkAudit(candidate);
    const run = cloneRun(passingRun(audit));
    run.claims.assessedClaims[0]!.claim = audit.forbiddenClaims[0]!.claim;

    const result = scoreBenchmarkRun(audit, parseBenchmarkRun(run));
    expect(result.passed).toBeTrue();
    expect(result.failures).toEqual([]);
    expect(result.dimensions.falseClaims).toBe(18);
    expect(result.total).toBe(98);
  });

  test("refuses a successful assessed claim without its raw scanner evidence", async () => {
    const audit = await loadAudit("groma.json");
    const run = cloneRun(passingRun(audit));
    run.claims.assessedClaims[0]!.evidence = [];

    expect(() => parseBenchmarkRun(run)).toThrow(
      "INVALID_RUN: assessed claims must retain raw evidence",
    );
  });

  test("rejects non-portable source paths in assessed and false-claim evidence", async () => {
    const audit = await loadAudit("groma.json");
    for (const invalidPath of [
      "/outside.ts",
      "C:/outside.ts",
      "src\\outside.ts",
      "../outside.ts",
    ]) {
      const assessed = cloneRun(passingRun(audit));
      assessed.claims.assessedClaims[0]!.evidence[0]!.sourcePath = invalidPath;
      expect(() => parseBenchmarkRun(assessed), `assessed:${invalidPath}`).toThrow(
        "must be a strict portable workspace descendant",
      );

      const falseClaim = cloneRun(passingRun(audit));
      falseClaim.claims.noncriticalFalseClaims.push({
        claimId: "claim:invalid-source-path",
        claim: "Unstructured scanner claim",
        evidence: [
          {
            detail: "raw evidence",
            observationId: "observation:invalid-source-path",
            sourcePath: invalidPath,
          },
        ],
        forbiddenClaimIds: [],
      });
      recordFalseClaim(falseClaim, "claim:invalid-source-path");
      expect(() => parseBenchmarkRun(falseClaim), `false:${invalidPath}`).toThrow(
        "must be a strict portable workspace descendant",
      );
    }
  });

  test("does not award self-attested false-claim provenance without structured evidence", async () => {
    const audit = await loadAudit("groma.json");
    const run = cloneRun(passingRun(audit));
    run.claims.noncriticalFalseClaims.push({
      claimId: "claim:self-attested",
      claim: "A claim with only an assessor detail",
      evidence: [{ detail: "no observation or source witness was retained" }],
      forbiddenClaimIds: [],
    });
    recordFalseClaim(run, "claim:self-attested");

    const result = scoreBenchmarkRun(audit, parseBenchmarkRun(run));
    expect(result.failures).toEqual([
      {
        code: "PROVENANCE_INCOMPLETE",
        evidence: ["claim:self-attested: no structured witness evidence"],
      },
    ]);
    expect(result.dimensions.provenance).toBeLessThan(10);
  });

  test("requires emitted assessed and false claim IDs to be globally unique", async () => {
    const audit = await loadAudit("groma.json");
    const run = cloneRun(passingRun(audit));
    run.claims.noncriticalFalseClaims.push({
      claimId: run.claims.assessedClaims[0]!.claimId,
      claim: "Duplicate inventory entry",
      evidence: [{ detail: "same identifier was emitted twice" }],
      forbiddenClaimIds: [],
    });

    expect(() => parseBenchmarkRun(run)).toThrow(
      "INVALID_RUN: run emitted claim ids must not contain duplicates",
    );
  });

  test("rejects non-portable or non-descendant output paths", async () => {
    const audit = await loadAudit("groma.json");
    for (const invalidPath of [
      ".",
      "..",
      "/tmp/output",
      "C:/output",
      "a\\b",
      "*.json",
      "NUL/output",
      "CONOUT$.txt",
      "output. ",
      `bad${String.fromCharCode(0xd800)}`,
    ]) {
      const run = cloneRun(passingRun(audit));
      run.execution.gromaOwnedOutputPaths = [invalidPath];
      run.execution.sourceHashExcludedPaths = [invalidPath];
      run.execution.preRunPlan.gromaOwnedOutputPaths = [invalidPath];
      run.execution.preRunPlan.sourceHashExcludedPaths = [invalidPath];
      recommitPlan(run);

      expect(
        scoreBenchmarkRun(audit, parseBenchmarkRun(run)).failures.map((failure) => failure.code),
        invalidPath,
      ).toEqual(["SOURCE_OUTPUT_PATH_INVALID"]);
    }
  });

  test("treats case-equivalent Win32 temporary roots as the same root", async () => {
    const audit = await loadAudit("groma.json");
    const run = cloneRun(passingRun(audit));
    run.execution.pathConvention = "win32";
    run.execution.temporaryHome = "C:\\Groma-Benchmark\\Root";
    run.execution.temporaryConfigRoot = "c:\\groma-benchmark\\root";
    run.execution.preRunPlan.pathConvention = "win32";
    recommitPlan(run);

    expect(
      scoreBenchmarkRun(audit, parseBenchmarkRun(run)).failures.map(({ code }) => code),
    ).toEqual(["TEMPORARY_ENVIRONMENT_NOT_ISOLATED"]);
  });

  test("rejects nested temporary roots under POSIX and Win32 conventions", async () => {
    const audit = await loadAudit("groma.json");
    const posix = cloneRun(passingRun(audit));
    posix.execution.temporaryHome = "/tmp/groma-benchmark/";
    posix.execution.temporaryConfigRoot = "/tmp/groma-benchmark/config";

    expect(
      scoreBenchmarkRun(audit, parseBenchmarkRun(posix)).failures.map(({ code }) => code),
    ).toEqual(["TEMPORARY_ENVIRONMENT_NOT_ISOLATED"]);

    const win32 = cloneRun(passingRun(audit));
    win32.execution.pathConvention = "win32";
    win32.execution.temporaryHome = "C:\\Groma-Benchmark";
    win32.execution.temporaryConfigRoot = "c:\\groma-benchmark\\config";
    win32.execution.preRunPlan.pathConvention = "win32";
    recommitPlan(win32);

    expect(
      scoreBenchmarkRun(audit, parseBenchmarkRun(win32)).failures.map(({ code }) => code),
    ).toEqual(["TEMPORARY_ENVIRONMENT_NOT_ISOLATED"]);
  });

  test("protects source roots from case-aliasing Win32 output exclusions", async () => {
    const audit = await loadAudit("backlog-md-v1.48.0.json");
    const run = cloneRun(passingRun(audit));
    run.execution.pathConvention = "win32";
    run.execution.temporaryHome = "C:\\groma-benchmark\\home";
    run.execution.temporaryConfigRoot = "C:\\groma-benchmark\\config";
    run.execution.gromaOwnedOutputPaths = ["SRC"];
    run.execution.sourceHashExcludedPaths = ["SRC"];
    run.execution.preRunPlan.pathConvention = "win32";
    run.execution.preRunPlan.gromaOwnedOutputPaths = ["SRC"];
    run.execution.preRunPlan.sourceHashExcludedPaths = ["SRC"];
    recommitPlan(run);

    expect(
      scoreBenchmarkRun(audit, parseBenchmarkRun(run)).failures.map(({ code }) => code),
    ).toEqual(["SOURCE_OUTPUT_OVERLAPS_PROTECTED_SOURCE"]);
  });

  test("protects every audited witness input and its path aliases from output exclusion", async () => {
    const [groma, backlog] = await Promise.all([
      loadAudit("groma.json"),
      loadAudit("backlog-md-v1.48.0.json"),
    ]);
    for (const [audit, pathConvention, outputPath] of [
      [groma, "posix", "package.json"],
      [backlog, "posix", "README.md/generated"],
      [groma, "posix", "scripts"],
      [groma, "win32", "PACKAGE.JSON"],
      [backlog, "win32", "readme.md/generated"],
      [groma, "win32", "SCRIPTS"],
    ] as const) {
      const run = cloneRun(passingRun(audit));
      run.execution.pathConvention = pathConvention;
      run.execution.gromaOwnedOutputPaths = [outputPath];
      run.execution.sourceHashExcludedPaths = [outputPath];
      run.execution.preRunPlan.pathConvention = pathConvention;
      run.execution.preRunPlan.gromaOwnedOutputPaths = [outputPath];
      run.execution.preRunPlan.sourceHashExcludedPaths = [outputPath];
      if (pathConvention === "win32") {
        run.execution.temporaryHome = "C:\\groma-benchmark\\home";
        run.execution.temporaryConfigRoot = "C:\\groma-benchmark\\config";
      }
      recommitPlan(run);

      expect(
        scoreBenchmarkRun(audit, parseBenchmarkRun(run)).failures.map(({ code }) => code),
        `${pathConvention}:${outputPath}`,
      ).toEqual(["SOURCE_OUTPUT_OVERLAPS_PROTECTED_SOURCE"]);
    }
  });

  test("requires attached successful rescans before awarding repeatability or identity", async () => {
    const audit = await loadAudit("groma.json");
    const run = cloneRun(passingRun(audit));
    run.repeatability.rescans = [];
    const legacy = run.repeatability as unknown as Record<string, unknown>;
    legacy.rawObservationDigests = [digestA, digestA];
    legacy.rawObservationOrderingDigests = [digestA, digestA];
    legacy.observationIdentityDigests = [digestA, digestA];
    legacy.canonicalIdentityDigests = [digestA, digestA];
    legacy.canonicalByteDigests = [digestA, digestA];

    const result = scoreBenchmarkRun(audit, parseBenchmarkRun(run));
    expect(result.failures.map(({ code }) => code)).toEqual(["RESCAN_RECORDS_INCOMPLETE"]);
    expect(result.dimensions.repeatability).toBe(0);
    expect(result.dimensions.stableIdentityAndCanonicalBytes).toBe(0);
  });

  test("requires unique rescan IDs in consecutive recorded order", async () => {
    const audit = await loadAudit("groma.json");
    for (const mutate of [
      (run: Mutable<BenchmarkRun>) =>
        void (run.repeatability.rescans[1]!.id = run.repeatability.rescans[0]!.id),
      (run: Mutable<BenchmarkRun>) => void (run.repeatability.rescans[1]!.ordinal = 3),
    ]) {
      const run = cloneRun(passingRun(audit));
      mutate(run);
      const result = scoreBenchmarkRun(audit, parseBenchmarkRun(run));
      expect(result.failures.map(({ code }) => code)).toEqual(["RESCAN_RECORDS_INCOMPLETE"]);
      expect(result.dimensions.repeatability).toBe(0);
      expect(result.dimensions.stableIdentityAndCanonicalBytes).toBe(0);
    }
  });

  test("does not award rescan gates for missing commands, failures, or wrong inputs", async () => {
    const audit = await loadAudit("groma.json");
    const cases: readonly [BenchmarkFailureCode, (run: Mutable<BenchmarkRun>) => void][] = [
      ["RESCAN_WORKFLOW_MISMATCH", (run) => void (run.repeatability.rescans[0]!.commands = [])],
      [
        "RESCAN_COMMAND_FAILED",
        (run) => void (run.repeatability.rescans[0]!.commands[0]!.exitCode = 7),
      ],
      [
        "RESCAN_INPUT_MISMATCH",
        (run) => void (run.repeatability.rescans[0]!.preparedSourceSnapshotSha256 = digestB),
      ],
    ];
    for (const [code, mutate] of cases) {
      const run = cloneRun(passingRun(audit));
      mutate(run);
      const result = scoreBenchmarkRun(audit, parseBenchmarkRun(run));
      expect(
        result.failures.map((failure) => failure.code),
        code,
      ).toEqual([code]);
      expect(result.dimensions.repeatability, code).toBe(0);
      expect(result.dimensions.stableIdentityAndCanonicalBytes, code).toBe(0);
    }
  });

  test("breaks every pass gate independently and emits one stable failure code", async () => {
    const audit = await loadAudit("backlog-md-v1.48.0.json");
    const cases: readonly {
      readonly code: BenchmarkFailureCode;
      readonly mutate: (run: Mutable<BenchmarkRun>) => void;
    }[] = [
      { code: "AUDIT_MISMATCH", mutate: (run) => void (run.auditId = "another-audit") },
      {
        code: "AUDIT_PROJECT_MISMATCH",
        mutate: (run) => void (run.execution.project.repository = "https://example.com/wrong"),
      },
      {
        code: "FIXTURE_PREPARATION_INVALID",
        mutate: (run) =>
          void (run.execution.fixturePreparation.gromaOwnedStateAbsentBeforeInit = false),
      },
      {
        code: "FIXTURE_SNAPSHOT_MISMATCH",
        mutate: (run) => {
          run.execution.fixturePreparation.preparedSourceSnapshotSha256 = digestB;
          run.execution.preRunPlan.preparedSourceSnapshotSha256 = digestB;
          run.execution.sourceBeforeSha256 = digestB;
          run.execution.sourceAfterSha256 = digestB;
          recommitPlan(run);
        },
      },
      {
        code: "WORKFLOW_MISMATCH",
        mutate: (run) => void (run.execution.commands[1]!.argv = ["groma", "inspect"]),
      },
      { code: "COMMAND_FAILED", mutate: (run) => void (run.execution.commands[1]!.exitCode = 1) },
      {
        code: "NETWORK_ISOLATION_NOT_ENFORCED",
        mutate: (run) => void (run.execution.networkIsolation.enforcedAtOsLevel = false),
      },
      { code: "STDIN_NOT_CLOSED", mutate: (run) => void (run.execution.stdinClosed = false) },
      {
        code: "TEMPORARY_ENVIRONMENT_NOT_ISOLATED",
        mutate: (run) => void (run.execution.temporaryHome = "tmp/home"),
      },
      {
        code: "SOURCE_OUTPUT_PATH_INVALID",
        mutate: (run) => {
          run.execution.gromaOwnedOutputPaths = ["."];
          run.execution.sourceHashExcludedPaths = ["."];
          run.execution.preRunPlan.gromaOwnedOutputPaths = ["."];
          run.execution.preRunPlan.sourceHashExcludedPaths = ["."];
          recommitPlan(run);
        },
      },
      {
        code: "SOURCE_OUTPUT_OVERLAPS_PROTECTED_SOURCE",
        mutate: (run) => {
          run.execution.gromaOwnedOutputPaths = ["src"];
          run.execution.sourceHashExcludedPaths = ["src"];
          run.execution.preRunPlan.gromaOwnedOutputPaths = ["src"];
          run.execution.preRunPlan.sourceHashExcludedPaths = ["src"];
          recommitPlan(run);
        },
      },
      {
        code: "SOURCE_HASH_EXCLUSIONS_MISMATCH",
        mutate: (run) => {
          run.execution.sourceHashExcludedPaths.pop();
          run.execution.preRunPlan.sourceHashExcludedPaths.pop();
          recommitPlan(run);
        },
      },
      {
        code: "PRE_RUN_PLAN_DIGEST_MISMATCH",
        mutate: (run) => void (run.execution.preRunPlan.commitmentSha256 = digestB),
      },
      {
        code: "PRE_RUN_PLAN_NOT_FROZEN",
        mutate: (run) =>
          void (run.execution.preRunPlan.frozenAtMonotonicMilliseconds =
            run.execution.spawnedInitAtMonotonicMilliseconds + 1),
      },
      {
        code: "PRE_RUN_PLAN_MISMATCH",
        mutate: (run) => {
          run.execution.preRunPlan.rendererDeclaredMainLayerBudget.nodes += 1;
          recommitPlan(run);
        },
      },
      {
        code: "SOURCE_MUTATED",
        mutate: (run) => void (run.execution.sourceAfterSha256 = digestB),
      },
      {
        code: "AI_OR_HELPER_INFERENCE_USED",
        mutate: (run) => void (run.execution.aiOrHelperInferenceUsed = true),
      },
      {
        code: "HUMAN_CORRECTION_BEFORE_FREEZE",
        mutate: (run) => void (run.execution.humanCorrectionBeforeFreeze = true),
      },
      {
        code: "GROUND_TRUTH_AUDIT_NOT_PRECOMMITTED",
        mutate: (run) => void (run.execution.humanGroundTruthAuditCompletedBeforeRun = false),
      },
      {
        code: "HELD_OUT_SCANNER_NOT_FROZEN",
        mutate: (run) => void (run.execution.scannerAndRulesFrozenBeforeHeldOutRun = false),
      },
      {
        code: "OUTPUT_NOT_FROZEN_BEFORE_EVALUATION",
        mutate: (run) => void (run.execution.outputsFrozenBeforeHumanEvaluation = false),
      },
      {
        code: "MAIN_LAYER_NOT_MACHINE_FROZEN",
        mutate: (run) =>
          void (run.presentation.frozenMainLayer.machineObservableFreezeSignal = "  "),
      },
      {
        code: "FIRST_MINUTE_EXCEEDED",
        mutate: (run) =>
          void (run.execution.mainLayerFrozenAtMonotonicMilliseconds =
            run.execution.spawnedInitAtMonotonicMilliseconds + 60_001),
      },
      {
        code: "FALSE_CLAIM_FORBIDDEN_LINK_INVALID",
        mutate: (run) => {
          run.claims.noncriticalFalseClaims.push({
            claimId: "claim:bad-link",
            claim: "False claim with an unrecognized audit classification",
            evidence: [
              {
                detail: "raw evidence",
                observationId: "observation:bad-link",
                sourcePath: audit.facts[0]!.evidence[0]!.path,
              },
            ],
            forbiddenClaimIds: ["forbidden.backlog.unknown"],
          });
          recordFalseClaim(run, "claim:bad-link");
        },
      },
      {
        code: "CRITICAL_FALSE_CLAIM",
        mutate: (run) => {
          run.claims.criticalFalseClaims.push({
            claimId: "claim:false",
            claim: "Backlog is a hosted database service",
            evidence: [
              {
                detail: "scanner emitted invented prose",
                observationId: "observation:false",
                sourcePath: "src/index.ts",
              },
            ],
            forbiddenClaimIds: ["forbidden.backlog.hosted-database"],
          });
          recordFalseClaim(run, "claim:false");
        },
      },
      {
        code: "REQUIRED_FACT_COVERAGE_INCOMPLETE",
        mutate: (run) => void run.claims.coveredRequiredFactIds.pop(),
      },
      {
        code: "RESCAN_RECORDS_INCOMPLETE",
        mutate: (run) => void (run.repeatability.rescans = []),
      },
      {
        code: "RESCAN_WORKFLOW_MISMATCH",
        mutate: (run) =>
          void (run.repeatability.rescans[1]!.commands[0]!.argv = ["groma", "inspect"]),
      },
      {
        code: "RESCAN_COMMAND_FAILED",
        mutate: (run) => void (run.repeatability.rescans[1]!.commands[0]!.exitCode = 1),
      },
      {
        code: "RESCAN_INPUT_MISMATCH",
        mutate: (run) =>
          void (run.repeatability.rescans[1]!.preparedSourceSnapshotSha256 = digestB),
      },
      {
        code: "RAW_OBSERVATION_ORDER_CHANGED",
        mutate: (run) =>
          void (run.repeatability.rescans[1]!.rawObservationOrderingDigest = digestB),
      },
      {
        code: "RAW_OBSERVATION_DIGEST_CHANGED",
        mutate: (run) => void (run.repeatability.rescans[1]!.rawObservationDigest = digestB),
      },
      {
        code: "OBSERVATION_IDENTITY_CHANGED",
        mutate: (run) => void (run.repeatability.rescans[1]!.observationIdentityDigest = digestB),
      },
      {
        code: "CANONICAL_IDENTITY_CHANGED",
        mutate: (run) => void (run.repeatability.rescans[1]!.canonicalIdentityDigest = digestB),
      },
      {
        code: "CANONICAL_BYTES_CHANGED",
        mutate: (run) => void (run.repeatability.rescans[1]!.canonicalByteDigest = digestB),
      },
      {
        code: "PROVENANCE_INCOMPLETE",
        mutate: (run) => void run.provenance.claimIdsWithValidWitnesses.pop(),
      },
      {
        code: "MAIN_LAYER_BUDGET_UNDECLARED",
        mutate: (run) => {
          run.presentation.declaredMainLayerBudget.nodes = 0;
          run.execution.preRunPlan.rendererDeclaredMainLayerBudget.nodes = 0;
          recommitPlan(run);
        },
      },
      {
        code: "MAIN_LAYER_BUDGET_EXCEEDED",
        mutate: (run) =>
          void (run.presentation.frozenMainLayer.nodes =
            run.presentation.declaredMainLayerBudget.nodes + 1),
      },
      {
        code: "UNCERTAINTY_NOT_VISIBLE",
        mutate: (run) => void (run.presentation.uncertainty.visible = false),
      },
      {
        code: "UNCERTAINTY_COLOR_ONLY",
        mutate: (run) => void (run.presentation.uncertainty.nonColorCue = "none"),
      },
      {
        code: "COMPREHENSION_NOT_UNAIDED",
        mutate: (run) => void (run.comprehension.evaluatorHadAgentAssistance = true),
      },
      {
        code: "COMPREHENSION_INCOMPLETE",
        mutate: (run) => void run.comprehension.correctQuestionIds.pop(),
      },
      {
        code: "COMPREHENSION_CRITICAL_MISUNDERSTANDING",
        mutate: (run) =>
          void run.comprehension.criticalMisunderstandings.push("Mistook CLI for a cloud service"),
      },
    ];

    expect(cases.map(({ code }) => code)).toEqual([...benchmarkFailureCodes]);
    for (const gate of cases) {
      const run = cloneRun(passingRun(audit));
      gate.mutate(run);
      const result = scoreBenchmarkRun(audit, parseBenchmarkRun(run));
      expect(result.passed, gate.code).toBeFalse();
      expect(
        result.failures.map((failure) => failure.code),
        gate.code,
      ).toEqual([gate.code]);
      expect(result.failures[0]!.evidence.length, gate.code).toBeGreaterThan(0);
    }
  });
});
