import { observationSessionApiVersion, type ObservationRecord } from "../../../core/index.ts";
import {
  createLocalObservationJournal,
  createLocalResourceProvider,
  type LocalObservationJournalFaultPhase,
  type LocalResourceFaultPhase,
} from "../../index.ts";

const [workspaceRoot, coordinationRoot, action, faultSpec = "journal"] = process.argv.slice(2);
const actions = new Set([
  "abandonment",
  "acknowledgement",
  "batch",
  "begin",
  "cleanup",
  "completion",
  "handoff",
  "heartbeat",
]);
if (
  workspaceRoot === undefined ||
  coordinationRoot === undefined ||
  action === undefined ||
  !actions.has(action)
) {
  throw new Error("observation crash fixture received invalid arguments");
}

const phaseFor: Record<string, LocalObservationJournalFaultPhase> = {
  abandonment: "after-abandonment",
  acknowledgement: "after-acknowledgement",
  batch: "after-batch",
  begin: "after-begin",
  cleanup: "after-cleanup",
  completion: "after-completion",
  handoff: "after-handoff",
  heartbeat: "after-heartbeat",
};
const resourcePhases = new Set<LocalResourceFaultPhase>([
  "after-rename",
  "flush",
  "removal-after-unlink",
  "removal-parent-directory-sync",
  "removal-unlink",
  "replacement-parent-directory-sync",
  "replacement-target-file-sync",
  "write",
]);
const resourcePhase = faultSpec.startsWith("resource:")
  ? (faultSpec.slice("resource:".length) as LocalResourceFaultPhase)
  : undefined;
if (
  faultSpec !== "journal" &&
  (resourcePhase === undefined || !resourcePhases.has(resourcePhase))
) {
  throw new Error("observation crash fixture received an invalid resource fault phase");
}
let armed = action === "begin";
const resources = await createLocalResourceProvider({
  coordinationRoot,
  faultInjector(phase) {
    if (armed && phase === resourcePhase) process.exit(86);
  },
  workspaceRoot,
});
const journal = createLocalObservationJournal({
  faultInjector(phase) {
    if (armed && faultSpec === "journal" && phase === phaseFor[action]) process.exit(86);
  },
  resources,
});
const begin = {
  apiVersion: observationSessionApiVersion,
  epoch: "epoch-crash",
  projectId: "project.crash",
  scopes: [{ id: "app", resourceRoot: "src" }],
  source: { id: "fixture.typescript", instance: "workspace", version: "1.0.0" },
} as const;
const record: ObservationRecord = {
  candidate: { name: "API", type: "service" },
  key: "api",
  kind: "component-candidate",
  provenance: [
    {
      fingerprint: "sha256:aaaaaaaaaaaaaaaa",
      resource: "src/index.ts",
      scope: "app",
    },
  ],
  scope: "app",
};
const coverage = [
  { kinds: ["component-candidate" as const], scope: "app", state: "complete" as const },
];
const lane = {
  epoch: begin.epoch,
  projectId: begin.projectId,
  source: { id: begin.source.id, instance: begin.source.instance },
};

const started = await journal.begin(begin);
if (!started.ok) throw new Error(started.diagnostics[0]?.code ?? "begin failed");
const session = started.value;
if (action === "begin") throw new Error("begin fault did not terminate the fixture");

if (action === "batch") {
  armed = true;
  await session.submitBatch({ epoch: begin.epoch, records: [record], sequence: 1 });
} else if (action === "heartbeat") {
  armed = true;
  await session.heartbeat({ epoch: begin.epoch, sequence: 1 });
} else if (action === "completion") {
  const submitted = await session.submitBatch({
    epoch: begin.epoch,
    records: [record],
    sequence: 1,
  });
  if (!submitted.ok) throw new Error("batch failed");
  armed = true;
  await session.complete({ coverage, epoch: begin.epoch, sequence: 2 });
} else if (action === "abandonment") {
  armed = true;
  await session.cancel({ epoch: begin.epoch, sequence: 1 });
} else if (action === "handoff" || action === "acknowledgement") {
  const submitted = await session.submitBatch({
    epoch: begin.epoch,
    records: [record],
    sequence: 1,
  });
  if (!submitted.ok) throw new Error("batch failed");
  const completed = await session.complete({ coverage, epoch: begin.epoch, sequence: 2 });
  if (!completed.ok) throw new Error("completion failed");
  if (action === "handoff") armed = true;
  const offered = await journal.handoff(lane);
  if (!offered.ok) throw new Error("handoff failed");
  if (action === "acknowledgement") {
    armed = true;
    await journal.acknowledge({ ...lane, token: offered.value.token });
  }
} else if (action === "cleanup") {
  const cancelled = await session.cancel({ epoch: begin.epoch, sequence: 1 });
  if (!cancelled.ok) throw new Error("cancellation failed");
  armed = true;
  await journal.cleanup(lane);
}

throw new Error(`observation crash fixture did not terminate at ${action}`);
