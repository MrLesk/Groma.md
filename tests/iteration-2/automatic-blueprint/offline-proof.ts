import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

import {
  createBenchmarkStringArrayDigest,
  isStrictPortableWorkspaceDescendant,
  maximumSourceScopeCandidatePathUtf8Bytes,
  sourceScopePatternMatches,
  strictPortablePathIsEqualOrDescendantConservatively,
  type BenchmarkAudit,
  type SourceWitness,
} from "./contract.ts";

export const offlineGitProofSchemaVersion = 1 as const;

export const offlineGitProofResourceLimits = {
  decodedObjectBytes: 1_572_864,
  encodedObjectBytes: 2_097_152,
  jsonInputBytes: 4_194_304,
  pathUtf8Bytes: maximumSourceScopeCandidatePathUtf8Bytes,
  totalDecodedBytes: 67_108_864,
  totalObjects: 5_121,
  treeDepth: 128,
  treeEntries: 250_000,
  treeObjects: 4_096,
  treePaths: 250_000,
  witnessBlobObjects: 1_024,
} as const;

export type OfflineGitProofResource = keyof typeof offlineGitProofResourceLimits;

export interface OfflineGitObject {
  readonly contentBase64: string;
  readonly oid: string;
}

export interface OfflineGitProof {
  readonly auditId: string;
  readonly commit: OfflineGitObject;
  readonly repository: string;
  readonly revision: string;
  readonly schemaVersion: typeof offlineGitProofSchemaVersion;
  readonly tree: string;
  readonly trees: readonly OfflineGitObject[];
  readonly witnessBlobs: readonly OfflineGitObject[];
}

export interface VerifiedOfflineGitProof {
  readonly preparedManifest: readonly string[];
  readonly preparedSourceSnapshotSha256: string;
  readonly sourceScopeInventories: Readonly<
    Record<
      string,
      {
        readonly paths: readonly string[];
        readonly sha256: string;
      }
    >
  >;
  readonly treeBlobPaths: readonly string[];
  readonly treeObjectCount: number;
  readonly witnessBlobCount: number;
}

export class OfflineGitProofError extends Error {
  constructor(message: string) {
    super(`INVALID_OFFLINE_GIT_PROOF: ${message}`);
    this.name = "OfflineGitProofError";
  }
}

interface TreeBlobEntry {
  readonly mode: "100644" | "100755" | "120000";
  readonly oid: string;
  readonly path: string;
}

interface ParsedTreeEntry {
  readonly mode: "100644" | "100755" | "120000" | "160000" | "40000";
  readonly name: string;
  readonly oid: string;
}

const gitOidPattern = /^[0-9a-f]{40}$/;
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

function fail(message: string): never {
  throw new OfflineGitProofError(message);
}

export function assertOfflineGitProofResourceLimit(
  resource: OfflineGitProofResource,
  actual: number,
  location = "proof",
): void {
  const maximum = offlineGitProofResourceLimits[resource];
  if (!Number.isSafeInteger(actual) || actual < 0) {
    fail(`${location} ${resource} usage must be a nonnegative safe integer`);
  }
  if (actual > maximum) {
    fail(`${location} exceeds ${resource} limit ${maximum} (received ${actual})`);
  }
}

