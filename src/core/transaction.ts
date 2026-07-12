import {
  createGraphCommittedEvent,
  type AffectedGraphIdentities,
  type AffectedIdentityInput,
  type GraphCommittedEvent,
} from "./events.ts";
import { nextGraphGeneration, parseGraphGeneration, type GraphGeneration } from "./generation.ts";
import {
  copyGraphPayload,
  copyGraphPayloadPair,
  type GraphData,
  type GraphDataStructuralBudget,
} from "./payload.ts";
import { failure, type Diagnostic, type Result, success } from "./result.ts";
import { inspectExactRecord, inspectIntrinsicArrayLength } from "./runtime.ts";

declare const contentRevisionBrand: unique symbol;
declare const resourceKeyBrand: unique symbol;

export type ContentRevision = string & { readonly [contentRevisionBrand]: true };
export type ResourceKey = string & { readonly [resourceKeyBrand]: true };

export interface ContentRevisionExpectationInput {
  readonly expected: string | null;
  readonly resource: string;
}

export interface ContentRevisionExpectation {
  readonly expected: ContentRevision | null;
  readonly resource: ResourceKey;
}

export interface ResourceRevisionInput {
  readonly resource: string;
  readonly revision: string | null;
}

export interface ResourceRevision {
  readonly resource: ResourceKey;
  readonly revision: ContentRevision | null;
}

export interface TransactionRequest {
  readonly affected: AffectedIdentityInput;
  readonly context: unknown;
  readonly expectedRevisions: readonly ContentRevisionExpectationInput[];
  readonly mutation: unknown;
}

export interface ProposedTransaction {
  readonly affected: AffectedGraphIdentities;
  readonly baseGeneration: GraphGeneration;
  readonly context: GraphData;
  readonly expectedRevisions: readonly ContentRevisionExpectation[];
  readonly generation: GraphGeneration;
  readonly mutation: GraphData;
  readonly priorState: GraphData;
}

export interface TransactionInvariant {
  readonly id: string;
  readonly validate: (proposal: ProposedTransaction) => readonly Diagnostic[];
}

export interface TransactionProviderSnapshotInput {
  readonly generation: number;
  readonly revisions: readonly ResourceRevisionInput[];
  readonly state: unknown;
}

export type TransactionPrepareResultInput =
  | {
      readonly reason: "generation" | "revision";
      readonly status: "conflict";
    }
  | {
      readonly status: "prepared";
      readonly token: string;
    };

export type TransactionCommitResultInput =
  | {
      readonly affected: AffectedIdentityInput;
      readonly generation: number;
      readonly revisions: readonly ResourceRevisionInput[];
      readonly status: "committed";
    }
  | { readonly status: "indeterminate" }
  | { readonly status: "not-committed" };

export type TransactionRecoveryResultInput = TransactionCommitResultInput;

type MaybePromise<T> = PromiseLike<T> | T;

export interface TransactionProvider {
  /** Reads one consistent generation, prior state, and revision set without writing. */
  readonly snapshot: (
    resources: readonly ResourceKey[],
  ) => MaybePromise<TransactionProviderSnapshotInput>;
  /**
   * Stages the proposal and atomically rechecks its base generation and expected
   * revisions before returning prepared. It must not change canonical state.
   */
  readonly prepare: (proposal: ProposedTransaction) => MaybePromise<TransactionPrepareResultInput>;
  /** Attempts the canonical commit. Any thrown or malformed result is uncertain. */
  readonly commit: (token: string) => MaybePromise<TransactionCommitResultInput>;
  /** Idempotently resolves an uncertain commit using the provider's opaque preparation token. */
  readonly recover: (token: string) => MaybePromise<TransactionRecoveryResultInput>;
}

export interface TransactionEngineOptions {
  readonly maxAffectedIdentities: number;
  readonly maxRequestDataDepth: number;
  readonly maxRequestDataValues: number;
  readonly maxSnapshotStateDepth: number;
  readonly maxSnapshotStateValues: number;
  readonly provider: TransactionProvider;
}

export type TransactionProviderPhase = "commit" | "prepare" | "recovery" | "snapshot";

export interface TransactionValidationRejected {
  readonly diagnostics: readonly Diagnostic[];
  readonly status: "validation-rejected";
}

export interface TransactionConflict {
  readonly diagnostics: readonly Diagnostic[];
  readonly status: "conflict";
}

export interface TransactionProviderFailure {
  readonly committed: false;
  readonly diagnostics: readonly Diagnostic[];
  readonly phase: TransactionProviderPhase;
  readonly status: "provider-failure";
}

export interface TransactionRecovery {
  readonly baseGeneration: GraphGeneration;
  readonly generation: GraphGeneration;
  readonly resources: readonly ResourceKey[];
  readonly token: string;
}

export interface TransactionIndeterminate {
  readonly diagnostics: readonly Diagnostic[];
  readonly recovery: TransactionRecovery;
  readonly status: "indeterminate";
}

