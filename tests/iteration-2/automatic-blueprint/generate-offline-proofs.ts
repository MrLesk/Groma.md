import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { parseBenchmarkAudit, type BenchmarkAudit } from "./contract.ts";
import {
  assertOfflineGitProofResourceLimit,
  offlineGitProofSchemaVersion,
  parseOfflineGitProofJson,
  verifyOfflineGitProof,
  type OfflineGitObject,
  type OfflineGitProof,
} from "./offline-proof.ts";

const auditDirectory = new URL("./audits/", import.meta.url);
const proofDirectory = new URL("./proofs/", import.meta.url);

interface RepositoryArguments {
  readonly backlogRepository: string;
  readonly gromaRepository: string;
}

interface GenerationResourceBudget {
  totalDecodedBytes: number;
}

function parseArguments(argv: readonly string[]): RepositoryArguments {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (
      (name !== "--groma-repository" && name !== "--backlog-repository") ||
      value === undefined ||
      value.length === 0 ||
      values.has(name)
    ) {
      throw new Error(
        "usage: bun run generate-offline-proofs.ts --groma-repository <path> --backlog-repository <path>",
      );
    }
    values.set(name, value);
  }
  const gromaRepository = values.get("--groma-repository");
  const backlogRepository = values.get("--backlog-repository");
  if (gromaRepository === undefined || backlogRepository === undefined || values.size !== 2) {
    throw new Error(
      "usage: bun run generate-offline-proofs.ts --groma-repository <path> --backlog-repository <path>",
    );
  }
  return { backlogRepository, gromaRepository };
}

function runGit(repository: string, arguments_: readonly string[]): Buffer {
  const result = spawnSync("git", ["-C", repository, ...arguments_], {
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    const stderr = Buffer.from(result.stderr ?? [])
      .toString("utf8")
      .trim();
    throw new Error(
      `git ${arguments_.join(" ")} failed in ${repository} (${result.status}): ${stderr}`,
    );
  }
  return Buffer.from(result.stdout ?? []);
}

function rawObject(repository: string, type: "blob" | "commit" | "tree", oid: string): Buffer {
  return runGit(repository, ["cat-file", type, oid]);
}

function proofObject(
  repository: string,
  type: "blob" | "commit" | "tree",
  oid: string,
  budget: GenerationResourceBudget,
): OfflineGitObject {
  const content = rawObject(repository, type, oid);
  assertOfflineGitProofResourceLimit(
    "decodedObjectBytes",
    content.byteLength,
    `${type} object ${oid}`,
  );
  budget.totalDecodedBytes += content.byteLength;
  assertOfflineGitProofResourceLimit(
    "totalDecodedBytes",
    budget.totalDecodedBytes,
    "generated proof objects",
  );
  const contentBase64 = content.toString("base64");
  assertOfflineGitProofResourceLimit(
    "encodedObjectBytes",
    Buffer.byteLength(contentBase64, "utf8"),
    `${type} object ${oid}`,
  );
  return { contentBase64, oid };
}

function reachableTreeOids(repository: string, rootTree: string): string[] {
  const output = runGit(repository, ["ls-tree", "-r", "-t", "-z", "--full-tree", rootTree]);
  const treeOids = new Set([rootTree]);
  for (const record of output.toString("utf8").split("\0")) {
    if (record.length === 0) continue;
    const tab = record.indexOf("\t");
    if (tab === -1) throw new Error("git ls-tree emitted an invalid record");
    const header = record.slice(0, tab).split(" ");
    if (header.length !== 3) throw new Error("git ls-tree emitted an invalid header");
    const [, type, oid] = header;
    if (type === "tree" && oid !== undefined) treeOids.add(oid);
  }
  return [...treeOids].sort();
}

function witnessBlobOids(audit: BenchmarkAudit): string[] {
  return [
    ...new Set([
      ...audit.facts.flatMap((fact) => fact.evidence.map((witness) => witness.blobOid)),
      ...audit.forbiddenClaims.flatMap((claim) => claim.evidence.map((witness) => witness.blobOid)),
    ]),
  ].sort();
}

export function generateOfflineGitProof(
  audit: BenchmarkAudit,
  repository: string,
): OfflineGitProof {
  const commitType = runGit(repository, ["cat-file", "-t", audit.project.revision])
    .toString("ascii")
    .trim();
  if (commitType !== "commit") {
    throw new Error(`${audit.project.revision} is not a commit in ${repository}`);
  }
  const rootTree = runGit(repository, ["rev-parse", `${audit.project.revision}^{tree}`])
    .toString("ascii")
    .trim();
  if (rootTree !== audit.project.tree) {
    throw new Error(
      `audit tree pin mismatch in ${repository}: expected ${audit.project.tree}, found ${rootTree}`,
    );
  }

  const treeOids = reachableTreeOids(repository, audit.project.tree);
  const blobOids = witnessBlobOids(audit);
  assertOfflineGitProofResourceLimit("treeObjects", treeOids.length, "generated proof trees");
  assertOfflineGitProofResourceLimit(
    "witnessBlobObjects",
    blobOids.length,
    "generated proof witness blobs",
  );
  assertOfflineGitProofResourceLimit(
    "totalObjects",
    1 + treeOids.length + blobOids.length,
    "generated proof",
  );
  const budget: GenerationResourceBudget = { totalDecodedBytes: 0 };

  const proof: OfflineGitProof = {
    schemaVersion: offlineGitProofSchemaVersion,
    auditId: audit.auditId,
    repository: audit.project.repository,
    revision: audit.project.revision,
    tree: audit.project.tree,
    commit: proofObject(repository, "commit", audit.project.revision, budget),
    trees: treeOids.map((oid) => proofObject(repository, "tree", oid, budget)),
    witnessBlobs: blobOids.map((oid) => proofObject(repository, "blob", oid, budget)),
  };
  verifyOfflineGitProof(audit, proof);
  return proof;
}

async function loadAudit(name: string): Promise<BenchmarkAudit> {
  const source = await readFile(new URL(name, auditDirectory), "utf8");
  return parseBenchmarkAudit(JSON.parse(source));
}

function serializeBoundedProof(audit: BenchmarkAudit, repository: string): string {
  const proof = generateOfflineGitProof(audit, repository);
  const serialized = `${JSON.stringify(proof, null, 2)}\n`;
  const boundedProof = parseOfflineGitProofJson(serialized);
  verifyOfflineGitProof(audit, boundedProof);
  return serialized;
}

async function main(): Promise<void> {
  const repositories = parseArguments(Bun.argv.slice(2));
  const [groma, backlog] = await Promise.all([
    loadAudit("groma.json"),
    loadAudit("backlog-md-v1.48.0.json"),
  ]);
  const gromaProof = serializeBoundedProof(groma, repositories.gromaRepository);
  const backlogProof = serializeBoundedProof(backlog, repositories.backlogRepository);
  await mkdir(fileURLToPath(proofDirectory), { recursive: true });
  await Promise.all([
    writeFile(new URL("groma.json", proofDirectory), gromaProof),
    writeFile(new URL("backlog-md-v1.48.0.json", proofDirectory), backlogProof),
  ]);
}

if (import.meta.main) {
  await main();
}
