# Automatic-blueprint aha benchmark

This document defines the Iteration 2 quality gate for the first useful Groma experience:

```text
groma init
groma scan
groma
```

The benchmark asks whether those three commands produce an understandable, locally owned,
evidence-grounded main layer within one minute. It deliberately does not define scanner output,
canonical Groma state, reconciliation, or renderer data. The verification-only contract in
[`tests/iteration-2/automatic-blueprint/`](../tests/iteration-2/automatic-blueprint/) records an
assessment of those later systems without becoming a production import.

## What is scored

An automatic blueprint may claim only architecture that a scanner can defend from observable
project evidence. The reference audits use five evidence categories:

- workspace, package, and major production source boundaries;
- public actions such as CLI commands;
- aggregate cross-boundary dependencies;
- Bun routes, including a carefully scoped absence when the complete production tree supports it;
- documentation evidence, identified as documentation rather than source observation.

Names from package metadata, literal import edges, route patterns, and explicit command
registrations are observable. Business responsibilities, conceptual domains, ownership, desired
state, and prose explanations are curated intent. Directory nesting does not by itself prove
conceptual containment. Documentation may corroborate a label or public promise, but a scanner
must retain that provenance and must not silently promote the prose to observed intent.

The audits assign their own `audit.*` fact IDs. Those IDs are benchmark bookkeeping only. They are
not scanner keys, observation IDs, canonical component IDs, or expected renderer node IDs. A
human assessor maps preserved scanner evidence to audit facts after a run; production code must
never recognize the IDs.

Historic hand-curated component, relationship, and root counts are comparison context, not
ground truth. A passing automatic map is not required to reproduce curated names, prose, counts,
or containment.

## Immutable reference audits

Each audit records a full Git commit and tree plus workspace-relative source witnesses. A witness
contains the Git blob ID, a SHA-256 content digest, and a bounded line anchor. Every complete-tree
absence or exact-set fact also records the included and excluded production scope, protected source
roots, the scoped path count and path-inventory digest, and a derivation method whose result digest
binds the ordered fact objects. The combination distinguishes a representative source excerpt from
the complete scope used to derive the fact. This makes an audit reviewable without treating the
current checkout or a self-updating golden as truth.

Source-scope patterns use forward-slash Git paths, with `**` matching zero or more complete path
segments. The inventory is every pinned-tree blob matched by an include and no exclusion, sorted in
ascending UTF-8 byte order. `pathInventorySha256` hashes the UTF-8 bytes of that inventory's
whitespace-free JSON string array, using ECMAScript `JSON.stringify` string escaping with no
replacer. Fact `derivation.resultSha256` uses the same encoding for the ordered `claim.objects`
array; `createBenchmarkStringArrayDigest` is the executable reference helper. The stored counts and
digests therefore make complete-tree and exact-set claims reproducible without embedding thousands
of paths in the audit.

The initial references are:

| Audit                   | Revision                                   | Role                                  |
| ----------------------- | ------------------------------------------ | ------------------------------------- |
| Groma                   | `66fe7c616ccb06f8dbd52cafef006cc77f864217` | Known project and self-scan reference |
| Backlog.md `v1.48.0^{}` | `da0784d41ad3807fdc34e5501afe3fa950deff94` | Held-out TypeScript/Bun reference     |

The Backlog.md tag points to package metadata version `1.47.1`; the audit records both facts
instead of rewriting one to resemble the other. The reference is public and reproducible, not
secret or externally sealed.

Refreshing an audit is a deliberate review event:

1. select and record a new immutable commit and tree;
2. inspect production source from Git objects, excluding the declared non-production scope;
3. re-audit every category, forbidden claim, witness digest, and comprehension question;
4. review the audit change independently from scanner output;
5. never update expected facts from the scanner's own result.

## Held-out reservation

Backlog.md is reserved from scanner-specific tuning even though its audit is committed for
reproducibility. Before starting a held-out run or seeing any scored result from one, freeze the
scanner implementation, configuration, and generic rules. Project names, repository paths, audit
IDs, known route names, or other one-project exceptions are prohibited in scanner code and
configuration.