export interface TransactionCommitted {
  readonly event: GraphCommittedEvent;
  readonly generation: GraphGeneration;
  readonly revisions: readonly ResourceRevision[];
  readonly status: "committed";
}

export type TransactionOutcome =
  | TransactionCommitted
  | TransactionConflict
  | TransactionIndeterminate
  | TransactionProviderFailure
  | TransactionValidationRejected;

interface ValidatedTransactionRequest {
  readonly affected: AffectedGraphIdentities;
  readonly context: GraphData;
  readonly expectedRevisions: readonly ContentRevisionExpectation[];
  readonly mutation: GraphData;
}

interface ValidatedSnapshot {
  readonly generation: GraphGeneration;
  readonly revisions: readonly ResourceRevision[];
  readonly state: GraphData;
}

interface RegisteredInvariant {
  readonly id: string;
  readonly validate: (proposal: ProposedTransaction) => unknown;
}

type PreparedProviderResult =
  | { readonly reason: "generation" | "revision"; readonly status: "conflict" }
  | { readonly status: "prepared"; readonly token: string };

type ConfirmedProviderResult =
  | {
      readonly affected: AffectedGraphIdentities;
      readonly generation: GraphGeneration;
      readonly revisions: readonly ResourceRevision[];
      readonly status: "committed";
    }
  | { readonly status: "indeterminate" }
  | { readonly status: "not-committed" };

export const TRANSACTION_DIAGNOSTIC_MAX_CHARACTERS = 4_096;

const maximumOpaqueCharacters = TRANSACTION_DIAGNOSTIC_MAX_CHARACTERS;
const maximumRevisionCount = 10_000;
const maximumInvariantDiagnosticCount = 1_000;
const maximumInvariantDetailCount = 64;

function validatePositiveBudget(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}

function frozenDiagnostic(
  code: string,
  message: string,
  details?: Readonly<Record<string, string | number | boolean>>,
): Diagnostic {
  let frozenDetails: Readonly<Record<string, string | number | boolean>> | undefined;
  if (details !== undefined) {
    const copied: Record<string, string | number | boolean> = Object.create(null) as Record<
      string,
      string | number | boolean
    >;
    const keys = Reflect.ownKeys(details);
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      if (typeof key !== "string") continue;
      const descriptor = Object.getOwnPropertyDescriptor(details, key);
      if (descriptor !== undefined && "value" in descriptor) {
        Object.defineProperty(copied, key, { enumerable: true, value: descriptor.value });
      }
    }
    frozenDetails = Object.freeze(copied);
  }
  return frozenDetails === undefined
    ? Object.freeze({ code, message })
    : Object.freeze({ code, details: frozenDetails, message });
}

function frozenDiagnostics(...diagnostics: readonly Diagnostic[]): readonly Diagnostic[] {
  const copied = new Array<Diagnostic>(diagnostics.length);
  for (let index = 0; index < diagnostics.length; index += 1) copied[index] = diagnostics[index]!;
  return Object.freeze(copied);
}

function validationRejected(...diagnostics: readonly Diagnostic[]): TransactionValidationRejected {
  return Object.freeze({
    diagnostics: frozenDiagnostics(...diagnostics),
    status: "validation-rejected",
  });
}

function conflict(...diagnostics: readonly Diagnostic[]): TransactionConflict {
  return Object.freeze({ diagnostics: frozenDiagnostics(...diagnostics), status: "conflict" });
}

function providerFailure(
  phase: TransactionProviderPhase,
  code: string,
  message: string,
): TransactionProviderFailure {
  return Object.freeze({
    committed: false as const,
    diagnostics: frozenDiagnostics(frozenDiagnostic(code, message)),
    phase,
    status: "provider-failure" as const,
  });
}

function providerFailureWithDiagnostics(
  phase: TransactionProviderPhase,
  diagnostics: readonly Diagnostic[],
): TransactionProviderFailure {
  return Object.freeze({
    committed: false as const,
    diagnostics: frozenDiagnostics(...diagnostics),
    phase,
    status: "provider-failure" as const,
  });
}

function parseOpaqueString<T extends string>(
  value: unknown,
  code: string,
  subject: string,
): Result<T> {
  return typeof value === "string" && value.length > 0 && value.length <= maximumOpaqueCharacters
    ? success(value as T)
    : failure(
        frozenDiagnostic(code, `${subject} must be a bounded nonempty primitive string`, {
          maximumCharacters: maximumOpaqueCharacters,
          receivedType: typeof value,
        }),
      );
}

export function parseContentRevision(value: unknown): Result<ContentRevision> {
  return parseOpaqueString<ContentRevision>(value, "invalid-content-revision", "Content revision");
}

export function parseResourceKey(value: unknown): Result<ResourceKey> {
  return parseOpaqueString<ResourceKey>(value, "invalid-resource-key", "Resource key");
}