function asRecord(value: unknown, location: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail(`${location} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asNonemptyString(value: unknown, location: string): string {
  if (typeof value !== "string" || value.length === 0) {
    return fail(`${location} must be a nonempty string`);
  }
  return value;
}

function asGitOid(value: unknown, location: string): string {
  const oid = asNonemptyString(value, location);
  if (!gitOidPattern.test(oid)) return fail(`${location} must be a lowercase Git SHA-1 id`);
  return oid;
}

function decodeCanonicalBase64(
  value: unknown,
  location: string,
  budget: ProofResourceBudget,
): Uint8Array {
  const encoded = asNonemptyString(value, location);
  assertOfflineGitProofResourceLimit(
    "encodedObjectBytes",
    Buffer.byteLength(encoded, "utf8"),
    location,
  );
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    return fail(`${location} must be canonical base64`);
  }
  const decoded = Buffer.from(encoded, "base64");
  assertOfflineGitProofResourceLimit("decodedObjectBytes", decoded.byteLength, location);
  budget.totalDecodedBytes += decoded.byteLength;
  assertOfflineGitProofResourceLimit(
    "totalDecodedBytes",
    budget.totalDecodedBytes,
    "proof objects",
  );
  if (decoded.toString("base64") !== encoded) {
    return fail(`${location} must be canonical base64`);
  }
  return decoded;
}

export function createGitObjectOid(type: "blob" | "commit" | "tree", content: Uint8Array): string {
  return createHash("sha1")
    .update(Buffer.from(`${type} ${content.byteLength}\0`, "ascii"))
    .update(content)
    .digest("hex");
}

function decodeProofObject(
  value: unknown,
  type: "blob" | "commit" | "tree",
  location: string,
  budget: ProofResourceBudget,
): { readonly bytes: Uint8Array; readonly oid: string } {
  const object = asRecord(value, location);
  const oid = asGitOid(object.oid, `${location}.oid`);
  const bytes = decodeCanonicalBase64(object.contentBase64, `${location}.contentBase64`, budget);
  const computedOid = createGitObjectOid(type, bytes);
  if (computedOid !== oid) {
    return fail(`${location} ${type} object id mismatch: expected ${oid}, computed ${computedOid}`);
  }
  return { bytes, oid };
}

function decodeUtf8(value: Uint8Array, location: string): string {
  try {
    return utf8Decoder.decode(value);
  } catch {
    return fail(`${location} must be valid UTF-8`);
  }
}

function parseCommitRootTree(content: Uint8Array): string {
  const text = decodeUtf8(content, "proof.commit.contentBase64");
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? undefined : text.indexOf("\n"));
  const match = /^tree ([0-9a-f]{40})$/.exec(firstLine);
  if (match === null) return fail("proof.commit must begin with exactly one root tree header");
  return match[1]!;
}

function parseTreeEntries(content: Uint8Array, location: string): ParsedTreeEntry[] {
  const entries: ParsedTreeEntry[] = [];
  let offset = 0;
  while (offset < content.byteLength) {
    const space = content.indexOf(0x20, offset);
    if (space === -1) return fail(`${location} has a tree entry without a mode separator`);
    const nul = content.indexOf(0, space + 1);
    if (nul === -1) return fail(`${location} has a tree entry without a name terminator`);
    if (nul + 21 > content.byteLength) {
      return fail(`${location} has a truncated tree entry object id`);
    }

    const modeText = Buffer.from(content.subarray(offset, space)).toString("ascii");
    if (
      !(["100644", "100755", "120000", "160000", "40000"] as const).includes(
        modeText as ParsedTreeEntry["mode"],
      )
    ) {
      return fail(`${location} has unsupported Git mode ${JSON.stringify(modeText)}`);
    }
    const nameBytes = content.subarray(space + 1, nul);
    const name = decodeUtf8(nameBytes, `${location} entry name`);
    if (name.length === 0 || name.includes("/") || name.includes("\0")) {
      return fail(`${location} has an invalid Git tree entry name`);
    }
    const oid = Buffer.from(content.subarray(nul + 1, nul + 21)).toString("hex");
    entries.push({ mode: modeText as ParsedTreeEntry["mode"], name, oid });
    offset = nul + 21;
  }
  return entries;
}

export function compareRawUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

export function sortUniqueRawUtf8(values: readonly string[]): string[] {
  const sorted = [...values].sort(compareRawUtf8);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index - 1] === sorted[index]) {
      return fail(`path inventory contains duplicate path ${JSON.stringify(sorted[index])}`);
    }
  }
  return sorted;
}

function allAuditWitnesses(audit: BenchmarkAudit): SourceWitness[] {
  return [
    ...audit.facts.flatMap((fact) => fact.evidence),
    ...audit.forbiddenClaims.flatMap((claim) => claim.evidence),
  ];
}

interface ProofResourceBudget {
  totalDecodedBytes: number;
}

function assertEncodedProofObjectWithinLimit(value: unknown, location: string): void {
  const object = asRecord(value, location);
  const encoded = asNonemptyString(object.contentBase64, `${location}.contentBase64`);
  assertOfflineGitProofResourceLimit(
    "encodedObjectBytes",
    Buffer.byteLength(encoded, "utf8"),
    `${location}.contentBase64`,
  );
}

function parseProof(value: unknown): OfflineGitProof {
  const proof = asRecord(value, "proof");
  if (proof.schemaVersion !== offlineGitProofSchemaVersion) {
    return fail(`proof.schemaVersion must be ${offlineGitProofSchemaVersion}`);
  }
  asNonemptyString(proof.auditId, "proof.auditId");
  asNonemptyString(proof.repository, "proof.repository");
  asGitOid(proof.revision, "proof.revision");
  asGitOid(proof.tree, "proof.tree");
  asRecord(proof.commit, "proof.commit");
  if (!Array.isArray(proof.trees)) return fail("proof.trees must be an array");
  if (!Array.isArray(proof.witnessBlobs)) return fail("proof.witnessBlobs must be an array");
  assertOfflineGitProofResourceLimit("treeObjects", proof.trees.length, "proof.trees");
  assertOfflineGitProofResourceLimit(
    "witnessBlobObjects",
    proof.witnessBlobs.length,
    "proof.witnessBlobs",
  );
  assertOfflineGitProofResourceLimit(
    "totalObjects",
    1 + proof.trees.length + proof.witnessBlobs.length,
    "proof",
  );
  assertEncodedProofObjectWithinLimit(proof.commit, "proof.commit");
  for (const [index, object] of proof.trees.entries()) {
    assertEncodedProofObjectWithinLimit(object, `proof.trees[${index}]`);
  }
  for (const [index, object] of proof.witnessBlobs.entries()) {
    assertEncodedProofObjectWithinLimit(object, `proof.witnessBlobs[${index}]`);
  }
  return value as OfflineGitProof;
}

export function parseOfflineGitProofJson(input: string | Uint8Array): OfflineGitProof {
  const bytes = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  assertOfflineGitProofResourceLimit("jsonInputBytes", bytes.byteLength, "proof JSON input");
  const source = decodeUtf8(bytes, "proof JSON input");
  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch {
    return fail("proof JSON input must be valid JSON");
  }
  return parseProof(value);
}

export async function loadOfflineGitProofJson(path: string | URL): Promise<OfflineGitProof> {
  const metadata = await stat(path);
  assertOfflineGitProofResourceLimit("jsonInputBytes", metadata.size, "proof JSON file");
  return parseOfflineGitProofJson(await readFile(path));
}

function assertExactSet(
  actual: ReadonlySet<string>,
  expected: ReadonlySet<string>,
  location: string,
): void {
  const missing = [...expected].filter((item) => !actual.has(item)).sort();
  const extra = [...actual].filter((item) => !expected.has(item)).sort();
  if (missing.length > 0 || extra.length > 0) {
    fail(
      `${location} must be exact (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`,
    );
  }
}

function isRemovedByPreparation(path: string, removedPaths: readonly string[]): boolean {
  return removedPaths.some(
    (removedPath) => path === removedPath || path.startsWith(`${removedPath}/`),
  );
}

export function verifyOfflineGitProof(
  audit: BenchmarkAudit,
  proofValue: unknown,
): VerifiedOfflineGitProof {
  const proof = parseProof(proofValue);
  const resourceBudget: ProofResourceBudget = { totalDecodedBytes: 0 };
  for (const [field, actual, expected] of [
    ["auditId", proof.auditId, audit.auditId],
    ["repository", proof.repository, audit.project.repository],
    ["revision", proof.revision, audit.project.revision],
    ["tree", proof.tree, audit.project.tree],
  ] as const) {
    if (actual !== expected) fail(`proof.${field} must equal audit ${field}`);
  }

  const commit = decodeProofObject(proof.commit, "commit", "proof.commit", resourceBudget);
  if (commit.oid !== audit.project.revision) {
    fail("proof.commit.oid must equal the audited revision");
  }
  const commitRootTree = parseCommitRootTree(commit.bytes);
  if (commitRootTree !== audit.project.tree) {
    fail("proof.commit root tree must equal the audited tree");
  }

  const treeObjects = new Map<string, Uint8Array>();
  for (const [index, object] of proof.trees.entries()) {
    const decoded = decodeProofObject(object, "tree", `proof.trees[${index}]`, resourceBudget);
    if (treeObjects.has(decoded.oid)) fail(`proof.trees contains duplicate ${decoded.oid}`);
    treeObjects.set(decoded.oid, decoded.bytes);
  }

  const visitedTreeOids = new Set<string>();
  const activeTreeOids = new Set<string>();
  const treeBlobs: TreeBlobEntry[] = [];
  const treePaths = new Set<string>();
  let treeEntryCount = 0;
  const walkTree = (oid: string, prefix: string, depth: number): void => {
    assertOfflineGitProofResourceLimit("treeDepth", depth, `tree ${oid}`);
    const content = treeObjects.get(oid);
    if (content === undefined) fail(`proof is missing reachable tree object ${oid}`);
    if (activeTreeOids.has(oid)) fail(`proof tree graph contains a cycle at ${oid}`);
    visitedTreeOids.add(oid);
    activeTreeOids.add(oid);
    for (const entry of parseTreeEntries(content, `tree ${oid}`)) {
      treeEntryCount += 1;
      assertOfflineGitProofResourceLimit("treeEntries", treeEntryCount, "proof tree graph");
      const path = prefix.length === 0 ? entry.name : `${prefix}/${entry.name}`;
      assertOfflineGitProofResourceLimit(
        "pathUtf8Bytes",
        Buffer.byteLength(path, "utf8"),
        `tree path ${JSON.stringify(path)}`,
      );
      if (treePaths.has(path)) fail(`proof tree contains duplicate path ${JSON.stringify(path)}`);
      treePaths.add(path);
      assertOfflineGitProofResourceLimit("treePaths", treePaths.size, "proof tree graph");
      if (entry.mode === "40000") {
        walkTree(entry.oid, path, depth + 1);
      } else if (entry.mode !== "160000") {
        treeBlobs.push({ mode: entry.mode, oid: entry.oid, path });
      }
    }
    activeTreeOids.delete(oid);
  };
  walkTree(commitRootTree, "", 1);
  assertExactSet(new Set(treeObjects.keys()), visitedTreeOids, "proof.trees reachable object set");

  const blobByPath = new Map(treeBlobs.map((entry) => [entry.path, entry]));
  const witnesses = allAuditWitnesses(audit);
  const expectedWitnessBlobOids = new Set(witnesses.map((witness) => witness.blobOid));
  const witnessBlobObjects = new Map<string, Uint8Array>();
  for (const [index, object] of proof.witnessBlobs.entries()) {
    const decoded = decodeProofObject(
      object,
      "blob",
      `proof.witnessBlobs[${index}]`,
      resourceBudget,
    );
    if (witnessBlobObjects.has(decoded.oid)) {
      fail(`proof.witnessBlobs contains duplicate ${decoded.oid}`);
    }
    witnessBlobObjects.set(decoded.oid, decoded.bytes);
  }
  assertExactSet(
    new Set(witnessBlobObjects.keys()),
    expectedWitnessBlobOids,
    "proof.witnessBlobs object set",
  );

  for (const witness of witnesses) {
    const treeEntry = blobByPath.get(witness.path);
    if (treeEntry === undefined) fail(`witness path is absent from pinned tree: ${witness.path}`);
    if (treeEntry.oid !== witness.blobOid) {
      fail(`witness ${witness.path} blob id does not match the pinned tree`);
    }
    const content = witnessBlobObjects.get(witness.blobOid);
    if (content === undefined) fail(`proof is missing witness blob ${witness.blobOid}`);
    const contentSha256 = createHash("sha256").update(content).digest("hex");
    if (contentSha256 !== witness.contentSha256) {
      fail(`witness ${witness.path} content SHA-256 mismatch`);
    }
    const source = decodeUtf8(content, `witness blob ${witness.blobOid}`);
    const lines = source.split(/\r?\n/);
    const { startLine, endLine } = witness.anchor;
    if (startLine < 1 || endLine < startLine || endLine > lines.length) {
      fail(`witness ${witness.path} has an anchor outside its blob`);
    }
    if (
      lines
        .slice(startLine - 1, endLine)
        .join("\n")
        .trim().length === 0
    ) {
      fail(`witness ${witness.path} has an empty anchor`);
    }
  }

  const sortedTreeBlobs = [...treeBlobs].sort((left, right) =>
    compareRawUtf8(left.path, right.path),
  );
  const preparedManifest = sortedTreeBlobs
    .filter(
      (entry) =>
        !isRemovedByPreparation(
          entry.path,
          audit.project.fixturePreparation.preexistingGromaOwnedPaths,
        ),
    )
    .map((entry) => `${entry.mode} blob ${entry.oid}\t${entry.path}`);
  const preparedSha256 = createBenchmarkStringArrayDigest(preparedManifest);
  const expectedPreparation = audit.project.fixturePreparation;
  if (preparedManifest.length !== expectedPreparation.preparedSourceSnapshotPathCount) {
    fail(
      `prepared snapshot path count mismatch: expected ${expectedPreparation.preparedSourceSnapshotPathCount}, computed ${preparedManifest.length}`,
    );
  }
  if (preparedSha256 !== expectedPreparation.preparedSourceSnapshotSha256) {
    fail(
      `prepared snapshot digest mismatch: expected ${expectedPreparation.preparedSourceSnapshotSha256}, computed ${preparedSha256}`,
    );
  }

  const sourceScopeInventories: Record<
    string,
    { readonly paths: readonly string[]; readonly sha256: string }
  > = {};
  for (const scope of audit.project.sourceScopes) {
    const includedPaths = treeBlobs
      .map((entry) => entry.path)
      .filter((path) => scope.included.some((pattern) => sourceScopePatternMatches(pattern, path)));
    for (const path of includedPaths) {
      if (
        !isStrictPortableWorkspaceDescendant(path) ||
        !scope.protectedRoots.some((root) =>
          strictPortablePathIsEqualOrDescendantConservatively(path, root),
        )
      ) {
        fail(
          `source scope ${scope.id} includes path outside its protected roots: ${JSON.stringify(path)}`,
        );
      }
    }
    const paths = sortUniqueRawUtf8(
      includedPaths.filter(
        (path) => !scope.excluded.some((pattern) => sourceScopePatternMatches(pattern, path)),
      ),
    );
    for (const path of paths) {
      if (
        !scope.protectedRoots.some((root) =>
          strictPortablePathIsEqualOrDescendantConservatively(path, root),
        )
      ) {
        fail(
          `source scope ${scope.id} inventory contains path outside its protected roots: ${JSON.stringify(path)}`,
        );
      }
    }
    const sha256 = createBenchmarkStringArrayDigest(paths);
    if (paths.length !== scope.pathCount) {
      fail(
        `source scope ${scope.id} path count mismatch: expected ${scope.pathCount}, computed ${paths.length}`,
      );
    }
    if (sha256 !== scope.pathInventorySha256) {
      fail(
        `source scope ${scope.id} digest mismatch: expected ${scope.pathInventorySha256}, computed ${sha256}`,
      );
    }
    sourceScopeInventories[scope.id] = { paths, sha256 };
  }

  return {
    preparedManifest,
    preparedSourceSnapshotSha256: preparedSha256,
    sourceScopeInventories,
    treeBlobPaths: sortedTreeBlobs.map((entry) => entry.path),
    treeObjectCount: treeObjects.size,
    witnessBlobCount: witnessBlobObjects.size,
  };
}