Scored output may diagnose a failure, but it may not be fed back into scanner tuning. A proposed
generic improvement must first be justified and tested on non-held-out fixtures. Only then may a
new frozen scanner be evaluated in a new held-out run. This is procedural holdout discipline, not
a claim that the committed public repository is unknowable.

## Hermetic execution record

GROM-48 will implement the black-box runner. The runner must produce the neutral assessment
record consumed by this benchmark and enforce these controls:

1. Complete the human ground-truth audit before the run. For the held-out project, freeze scanner
   code, configuration, and generic rules before starting the held-out run or receiving its scored
   results.
2. Copy the pinned project to a fresh workspace. Before spawning the first command, freeze a
   pre-run plan containing the path convention, the complete Groma-owned output inventory, the
   identical source-hash exclusion inventory, and the renderer-declared main-layer budget. Record
   its monotonic freeze time and SHA-256 commitment. Hash source bytes before execution while
   excluding exactly that inventory.
3. Create distinct temporary `HOME` and configuration roots, close stdin for every command, and
   deny network access at the OS or harness boundary. An application promise to stay offline is
   not sufficient.
4. Start the monotonic timer immediately before spawning `groma init`. Invoke exactly
   `groma init`, `groma scan`, and `groma`, as separate commands and in that order. Preserve each
   argument vector, exit code, stdout, and stderr.
5. Permit no AI call, helper inference, or human correction from the first spawn through scored
   output. The scanner remains blind to the audit and existing blueprint.
6. Stop the timer only when the initial main layer emits a machine-observable frozen signal.
   Freeze its artifact and all scored outputs before any evaluator sees them.
7. Hash source bytes again with the exact same exclusions. The before and after hashes must match.
8. Perform the evidence assessment and human-comprehension evaluation against the frozen outputs.

A human may prepare the ground-truth audit before execution and evaluate comprehension after the
output is frozen. Neither activity is an allowed correction inside the timed generation path.

The one-minute interval is exact: from spawning `groma init` through the frozen initial main
layer, at most `60,000` milliseconds. Setup before the spawn and human evaluation after the freeze
do not count. A process failure cannot be hidden by a later artifact.

The execution record declares whether host absolute temporary roots use POSIX or Win32 syntax.
Both temporary roots must be normalized, absolute, non-root, and disjoint under the declared
platform's comparison rules: neither root may equal, contain, or be contained by the other.
Groma-owned output and exclusion paths use one portable syntax on every platform: sorted, exact,
nonempty, forward-slash workspace descendants with no trailing slash, `.` or `..` segment, drive
prefix, backslash, glob metacharacter, or other reserved filename character. Prefixes and globs do
not stand in for exact inventory entries. Neither the committed nor recorded output inventory may
equal, contain, or be an ancestor of an audit's protected source root under the declared platform's
path-comparison rules, so `src` or its Win32 case aliases cannot erase the production tree from
mutation detection.

The plan commitment is SHA-256 over UTF-8 bytes of whitespace-free JSON with this exact key order:
`gromaOwnedOutputPaths`, `pathConvention`, `rendererDeclaredMainLayerBudget` (`nodes`, then
`relationships`), `schemaVersion`, and `sourceHashExcludedPaths`. Arrays retain their already
validated ascending UTF-8 byte order. The commitment and freeze time are record metadata and are
not inputs to the digest. The runner must compare the committed plan to the scored execution and
presentation record so neither exclusions nor the density budget can be chosen after output is
known.

## Repeatability and identity

The runner performs at least two unchanged rescans from the same input. It preserves separate
digests for:

- raw observation sequence ordering;
- raw observation content;
- stable observation identities;
- stable canonical identities after reconciliation;
- exact canonical bytes.

All values in each series must remain identical. Combining these checks into one digest would
hide whether ordering, observed content, identity, or canonical serialization drifted, so the
contract keeps them separate.