function sortedByResource<T extends { readonly resource: ResourceKey }>(
  values: readonly T[],
): readonly T[] {
  let source = new Array<T>(values.length);
  for (let index = 0; index < values.length; index += 1) source[index] = values[index]!;
  let target = new Array<T>(values.length);
  for (let width = 1; width < values.length; width *= 2) {
    for (let start = 0; start < values.length; start += width * 2) {
      const proposedMiddle = start + width;
      const proposedEnd = start + width * 2;
      const middle = proposedMiddle < values.length ? proposedMiddle : values.length;
      const end = proposedEnd < values.length ? proposedEnd : values.length;
      let left = start;
      let right = middle;
      let output = start;
      while (left < middle && right < end) {
        if (source[left]!.resource <= source[right]!.resource) target[output++] = source[left++]!;
        else target[output++] = source[right++]!;
      }
      while (left < middle) target[output++] = source[left++]!;
      while (right < end) target[output++] = source[right++]!;
    }
    const previous = source;
    source = target;
    target = previous;
  }
  return Object.freeze(source);
}

function inspectDenseArray(
  value: unknown,
  code: string,
  subject: string,
  maximum = maximumRevisionCount,
): Result<readonly unknown[]> {
  const length = inspectIntrinsicArrayLength(value, code, subject);
  if (!length.ok) return length;
  if (length.value > maximum) {
    return failure(
      frozenDiagnostic(code, `${subject} exceeds the supported item count`, {
        maximum,
      }),
    );
  }
  try {
    const ownKeys = Reflect.ownKeys(value as object);
    if (ownKeys.length !== length.value + 1) {
      return failure(frozenDiagnostic(code, `${subject} must be dense without extra properties`));
    }
    const copied: unknown[] = [];
    for (let index = 0; index < length.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return failure(
          frozenDiagnostic(code, `${subject} entries must be enumerable data properties`),
        );
      }
      copied[index] = descriptor.value;
    }
    return success(Object.freeze(copied));
  } catch {
    return failure(frozenDiagnostic(code, `${subject} could not be inspected safely`));
  }
}

function parseRevisionEntries(
  value: unknown,
  mode: "expectation" | "revision",
): Result<readonly (ContentRevisionExpectation | ResourceRevision)[]> {
  const code =
    mode === "expectation" ? "invalid-revision-expectations" : "invalid-provider-revisions";
  const subject = mode === "expectation" ? "Revision expectations" : "Provider revisions";
  const inspected = inspectDenseArray(value, code, subject);
  if (!inspected.ok) return inspected;
  const parsed: (ContentRevisionExpectation | ResourceRevision)[] = [];
  for (let index = 0; index < inspected.value.length; index += 1) {
    const entry = inspectExactRecord(
      inspected.value[index],
      [mode === "expectation" ? ["expected", "resource"] : ["resource", "revision"]],
      code,
      `${subject} entry`,
    );
    if (!entry.ok) return entry;
    const resource = parseResourceKey(entry.value.resource);
    if (!resource.ok) return resource;
    const rawRevision = entry.value[mode === "expectation" ? "expected" : "revision"];
    const revision = rawRevision === null ? success(null) : parseContentRevision(rawRevision);
    if (!revision.ok) return revision;
    parsed[index] = Object.freeze(
      mode === "expectation"
        ? { expected: revision.value, resource: resource.value }
        : { resource: resource.value, revision: revision.value },
    );
  }
  const sorted = sortedByResource(parsed);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index - 1]!.resource === sorted[index]!.resource) {
      return failure(
        frozenDiagnostic(
          mode === "expectation" ? "duplicate-revision-expectation" : "duplicate-provider-revision",
          `${subject} must contain each resource exactly once`,
          { resource: sorted[index]!.resource },
        ),
      );
    }
  }
  return success(sorted);
}

function structuralBudget(
  code: string,
  message: string,
  maximumDepth: number,
  maximumValues: number,
): GraphDataStructuralBudget {
  return { code, maximumDepth, maximumValues, message };
}

function parseAffectedIdentities(
  generation: unknown,
  value: unknown,
  maximum: number,
  code: string,
  subject: string,
): Result<AffectedGraphIdentities> {
  const inspected = inspectExactRecord(
    value,
    [[], ["entities"], ["relations"], ["entities", "relations"]],
    code,
    subject,
  );
  if (!inspected.ok) return inspected;
  let total = 0;
  for (const key of ["entities", "relations"] as const) {
    if (!(key in inspected.value)) continue;
    const length = inspectIntrinsicArrayLength(inspected.value[key], code, `${subject} ${key}`);
    if (!length.ok) return length;
    if (length.value > maximum - total) {
      return failure(
        frozenDiagnostic(code, `${subject} exceeds the configured identity count`, { maximum }),
      );
    }
    total += length.value;
  }
  const event = createGraphCommittedEvent(generation, inspected.value);
  return event.ok ? success(event.value.affected) : event;
}

