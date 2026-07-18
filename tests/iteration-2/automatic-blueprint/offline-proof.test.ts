import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import {
  createBenchmarkStringArrayDigest,
  parseBenchmarkAudit,
  sourceScopePatternMatches,
  type BenchmarkAudit,
} from "./contract.ts";
import {
  assertOfflineGitProofResourceLimit,
  compareRawUtf8,
  createGitObjectOid,
  loadOfflineGitProofJson,
  OfflineGitProofError,
  offlineGitProofResourceLimits,
  parseOfflineGitProofJson,
  sortUniqueRawUtf8,
  verifyOfflineGitProof,
  type OfflineGitObject,
  type OfflineGitProof,
  type OfflineGitProofResource,
} from "./offline-proof.ts";

const auditDirectory = new URL("./audits/", import.meta.url);
const proofDirectory = new URL("./proofs/", import.meta.url);

type Mutable<T> = {
  -readonly [Property in keyof T]: T[Property] extends readonly (infer Item)[]
    ? Mutable<Item>[]
    : T[Property] extends object
      ? Mutable<T[Property]>
      : T[Property];
};

interface AuditAndProof {
  readonly audit: BenchmarkAudit;
  readonly proof: OfflineGitProof;
}

async function loadAuditAndProof(name: string): Promise<AuditAndProof> {
  const [auditText, proof] = await Promise.all([
    readFile(new URL(name, auditDirectory), "utf8"),
    loadOfflineGitProofJson(new URL(name, proofDirectory)),
  ]);
  return {
    audit: parseBenchmarkAudit(JSON.parse(auditText)),
    proof,
  };
}

function mutableAudit(audit: BenchmarkAudit): Mutable<BenchmarkAudit> {
  return structuredClone(audit) as Mutable<BenchmarkAudit>;
}

function mutableProof(proof: OfflineGitProof): Mutable<OfflineGitProof> {
  return structuredClone(proof) as Mutable<OfflineGitProof>;
}

function flipObjectContent(object: Mutable<OfflineGitObject>): void {
  const bytes = Buffer.from(object.contentBase64, "base64");
  bytes[0] = bytes[0]! ^ 1;
  object.contentBase64 = bytes.toString("base64");
}