Stable audit fact IDs do not satisfy the identity checks. The runner hashes the scanner and Groma
identities actually emitted by the system under test.

## False claims, coverage, and provenance

A false claim assessment retains the claim text and raw evidence that caused the assessor to mark
it false. It may link to predeclared audit forbidden-claim IDs; every supplied link must resolve,
and the audit's severity takes precedence over the run's bucket. A claim placed in the noncritical
bucket is therefore still critical when it links to a critical forbidden claim. An exact match for
predeclared forbidden text inherits that severity even if the link was omitted. Critical false
claims include invented business meaning, fabricated relationships, incorrect major boundaries,
and unsupported implemented surfaces. Explicit uncertainty is not a false claim when the map does
not assert the missing meaning.

Passing requires zero critical false claims and complete coverage of every audit fact marked
`required`. In particular, the audited major workspace/package/source boundaries and their
aggregate cross-boundary dependencies are conjunctive gates. A high score elsewhere cannot
compensate for missing either one.

Every in-scope automatic claim, including a claim later assessed as false, must have a valid source
witness. Assessed and false claim IDs are globally unique and disjoint. Provenance is complete only
when the complete emitted in-scope claim inventory and the IDs with valid witnesses are the same
nonempty set.
Documentation-derived claims retain a documentation provenance kind. Raw scanner evidence remains
available alongside the assessment rather than being replaced by the score.

## Bounded initial main layer

The renderer commits its own node and relationship budgets for the initial main layer in the
pre-run plan. The benchmark requires positive declared limits, verifies that the scored declaration
matches the commitment, and verifies that the frozen layer stays within them. It does not choose
numeric production budgets: the renderer prototype and later density work own that product
decision.

Focus, expansion, folding, and detail views may exist, but they are unavailable during initial
comprehension scoring. The first frozen layer must expose at least one uncertainty or coverage gap
using text, shape, or both. Color may reinforce the signal but cannot be its only carrier. These
are presentation checks only; budget and view state never enter canonical meaning.

## Unaided comprehension

After the artifact is frozen, an evaluator with no prior knowledge of the project answers the
audit's predeclared questions. The evaluator receives only the frozen initial main layer: no agent,
raw JSON, source tree, focus view, expansion, evidence panel, or prose explanation.

All required questions must be answered correctly with no critical misunderstanding. Questions
cover the major boundaries, their cross-boundary relationships, and the observable public
surfaces. The benchmark records the material shown, question IDs answered, correct IDs, and any
critical misunderstanding. It does not collect or score invented architectural prose.

## Score and conjunctive pass gates

The score is diagnostic and totals 100 points:

| Dimension                                                     | Points |
| ------------------------------------------------------------- | -----: |
| False claims                                                  |     20 |
| Required observable-fact coverage                             |     20 |
| Raw repeatability                                             |     10 |
| Observation identity, canonical identity, and canonical bytes |     15 |
| Provenance                                                    |     10 |
| First-minute completion                                       |     10 |
| Presentation budget and visible uncertainty                   |      5 |
| Unaided comprehension                                         |     10 |

`passed` is true only when every applicable gate passes. The scorer emits stable failure codes and
evidence for all failures in a fixed order; it does not stop at the first one. This prevents strong
coverage, speed, or presentation from compensating for a critical false claim, unstable identity,
mutated source, network access, hidden uncertainty, or failed comprehension.

The verification-only tests validate both immutable audits and independently break every pass
gate. Run them with:

```sh
bun test tests/iteration-2/automatic-blueprint
```

The normal `bun run check` also discovers these tests and checks this document and the JSON audits
through the repository's existing formatting scope.

## Non-goals

This benchmark does not:

- define scanner or reconciliation schemas;
- implement `groma scan`, the CLI workflow, a renderer, or the GROM-48 release harness;
- choose main-layer, focus, or expansion numeric budgets;
- define organization-scale fixtures;
- write canonical Groma state or presentation coordinates;
- infer intent from documentation or source layout;
- update its own expected facts from a scanner result.