function parseRequest(
  request: unknown,
  maxAffectedIdentities: number,
  dataBudget: GraphDataStructuralBudget,
): Result<ValidatedTransactionRequest> {
  const inspected = inspectExactRecord(
    request,
    [["affected", "context", "expectedRevisions", "mutation"]],
    "invalid-transaction-request",
    "Transaction request",
  );
  if (!inspected.ok) return inspected;
  const expectedRevisions = parseRevisionEntries(inspected.value.expectedRevisions, "expectation");
  if (!expectedRevisions.ok) return expectedRevisions;
  const affected = parseAffectedIdentities(
    0,
    inspected.value.affected,
    maxAffectedIdentities,
    "invalid-transaction-affected-identities",
    "Transaction affected identities",
  );
  if (!affected.ok) return affected;
  const payloads = copyGraphPayloadPair(
    inspected.value.context,
    inspected.value.mutation,
    "transaction",
    dataBudget,
  );
  if (!payloads.ok) return payloads;
  return success(
    Object.freeze({
      affected: affected.value,
      context: payloads.value[0],
      expectedRevisions: expectedRevisions.value as readonly ContentRevisionExpectation[],
      mutation: payloads.value[1],
    }),
  );
}

function sameResources(
  expected: readonly ContentRevisionExpectation[] | readonly ResourceKey[],
  actual: readonly ResourceRevision[],
): boolean {
  if (expected.length !== actual.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    const resource =
      typeof expected[index] === "string"
        ? (expected[index] as ResourceKey)
        : (expected[index] as ContentRevisionExpectation).resource;
    if (resource !== actual[index]!.resource) return false;
  }
  return true;
}

function parseSnapshot(
  value: unknown,
  expected: readonly ContentRevisionExpectation[],
  dataBudget: GraphDataStructuralBudget,
): Result<ValidatedSnapshot> {
  const inspected = inspectExactRecord(
    value,
    [["generation", "revisions", "state"]],
    "invalid-provider-snapshot",
    "Transaction provider snapshot",
  );
  if (!inspected.ok) return inspected;
  const generation = parseGraphGeneration(inspected.value.generation);
  if (!generation.ok) return generation;
  const revisions = parseRevisionEntries(inspected.value.revisions, "revision");
  if (!revisions.ok) return revisions;
  const typedRevisions = revisions.value as readonly ResourceRevision[];
  if (!sameResources(expected, typedRevisions)) {
    return failure(
      frozenDiagnostic(
        "invalid-provider-snapshot",
        "Transaction provider snapshot must contain exactly the requested resources",
      ),
    );
  }
  const state = copyGraphPayload(inspected.value.state, "transaction", dataBudget);
  if (!state.ok) return state;
  return success(
    Object.freeze({ generation: generation.value, revisions: typedRevisions, state: state.value }),
  );
}

function staleDiagnostics(
  expected: readonly ContentRevisionExpectation[],
  actual: readonly ResourceRevision[],
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (let index = 0; index < expected.length; index += 1) {
    if (expected[index]!.expected !== actual[index]!.revision) {
      diagnostics[diagnostics.length] = frozenDiagnostic(
        "content-revision-conflict",
        "Content revision does not match the expected value",
        {
          actualAbsent: actual[index]!.revision === null,
          expectedAbsent: expected[index]!.expected === null,
          resource: expected[index]!.resource,
        },
      );
    }
  }
  return Object.freeze(diagnostics);
}

function parseInvariantDetails(
  value: unknown,
): Result<Readonly<Record<string, string | number | boolean>>> {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return failure(
        frozenDiagnostic("invalid-invariant-result", "Diagnostic details must be a record"),
      );
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return failure(
        frozenDiagnostic("invalid-invariant-result", "Diagnostic details must be a plain record"),
      );
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length > maximumInvariantDetailCount) {
      return failure(
        frozenDiagnostic("invalid-invariant-result", "Diagnostic details contain too many values"),
      );
    }
    const copied: Record<string, string | number | boolean> = Object.create(null) as Record<
      string,
      string | number | boolean
    >;
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      if (typeof key !== "string" || key.length > maximumOpaqueCharacters) {
        return failure(
          frozenDiagnostic("invalid-invariant-result", "Diagnostic detail key is invalid"),
        );
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return failure(
          frozenDiagnostic(
            "invalid-invariant-result",
            "Diagnostic details must use data properties",
          ),
        );
      }
      const detail = descriptor.value;
      if (
        (typeof detail !== "string" || detail.length > maximumOpaqueCharacters) &&
        (typeof detail !== "number" || !Number.isFinite(detail)) &&
        typeof detail !== "boolean"
      ) {
        return failure(
          frozenDiagnostic("invalid-invariant-result", "Diagnostic detail value is invalid"),
        );
      }
      Object.defineProperty(copied, key, { enumerable: true, value: detail });
    }
    return success(Object.freeze(copied));
  } catch {
    return failure(
      frozenDiagnostic(
        "invalid-invariant-result",
        "Diagnostic details could not be inspected safely",
      ),
    );
  }
}