describe("automatic-blueprint offline Git proofs", () => {
  test("accepts every resource limit exactly and rejects the next unit without large fixtures", () => {
    for (const resource of Object.keys(
      offlineGitProofResourceLimits,
    ) as OfflineGitProofResource[]) {
      const maximum = offlineGitProofResourceLimits[resource];
      expect(() => assertOfflineGitProofResourceLimit(resource, maximum)).not.toThrow();
      expect(() => assertOfflineGitProofResourceLimit(resource, maximum + 1)).toThrow(
        `exceeds ${resource} limit ${maximum}`,
      );
    }
  });

  test("loads checked-in JSON only through the bounded proof file loader", async () => {
    expect((await loadOfflineGitProofJson(new URL("groma.json", proofDirectory))).auditId).toBe(
      "groma-66fe7c6",
    );
    expect(() => parseOfflineGitProofJson("{")).toThrow(
      "INVALID_OFFLINE_GIT_PROOF: proof JSON input must be valid JSON",
    );
  });

  test("verify both complete pinned trees and exactly 33 unique witness blobs offline", async () => {
    const fixtures = await Promise.all([
      loadAuditAndProof("groma.json"),
      loadAuditAndProof("backlog-md-v1.48.0.json"),
    ]);
    const witnessOids = new Set<string>();
    for (const { audit, proof } of fixtures) {
      const verified = verifyOfflineGitProof(audit, proof);
      expect(verified.treeObjectCount).toBe(proof.trees.length);
      expect(verified.witnessBlobCount).toBe(proof.witnessBlobs.length);
      expect(verified.preparedManifest.length).toBe(
        audit.project.fixturePreparation.preparedSourceSnapshotPathCount,
      );
      expect(verified.preparedSourceSnapshotSha256).toBe(
        audit.project.fixturePreparation.preparedSourceSnapshotSha256,
      );
      for (const object of proof.witnessBlobs) witnessOids.add(object.oid);
    }
    expect(witnessOids.size).toBe(33);
  });

  test("recomputes Git framing and rejects raw commit, tree, and blob tampering", async () => {
    const { audit, proof } = await loadAuditAndProof("groma.json");
    for (const location of ["commit", "tree", "blob"] as const) {
      const mutated = mutableProof(proof);
      const object =
        location === "commit"
          ? mutated.commit
          : location === "tree"
            ? mutated.trees[0]!
            : mutated.witnessBlobs[0]!;
      flipObjectContent(object);
      expect(() => verifyOfflineGitProof(audit, mutated)).toThrow(
        `INVALID_OFFLINE_GIT_PROOF: proof.${
          location === "commit" ? "commit" : location === "tree" ? "trees[0]" : "witnessBlobs[0]"
        } ${location} object id mismatch`,
      );
    }
  });

  test("binds the recomputed commit root tree to the audit tree", async () => {
    const { audit, proof } = await loadAuditAndProof("groma.json");
    const mutatedAudit = mutableAudit(audit);
    const mutatedProof = mutableProof(proof);
    const alternateTree = mutatedProof.trees.find((object) => object.oid !== audit.project.tree)!;
    const commitBytes = Buffer.from(mutatedProof.commit.contentBase64, "base64");
    const changedCommit = Buffer.from(
      commitBytes.toString("utf8").replace(/^tree [0-9a-f]{40}$/m, `tree ${alternateTree.oid}`),
      "utf8",
    );
    const changedCommitOid = createGitObjectOid("commit", changedCommit);
    mutatedAudit.project.revision = changedCommitOid;
    mutatedProof.revision = changedCommitOid;
    mutatedProof.commit.oid = changedCommitOid;
    mutatedProof.commit.contentBase64 = changedCommit.toString("base64");

    expect(() => verifyOfflineGitProof(mutatedAudit, mutatedProof)).toThrow(
      "INVALID_OFFLINE_GIT_PROOF: proof.commit root tree must equal the audited tree",
    );
  });

  test("requires every and only reachable tree object", async () => {
    const [groma, backlog] = await Promise.all([
      loadAuditAndProof("groma.json"),
      loadAuditAndProof("backlog-md-v1.48.0.json"),
    ]);
    const missing = mutableProof(groma.proof);
    const removableIndex = missing.trees.findIndex(
      (object) => object.oid !== groma.audit.project.tree,
    );
    missing.trees.splice(removableIndex, 1);
    expect(() => verifyOfflineGitProof(groma.audit, missing)).toThrow(
      /INVALID_OFFLINE_GIT_PROOF: proof is missing reachable tree object/,
    );

    const extraObject = backlog.proof.trees.find(
      (candidate) => !groma.proof.trees.some((object) => object.oid === candidate.oid),
    )!;
    const extra = mutableProof(groma.proof);
    extra.trees.push(structuredClone(extraObject));
    expect(() => verifyOfflineGitProof(groma.audit, extra)).toThrow(
      /INVALID_OFFLINE_GIT_PROOF: proof.trees reachable object set must be exact/,
    );
  });

  test("requires exactly the unique witness blob object set", async () => {
    const [groma, backlog] = await Promise.all([
      loadAuditAndProof("groma.json"),
      loadAuditAndProof("backlog-md-v1.48.0.json"),
    ]);
    const missing = mutableProof(groma.proof);
    missing.witnessBlobs.pop();
    expect(() => verifyOfflineGitProof(groma.audit, missing)).toThrow(
      /INVALID_OFFLINE_GIT_PROOF: proof.witnessBlobs object set must be exact/,
    );

    const extraObject = backlog.proof.witnessBlobs.find(
      (candidate) => !groma.proof.witnessBlobs.some((object) => object.oid === candidate.oid),
    )!;
    const extra = mutableProof(groma.proof);
    extra.witnessBlobs.push(structuredClone(extraObject));
    expect(() => verifyOfflineGitProof(groma.audit, extra)).toThrow(
      /INVALID_OFFLINE_GIT_PROOF: proof.witnessBlobs object set must be exact/,
    );
  });

  test("checks witness tree paths, blob digests, and bounded nonempty line anchors", async () => {
    const { audit, proof } = await loadAuditAndProof("groma.json");

    const missingPath = mutableAudit(audit);
    missingPath.facts[0]!.evidence[0]!.path = "missing/witness.ts";
    expect(() => verifyOfflineGitProof(missingPath, proof)).toThrow(
      "INVALID_OFFLINE_GIT_PROOF: witness path is absent from pinned tree",
    );

    const wrongBlobOid = mutableAudit(audit);
    const firstWitness = wrongBlobOid.facts[0]!.evidence[0]!;
    const secondWitness = wrongBlobOid.facts[0]!.evidence[1]!;
    [firstWitness.blobOid, secondWitness.blobOid] = [secondWitness.blobOid, firstWitness.blobOid];
    expect(() => verifyOfflineGitProof(wrongBlobOid, proof)).toThrow(
      "INVALID_OFFLINE_GIT_PROOF: witness package.json blob id does not match the pinned tree",
    );

    const wrongDigest = mutableAudit(audit);
    wrongDigest.facts[0]!.evidence[0]!.contentSha256 = "0".repeat(64);
    expect(() => verifyOfflineGitProof(wrongDigest, proof)).toThrow(
      "INVALID_OFFLINE_GIT_PROOF: witness package.json content SHA-256 mismatch",
    );

    const outsideBlob = mutableAudit(audit);
    outsideBlob.facts[0]!.evidence[0]!.anchor.startLine = 100_000;
    outsideBlob.facts[0]!.evidence[0]!.anchor.endLine = 100_000;
    expect(() => verifyOfflineGitProof(outsideBlob, proof)).toThrow(
      "INVALID_OFFLINE_GIT_PROOF: witness package.json has an anchor outside its blob",
    );

    const emptyAnchor = mutableAudit(audit);
    const witness = emptyAnchor.facts[0]!.evidence[0]!;
    const blob = proof.witnessBlobs.find((object) => object.oid === witness.blobOid)!;
    const lines = Buffer.from(blob.contentBase64, "base64").toString("utf8").split(/\r?\n/);
    const blankLine = lines.findIndex((line) => line.trim().length === 0);
    expect(blankLine).toBeGreaterThanOrEqual(0);
    witness.anchor.startLine = blankLine + 1;
    witness.anchor.endLine = blankLine + 1;
    expect(() => verifyOfflineGitProof(emptyAnchor, proof)).toThrow(
      "INVALID_OFFLINE_GIT_PROOF: witness package.json has an empty anchor",
    );
  });

  test("recomputes prepared snapshot count and raw-UTF-8 manifest digest independently", async () => {
    const { audit, proof } = await loadAuditAndProof("groma.json");
    const verified = verifyOfflineGitProof(audit, proof);
    expect(verified.preparedManifest.every((entry) => !entry.includes("\tgroma/"))).toBeTrue();
    expect(verified.preparedManifest).toEqual(
      [...verified.preparedManifest].sort((left, right) =>
        compareRawUtf8(left.slice(left.indexOf("\t") + 1), right.slice(right.indexOf("\t") + 1)),
      ),
    );

    const wrongCount = mutableAudit(audit);
    wrongCount.project.fixturePreparation.preparedSourceSnapshotPathCount += 1;
    expect(() => verifyOfflineGitProof(wrongCount, proof)).toThrow(
      /INVALID_OFFLINE_GIT_PROOF: prepared snapshot path count mismatch/,
    );

    const wrongDigest = mutableAudit(audit);
    wrongDigest.project.fixturePreparation.preparedSourceSnapshotSha256 = "0".repeat(64);
    expect(() => verifyOfflineGitProof(wrongDigest, proof)).toThrow(
      /INVALID_OFFLINE_GIT_PROOF: prepared snapshot digest mismatch/,
    );
  });

  test("recomputes source-scope include-any/exclude-none inventory count and digest", async () => {
    const { audit, proof } = await loadAuditAndProof("backlog-md-v1.48.0.json");
    const verified = verifyOfflineGitProof(audit, proof);
    const inventory = verified.sourceScopeInventories.production!;
    expect(inventory.paths).toEqual(sortUniqueRawUtf8(inventory.paths));
    expect(inventory.paths).toContain("src/cli.ts");
    expect(inventory.paths).toContain("src/server/index.ts");
    expect(
      inventory.paths.some((path) => path.includes("/test/") || path.endsWith(".test.ts")),
    ).toBeFalse();

    const wrongCount = mutableAudit(audit);
    wrongCount.project.sourceScopes[0]!.pathCount += 1;
    expect(() => verifyOfflineGitProof(wrongCount, proof)).toThrow(
      /INVALID_OFFLINE_GIT_PROOF: source scope production path count mismatch/,
    );

    const wrongDigest = mutableAudit(audit);
    wrongDigest.project.sourceScopes[0]!.pathInventorySha256 = "0".repeat(64);
    expect(() => verifyOfflineGitProof(wrongDigest, proof)).toThrow(
      /INVALID_OFFLINE_GIT_PROOF: source scope production digest mismatch/,
    );

    const wrongOrder = mutableAudit(audit);
    wrongOrder.project.sourceScopes[0]!.pathInventorySha256 = createBenchmarkStringArrayDigest(
      [...inventory.paths].reverse(),
    );
    expect(() => verifyOfflineGitProof(wrongOrder, proof)).toThrow(
      /INVALID_OFFLINE_GIT_PROOF: source scope production digest mismatch/,
    );

    const wrongMatching = mutableAudit(audit);
    wrongMatching.project.sourceScopes[0]!.included = ["src/*.ts", "src/*.tsx"];
    expect(() => verifyOfflineGitProof(wrongMatching, proof)).toThrow(
      /INVALID_OFFLINE_GIT_PROOF: source scope production path count mismatch/,
    );
  });

  test("binds every include-matched source path to a portable protected root before exclusions", async () => {
    const { audit, proof } = await loadAuditAndProof("groma.json");

    for (const protectedRoots of [["wrong"], ["sr"], ["src/server"]]) {
      const mutated = mutableAudit(audit);
      mutated.project.sourceScopes[0]!.protectedRoots = protectedRoots;
      expect(() => verifyOfflineGitProof(mutated, proof)).toThrow(
        /INVALID_OFFLINE_GIT_PROOF: source scope production includes path outside its protected roots/,
      );
    }

    const caseAlias = mutableAudit(audit);
    caseAlias.project.sourceScopes[0]!.protectedRoots = ["SRC"];
    expect(
      verifyOfflineGitProof(caseAlias, proof).sourceScopeInventories.production?.paths,
    ).toHaveLength(audit.project.sourceScopes[0]!.pathCount);

    const hiddenOutsideRoot = mutableAudit(audit);
    hiddenOutsideRoot.project.sourceScopes[0]!.included.push("scripts/build.ts");
    hiddenOutsideRoot.project.sourceScopes[0]!.excluded.push("scripts/build.ts");
    expect(() => verifyOfflineGitProof(hiddenOutsideRoot, proof)).toThrow(
      'INVALID_OFFLINE_GIT_PROOF: source scope production includes path outside its protected roots: "scripts/build.ts"',
    );
  });

  test("uses case-sensitive segment globs and raw UTF-8 byte path order", () => {
    expect(sourceScopePatternMatches("src/**/*.ts", "src/index.ts")).toBeTrue();
    expect(sourceScopePatternMatches("src/**/*.ts", "src/server/index.ts")).toBeTrue();
    expect(sourceScopePatternMatches("src/**/tests/**", "src/tests/unit.ts")).toBeTrue();
    expect(sourceScopePatternMatches("src/**/tests/**", "src/core/tests/unit.ts")).toBeTrue();
    expect(sourceScopePatternMatches("src/**/*.ts", "Src/index.ts")).toBeFalse();
    expect(sourceScopePatternMatches("src/*.ts", "src/server/index.ts")).toBeFalse();
    expect(sortUniqueRawUtf8(["é", "z", "あ", "a"])).toEqual(["a", "z", "é", "あ"]);
  });

  test("reports proof failures with a dedicated stable error type", async () => {
    const { audit, proof } = await loadAuditAndProof("groma.json");
    const mutated = mutableProof(proof);
    mutated.auditId = "other-audit";
    expect(() => verifyOfflineGitProof(audit, mutated)).toThrow(OfflineGitProofError);
  });
});