function parseInvariantDiagnostics(value: unknown, invariantId: string): readonly Diagnostic[] {
  const inspected = inspectDenseArray(
    value,
    "invalid-invariant-result",
    `Invariant ${invariantId} diagnostics`,
    maximumInvariantDiagnosticCount,
  );
  if (!inspected.ok) {
    return frozenDiagnostics(
      frozenDiagnostic(
        "invalid-invariant-result",
        "Invariant returned diagnostics with an invalid runtime shape",
        { invariant: invariantId },
      ),
    );
  }
  const diagnostics: Diagnostic[] = [];
  for (let index = 0; index < inspected.value.length; index += 1) {
    const entry = inspectExactRecord(
      inspected.value[index],
      [
        ["code", "message"],
        ["code", "details", "message"],
      ],
      "invalid-invariant-result",
      `Invariant ${invariantId} diagnostic`,
    );
    if (
      !entry.ok ||
      typeof entry.value.code !== "string" ||
      entry.value.code.length === 0 ||
      entry.value.code.length > maximumOpaqueCharacters ||
      typeof entry.value.message !== "string" ||
      entry.value.message.length === 0 ||
      entry.value.message.length > maximumOpaqueCharacters
    ) {
      return frozenDiagnostics(
        frozenDiagnostic(
          "invalid-invariant-result",
          "Invariant returned diagnostics with an invalid runtime shape",
          { invariant: invariantId },
        ),
      );
    }
    let details: Readonly<Record<string, string | number | boolean>> | undefined;
    if ("details" in entry.value) {
      const copied = parseInvariantDetails(entry.value.details);
      if (!copied.ok) {
        return frozenDiagnostics(
          frozenDiagnostic(
            "invalid-invariant-result",
            "Invariant returned diagnostics with an invalid runtime shape",
            { invariant: invariantId },
          ),
        );
      }
      details = copied.value;
    }
    diagnostics[index] = frozenDiagnostic(entry.value.code, entry.value.message, details);
  }
  return Object.freeze(diagnostics);
}

function parsePrepareResult(value: unknown): Result<PreparedProviderResult> {
  const inspected = inspectExactRecord(
    value,
    [
      ["reason", "status"],
      ["status", "token"],
    ],
    "invalid-provider-prepare-result",
    "Transaction provider prepare result",
  );
  if (!inspected.ok) return inspected;
  if (inspected.value.status === "conflict") {
    return inspected.value.reason === "generation" || inspected.value.reason === "revision"
      ? success(Object.freeze({ reason: inspected.value.reason, status: "conflict" as const }))
      : failure(
          frozenDiagnostic(
            "invalid-provider-prepare-result",
            "Transaction provider conflict reason is invalid",
          ),
        );
  }
  if (inspected.value.status !== "prepared") {
    return failure(
      frozenDiagnostic(
        "invalid-provider-prepare-result",
        "Transaction provider prepare status is invalid",
      ),
    );
  }
  const token = parseOpaqueString<string>(
    inspected.value.token,
    "invalid-provider-token",
    "Provider preparation token",
  );
  return token.ok
    ? success(Object.freeze({ status: "prepared" as const, token: token.value }))
    : token;
}

function parseConfirmedResult(
  value: unknown,
  generation: GraphGeneration,
  resources: readonly ResourceKey[],
  maxAffectedIdentities: number,
  phase: "commit" | "recovery",
  expectedAffected?: AffectedGraphIdentities,
): Result<ConfirmedProviderResult> {
  const code =
    phase === "commit" ? "invalid-provider-commit-result" : "invalid-provider-recovery-result";
  const inspected = inspectExactRecord(
    value,
    [["affected", "generation", "revisions", "status"], ["status"]],
    code,
    `Transaction provider ${phase} result`,
  );
  if (!inspected.ok) return inspected;
  const hasCommittedFields = "affected" in inspected.value;
  if (!hasCommittedFields) {
    if (inspected.value.status === "not-committed" || inspected.value.status === "indeterminate") {
      return success(Object.freeze({ status: inspected.value.status }));
    }
    return failure(frozenDiagnostic(code, `Transaction provider ${phase} status is invalid`));
  }
  if (inspected.value.status !== "committed") {
    return failure(
      frozenDiagnostic(code, `Transaction provider ${phase} result fields do not match its status`),
    );
  }
  const affected = parseAffectedIdentities(
    generation,
    inspected.value.affected,
    maxAffectedIdentities,
    code,
    `Transaction provider ${phase} affected identities`,
  );
  if (!affected.ok) {
    return failure(
      frozenDiagnostic(code, `Transaction provider ${phase} returned invalid affected identities`),
    );
  }
  if (
    expectedAffected !== undefined &&
    (!sameStrings(expectedAffected.entities, affected.value.entities) ||
      !sameStrings(expectedAffected.relations, affected.value.relations))
  ) {
    return failure(
      frozenDiagnostic(
        code,
        `Transaction provider ${phase} affected identities do not match the prepared transaction`,
      ),
    );
  }
  const confirmedGeneration = parseGraphGeneration(inspected.value.generation);
  if (!confirmedGeneration.ok || confirmedGeneration.value !== generation) {
    return failure(
      frozenDiagnostic(code, `Transaction provider ${phase} confirmed an unexpected generation`),
    );
  }
  const revisions = parseRevisionEntries(inspected.value.revisions, "revision");
  if (!revisions.ok) return revisions;
  const typedRevisions = revisions.value as readonly ResourceRevision[];
  if (!sameResources(resources, typedRevisions)) {
    return failure(
      frozenDiagnostic(
        code,
        `Transaction provider ${phase} revisions do not match the transaction resources`,
      ),
    );
  }
  return success(
    Object.freeze({
      affected: affected.value,
      generation: confirmedGeneration.value,
      revisions: typedRevisions,
      status: "committed" as const,
    }),
  );
}

function makeRecovery(
  baseGeneration: GraphGeneration,
  generation: GraphGeneration,
  resources: readonly ResourceKey[],
  token: string,
): TransactionRecovery {
  return Object.freeze({ baseGeneration, generation, resources, token });
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function indeterminate(
  recovery: TransactionRecovery,
  code: string,
  message: string,
): TransactionIndeterminate {
  return Object.freeze({
    diagnostics: frozenDiagnostics(frozenDiagnostic(code, message)),
    recovery,
    status: "indeterminate" as const,
  });
}

function committed(
  affected: AffectedGraphIdentities,
  generation: GraphGeneration,
  revisions: readonly ResourceRevision[],
): TransactionCommitted {
  const event: GraphCommittedEvent = Object.freeze({
    affected,
    generation,
    type: "graph.committed",
  });
  return Object.freeze({
    event,
    generation,
    revisions,
    status: "committed" as const,
  });
}

function parseRecovery(value: unknown): Result<TransactionRecovery> {
  const inspected = inspectExactRecord(
    value,
    [["baseGeneration", "generation", "resources", "token"]],
    "invalid-transaction-recovery",
    "Transaction recovery request",
  );
  if (!inspected.ok) return inspected;
  const baseGeneration = parseGraphGeneration(inspected.value.baseGeneration);
  if (!baseGeneration.ok) return baseGeneration;
  const generation = parseGraphGeneration(inspected.value.generation);
  if (!generation.ok) return generation;
  const expectedGeneration = nextGraphGeneration(baseGeneration.value);
  if (!expectedGeneration.ok || expectedGeneration.value !== generation.value) {
    return failure(
      frozenDiagnostic(
        "invalid-transaction-recovery",
        "Recovery generation must be exactly one greater than its base generation",
      ),
    );
  }
  const token = parseOpaqueString<string>(
    inspected.value.token,
    "invalid-provider-token",
    "Provider preparation token",
  );
  if (!token.ok) return token;
  const resourceValues = inspectDenseArray(
    inspected.value.resources,
    "invalid-transaction-recovery",
    "Transaction recovery resources",
  );
  if (!resourceValues.ok) return resourceValues;
  const resources: ResourceKey[] = [];
  for (let index = 0; index < resourceValues.value.length; index += 1) {
    const resource = parseResourceKey(resourceValues.value[index]);
    if (!resource.ok) return resource;
    resources[index] = resource.value;
  }
  const resourceEntries: { readonly resource: ResourceKey }[] = [];
  for (let index = 0; index < resources.length; index += 1) {
    resourceEntries[index] = { resource: resources[index]! };
  }
  const sortedEntries = sortedByResource(resourceEntries);
  const sortedResources: ResourceKey[] = [];
  for (let index = 0; index < sortedEntries.length; index += 1) {
    sortedResources[index] = sortedEntries[index]!.resource;
  }
  if (sortedResources.length !== resources.length) {
    return failure(
      frozenDiagnostic("invalid-transaction-recovery", "Recovery resources are invalid"),
    );
  }
  for (let index = 0; index < sortedResources.length; index += 1) {
    if (
      sortedResources[index] !== resources[index] ||
      sortedResources[index] === sortedResources[index - 1]
    ) {
      return failure(
        frozenDiagnostic(
          "invalid-transaction-recovery",
          "Recovery resources must already be sorted and unique",
        ),
      );
    }
  }
  return success(
    makeRecovery(baseGeneration.value, generation.value, Object.freeze(resources), token.value),
  );
}

export class TransactionEngine {
  readonly #invariants: RegisteredInvariant[] = [];
  readonly #maxAffectedIdentities: number;
  readonly #provider: TransactionProvider;
  readonly #requestDataBudget: GraphDataStructuralBudget;
  readonly #snapshotStateBudget: GraphDataStructuralBudget;

  constructor(options: TransactionEngineOptions) {
    validatePositiveBudget(options.maxAffectedIdentities, "maxAffectedIdentities");
    validatePositiveBudget(options.maxRequestDataDepth, "maxRequestDataDepth");
    validatePositiveBudget(options.maxRequestDataValues, "maxRequestDataValues");
    validatePositiveBudget(options.maxSnapshotStateDepth, "maxSnapshotStateDepth");
    validatePositiveBudget(options.maxSnapshotStateValues, "maxSnapshotStateValues");
    this.#maxAffectedIdentities = options.maxAffectedIdentities;
    this.#provider = options.provider;
    this.#requestDataBudget = Object.freeze(
      structuralBudget(
        "transaction-request-too-large",
        "Transaction context and mutation exceed the configured structural budget",
        options.maxRequestDataDepth,
        options.maxRequestDataValues,
      ),
    );
    this.#snapshotStateBudget = Object.freeze(
      structuralBudget(
        "transaction-snapshot-state-too-large",
        "Transaction provider state exceeds the configured structural budget",
        options.maxSnapshotStateDepth,
        options.maxSnapshotStateValues,
      ),
    );
  }

  registerInvariant(invariant: TransactionInvariant): Result<void>;
  registerInvariant(invariant: unknown): Result<void> {
    const inspected = inspectExactRecord(
      invariant,
      [["id", "validate"]],
      "invalid-transaction-invariant",
      "Transaction invariant",
    );
    if (!inspected.ok) return inspected;
    const id = parseOpaqueString<string>(
      inspected.value.id,
      "invalid-invariant-id",
      "Invariant identity",
    );
    if (!id.ok) return id;
    if (typeof inspected.value.validate !== "function") {
      return failure(
        frozenDiagnostic(
          "invalid-transaction-invariant",
          "Transaction invariant validate must be callable",
        ),
      );
    }
    for (let index = 0; index < this.#invariants.length; index += 1) {
      if (this.#invariants[index]!.id === id.value) {
        return failure(
          frozenDiagnostic(
            "duplicate-invariant-id",
            "Transaction invariant identities must be unique",
            {
              invariant: id.value,
            },
          ),
        );
      }
    }
    this.#invariants[this.#invariants.length] = Object.freeze({
      id: id.value,
      validate: inspected.value.validate as (proposal: ProposedTransaction) => unknown,
    });
    return success(undefined);
  }

  async execute(request: TransactionRequest): Promise<TransactionOutcome> {
    const validatedRequest = parseRequest(
      request,
      this.#maxAffectedIdentities,
      this.#requestDataBudget,
    );
    if (!validatedRequest.ok) return validationRejected(...validatedRequest.diagnostics);
    const invariantCopy = new Array<RegisteredInvariant>(this.#invariants.length);
    for (let index = 0; index < this.#invariants.length; index += 1) {
      invariantCopy[index] = this.#invariants[index]!;
    }
    const invariants = Object.freeze(invariantCopy);
    const resourceCopy = new Array<ResourceKey>(validatedRequest.value.expectedRevisions.length);
    for (let index = 0; index < validatedRequest.value.expectedRevisions.length; index += 1) {
      resourceCopy[index] = validatedRequest.value.expectedRevisions[index]!.resource;
    }
    const resources = Object.freeze(resourceCopy);

    let snapshotInput: unknown;
    try {
      const snapshot = this.#provider.snapshot;
      if (typeof snapshot !== "function") {
        return providerFailure(
          "snapshot",
          "missing-provider-capability",
          "Transaction provider does not supply a snapshot capability",
        );
      }
      snapshotInput = await Reflect.apply(snapshot, this.#provider, [resources]);
    } catch {
      return providerFailure(
        "snapshot",
        "provider-snapshot-failed",
        "Transaction provider failed before a transaction was prepared",
      );
    }
    const snapshot = parseSnapshot(
      snapshotInput,
      validatedRequest.value.expectedRevisions,
      this.#snapshotStateBudget,
    );
    if (!snapshot.ok) {
      return providerFailureWithDiagnostics("snapshot", snapshot.diagnostics);
    }

    const stale = staleDiagnostics(
      validatedRequest.value.expectedRevisions,
      snapshot.value.revisions,
    );
    if (stale.length > 0) return conflict(...stale);

    const generation = nextGraphGeneration(snapshot.value.generation);
    if (!generation.ok) return validationRejected(...generation.diagnostics);
    const proposal: ProposedTransaction = Object.freeze({
      affected: validatedRequest.value.affected,
      baseGeneration: snapshot.value.generation,
      context: validatedRequest.value.context,
      expectedRevisions: validatedRequest.value.expectedRevisions,
      generation: generation.value,
      mutation: validatedRequest.value.mutation,
      priorState: snapshot.value.state,
    });

    const invariantDiagnostics: Diagnostic[] = [];
    for (let index = 0; index < invariants.length; index += 1) {
      const invariant = invariants[index]!;
      try {
        const returned = Reflect.apply(invariant.validate, undefined, [proposal]);
        const diagnostics = parseInvariantDiagnostics(returned, invariant.id);
        for (let diagnosticIndex = 0; diagnosticIndex < diagnostics.length; diagnosticIndex += 1) {
          invariantDiagnostics[invariantDiagnostics.length] = diagnostics[diagnosticIndex]!;
        }
      } catch {
        invariantDiagnostics[invariantDiagnostics.length] = frozenDiagnostic(
          "invariant-threw",
          "Transaction invariant threw instead of returning diagnostics",
          { invariant: invariant.id },
        );
      }
    }
    if (invariantDiagnostics.length > 0) return validationRejected(...invariantDiagnostics);

    let prepareInput: unknown;
    try {
      const prepare = this.#provider.prepare;
      if (typeof prepare !== "function") {
        return providerFailure(
          "prepare",
          "missing-provider-capability",
          "Transaction provider does not supply a prepare capability",
        );
      }
      prepareInput = await Reflect.apply(prepare, this.#provider, [proposal]);
    } catch {
      return providerFailure(
        "prepare",
        "provider-prepare-failed",
        "Transaction provider failed before canonical commit began",
      );
    }
    const prepared = parsePrepareResult(prepareInput);
    if (!prepared.ok) {
      return providerFailure(
        "prepare",
        "invalid-provider-prepare-result",
        "Transaction provider returned an invalid prepare result",
      );
    }
    if (prepared.value.status === "conflict") {
      return conflict(
        frozenDiagnostic(
          prepared.value.reason === "generation"
            ? "concurrent-generation-conflict"
            : "content-revision-conflict",
          "Transaction became stale while it was being prepared",
        ),
      );
    }

    const recovery = makeRecovery(
      proposal.baseGeneration,
      proposal.generation,
      resources,
      prepared.value.token,
    );
    let commitInput: unknown;
    try {
      const commit = this.#provider.commit;
      if (typeof commit !== "function") {
        return indeterminate(
          recovery,
          "missing-provider-capability",
          "Transaction provider cannot confirm whether the prepared transaction committed",
        );
      }
      commitInput = await Reflect.apply(commit, this.#provider, [prepared.value.token]);
    } catch {
      return indeterminate(
        recovery,
        "provider-commit-indeterminate",
        "Transaction provider did not confirm whether the prepared transaction committed",
      );
    }
    const confirmed = parseConfirmedResult(
      commitInput,
      proposal.generation,
      resources,
      this.#maxAffectedIdentities,
      "commit",
      proposal.affected,
    );
    if (!confirmed.ok) {
      return indeterminate(
        recovery,
        "invalid-provider-commit-result",
        "Transaction provider returned an invalid result after canonical commit began",
      );
    }
    if (confirmed.value.status === "not-committed") {
      return providerFailure(
        "commit",
        "provider-commit-not-committed",
        "Transaction provider confirmed that the prepared transaction did not commit",
      );
    }
    if (confirmed.value.status === "indeterminate") {
      return indeterminate(
        recovery,
        "provider-commit-indeterminate",
        "Transaction provider could not determine whether the prepared transaction committed",
      );
    }
    return committed(confirmed.value.affected, proposal.generation, confirmed.value.revisions);
  }

  async recover(recoveryInput: TransactionRecovery): Promise<TransactionOutcome> {
    const parsed = parseRecovery(recoveryInput);
    if (!parsed.ok) return validationRejected(...parsed.diagnostics);
    let recoveredInput: unknown;
    try {
      const recover = this.#provider.recover;
      if (typeof recover !== "function") {
        return indeterminate(
          parsed.value,
          "missing-provider-capability",
          "Transaction provider cannot recover the uncertain transaction",
        );
      }
      recoveredInput = await Reflect.apply(recover, this.#provider, [parsed.value.token]);
    } catch {
      return indeterminate(
        parsed.value,
        "provider-recovery-indeterminate",
        "Transaction provider could not resolve the uncertain transaction",
      );
    }
    const recovered = parseConfirmedResult(
      recoveredInput,
      parsed.value.generation,
      parsed.value.resources,
      this.#maxAffectedIdentities,
      "recovery",
    );
    if (!recovered.ok || recovered.value.status === "indeterminate") {
      return indeterminate(
        parsed.value,
        !recovered.ok ? "invalid-provider-recovery-result" : "provider-recovery-indeterminate",
        "Transaction provider could not resolve the uncertain transaction",
      );
    }
    if (recovered.value.status === "not-committed") {
      return providerFailure(
        "recovery",
        "provider-recovery-not-committed",
        "Transaction provider confirmed that the uncertain transaction did not commit",
      );
    }
    return committed(recovered.value.affected, parsed.value.generation, recovered.value.revisions);
  }
}
