# The Groma Manifesto

Groma is a local-first architectural blueprint for humans and AI agents. It is where
a team writes down what its system is meant to be — which parts exist, why they
exist, how they relate, and what they should become — and where later scans show
whether the code still matches that intent. It gives large, mixed-technology
projects one shared language for understanding a system.

Groma's purpose is not to redraw source code as a diagram. It preserves the
architecture people intended, while continuously checking that intent against
evidence collected from the code being built.

## The Product Promise

Groma must become useful before it becomes comprehensive. The first successful
experience is a short local loop:

```text
groma init
groma scan
groma
```

The result is a bounded visual blueprint — a map small enough to take in — that a
person can understand without asking an agent to translate raw data. It is a
starting point grounded in evidence, not a claim that scanning can invent intent. A
person or agent then defines and improves the intended architecture, delegates the
implementation work to external tools, and relies on later scans to expose drift
without erasing meaning.

Visual understanding is part of the core product loop, not presentation added after
the model is complete. Correctness work should protect this loop. Generality,
extension breadth, and extreme-scale optimization come after the first useful
vertical slice, unless they are required to preserve a named invariant.

## The First Users

**Humans and agents are both first-class users.** They work through the same model
and the same semantic operations. Groma does not assign different meanings,
permissions, or trust levels based on whether a change came from a person or an
agent.

Consequences:

- A person can understand, inspect, and edit a blueprint without an AI agent.
- An agent can use the same supported interfaces without depending on private
  implementation APIs.
- Agent approval, supervision, and permissions remain outside Groma.
- The resulting architecture must stay understandable to the people responsible
  for it.

## The Core Loop

```text
observe -> reconcile -> understand -> plan -> implement externally -> verify -> preserve
```

- **Observe:** scanners report deterministic evidence about what exists in the code.
- **Reconcile:** Groma joins new evidence with existing identity and intent without
  destroying curated meaning.
- **Understand:** humans and agents explore the current architectural graph.
- **Plan:** plans describe a desired future architecture without prescribing the
  implementation steps.
- **Implement externally:** Backlog.md and other tools coordinate the work required
  to move between architectural states.
- **Verify:** scanners and comparisons show whether the implementation satisfies the
  intended architecture.
- **Preserve:** readable canonical files and Git retain the reasoning and evolution.

## Intent and Evidence

The central distinction in Groma is **intent versus evidence**. Intent is what
people mean; evidence is what scanners see. Groma stores both, side by side, and
never lets one silently overwrite the other.

Intent explains meaning:

- responsibilities and descriptions;
- conceptual boundaries and recursive containment;
- inputs, outputs, and actions;
- declared relationships;
- lifecycle and desired state.

Every canonical architectural entity in the standard model is a **component**. A
**node** is something drawn in a picture; it may show one component or a folded,
derived view of several. Node is a drawing concept, not a second kind of entity.

A component has an open type token (any short word, such as `service` or `domain`)
and zero or one structural parent. Components without a parent are the roots of the
blueprint; every other component belongs to exactly one parent. Parents may contain
any number of components of the same or different types, recursively. Containment
can never form a cycle, and it is separate from the component's other many-to-many
relationships. The blueprint itself is simply the workspace around these roots, not
another required entity. A domain is an ordinary root component with a `domain`
type, not a special container.

Type stays open, but the official vocabulary may recommend small, legible tokens.
`external` is the conventional type for a system the blueprint depends on but does
not own. An external system is still an ordinary component with intent and
relationships; it needs no special graph primitive.

A component's structured meaning is deliberately limited to **intent, inputs, outputs,
actions, and relationships**. Name, type, and parent are small identity and structural
metadata. Three optional recognition fields — a short
label, a one-sentence summary, and an `iconDomain` favicon-domain hint — help people
recognize a component at a glance; they are not a separate taxonomy or a
questionnaire. When a node shows one component, its display text is the short label
if present, otherwise the name, otherwise the stable canonical component ID. When
`iconDomain` is present, a renderer uses it only to derive a deterministic,
self-contained domain badge, monogram, or text hint. It never fetches a favicon or
makes any network request, and `iconDomain` never determines identity, evidence, or
trust. Any icon-resolution capability is separate from rendering and requires explicit
user action and a privacy policy.

Requirements are expressed through relationships. Important failures and events are
inputs or outputs. State, guarantees, triggers, and effects stay readable intent
prose until repeated real use proves they need structure of their own. This small
model is a product constraint: nobody should have to complete an architectural
questionnaire before a component becomes useful.

Evidence explains what a source currently observes:

- packages and exports;
- routes and contracts;
- events and dependencies;
- deployments or other technology-specific facts.

Scanners observe. Groma reconciles. Humans and agents curate meaning.

A scanner may propose candidates, but it never receives the existing blueprint and
never edits canonical state directly. Groma alone owns stable identity, evidence
bindings, conceptual overrides, and reconciliation. Missing evidence must never
erase intent: a scan that fails to see something is not proof that it is gone.

Scanner contributions are always partial. A scanner reports only the component
candidates, inputs, outputs, actions, or relationships it can defend as direct
observations. It is never required to fill in every part of the component model or
to infer state, guarantees, business requirements, or architectural prose.

## The Source of Truth

The official distribution stores canonical state as deterministic, human-readable
Markdown under `groma/`. "Canonical" means: this is the real copy — everything else
can be rebuilt from it.

- Intent, evidence, bindings, aliases, and plans are durable canonical records.
- Disposable projections (indexes and caches) may speed up search and traversal,
  but they must always be fully reconstructable from canonical state.
- Layout coordinates, folded groups, zoom state, colors, themes, and other renderer
  choices are never canonical architectural state.
- Paths and names are not identity.
- Stable opaque IDs survive moves, renames, merges, and implementation changes.
- Git is optional to the abstract architecture, but the official distribution
  treats it as the history and review layer.
- No hosted service, account, or telemetry is required for the core workflow.

Storage formats are provider concerns, not assumptions baked into Groma Core. Other
host profiles may use other canonical stores as long as they preserve the same
invariants.

## Time

Groma has a deliberately small model of time:

- **Past:** Git revisions of the canonical blueprint.
- **Present:** the current reconciled blueprint.
- **Future:** ordered desired-state plans.

Plans describe what should become true, never a list of implementation commands.
Groma does not apply plans and does not manage the tasks required to realize them.

## Surface Hierarchy

Every surface expresses one shared application model.

1. **Shared application operations** define the semantic reads and mutations.
2. **The CLI** provides the complete automation and agent-facing workflow.
3. **The web interface** is the primary human experience for navigating and editing
   the blueprint.
4. **Scanners** are one-way producers of observations, never an alternative way to
   mutate the blueprint.

Bare `groma` is the shortest human entry point to the blueprint. In an interactive
terminal it reconstructs and opens a disposable local visual from bounded shared
reads. Automation and nonvisual use stay within the CLI's bounded structured or
terminal views. The web interface is the complete human navigation and editing
surface. The local artifact makes no network request, uploads nothing by default,
and never becomes a mutation surface. Terminal, local-artifact, and web behavior
must remain semantically equivalent, and none of them may bypass shared operations
or transactions.

## Plugin Posture

Groma is a small portable core surrounded by plugins.

Core owns only technology-neutral contracts and invariants: graph identity,
transactions, reconciliation guarantees, observation sessions, events, queries, and
plugin composition.

Everything technology- or surface-specific lives outside Core, including:

- filesystems and configuration formats;
- Markdown, SQLite, and Git;
- component-model policy;
- scanners and matchers;
- the CLI, application service, and web interface.

Official built-in plugins use the same runtime plugin API exposed to third parties.
Bootstrap capabilities are explicit rather than hidden special cases. Plugins may
add capabilities, but they may not bypass Core transactions or weaken registered
invariants.

Groma distinguishes a distributable **package** from a runtime **plugin**. A
package may contain several selectively enabled plugins, and every plugin declares
the capabilities it contributes. Installing, enabling, and loading are separate
steps.

Plugins execute as trusted code with the user's full permissions. Groma must say
that plainly and require explicit trust before executing project-provided code.
Declared capabilities explain behavior; they are not a security sandbox.

Any plugin capable of changing canonical blueprint meaning or evidence must be
declared and reproducibly pinned by the blueprint. Personal plugins may improve
presentation or local workflows, but they must not silently change shared canonical
behavior. Groma manages its own plugin packages and never mutates the
package-manager files of the projects it observes.

## Design Principles

1. **Intent over implementation detail.** A blueprint explains why a part exists
   and how it participates in the system, not which syntax implements it.
2. **One model for humans and agents.** No agent-only meanings or hidden workflows.
3. **Scanner blindness.** Observation producers never inspect or reorganize the
   existing blueprint.
4. **Meaning survives evidence changes.** Renames, deletions, and failed scans do
   not silently destroy curated intent.
5. **Local ownership.** Users own readable canonical state and can work without a
   service.
6. **Deterministic and Git-friendly.** Stable identity, ordering, serialization,
   and focused files make changes reviewable.
7. **Fail closed on ambiguity.** When identity is uncertain, never guess an entity,
   binding, merge, or plan target — stop instead.
8. **One semantic path.** CLI, web, and plugins use shared operations and
   validation.
9. **Progressive disclosure and scale.** The main visual layer stays intentionally
   dense but bounded. Focus, expansion, and detail views reveal deeper components
   without loading or laying out the whole world.
10. **Portability through contracts.** Operating-system and storage concerns stay
    behind replaceable capabilities.
11. **Desired state, not work orchestration.** Groma explains architectural change;
    external tools coordinate its implementation.
12. **Simplicity earns adoption.** Add abstractions only when they preserve a real
    invariant or enable a proven extension.
13. **The useful vertical slice comes first.** Prefer the smallest complete path
    from observation to understandable blueprint over finishing generalized
    infrastructure that users cannot yet experience.

## Boundaries

Groma is not:

- implementation documentation or a source-code browser;
- UML generated once and allowed to drift;
- a task manager or agent orchestration system;
- an approval, permission, or proposal workflow;
- a plan executor or code generator;
- a hosted architecture service that owns user data;
- tied to one language, framework, operating system, or storage provider;
- a canvas that tries to render an entire organization at once.

Backlog.md handles the implementation work between desired architectural
iterations. Git and external collaboration systems handle authorship, review, and
approval.

## Risks, Named Honestly

1. **Implementation leakage.** Scanners can turn the blueprint into a catalogue of
   symbols. Mitigation: keep observations separate and require intent-level
   entities.
2. **Conceptual duplication.** Independent scanners may create overlapping
   candidates. Mitigation: stable bindings, aliases, explicit merging, and
   diagnostics.
3. **Scanner drift or failure.** Partial scans can create false removals.
   Mitigation: finite scoped sessions, committed only after successful completion.
4. **Git churn.** Machine evidence can overwhelm semantic review. Mitigation:
   separate canonical planes, deterministic shards, and no volatile metadata.
5. **Plugin surface drift.** Features can acquire incompatible models. Mitigation:
   one transaction model, explicit capabilities, and conformance suites.
6. **Scale failure.** A correct small graph can become unusable at organizational
   scale. Mitigation: enforce explicit storage, reconciliation, query, and browser
   budgets with representative fixtures.
7. **Automation outrunning understanding.** Agents can generate more architecture
   than people can review. Mitigation: bounded views, explainable diagnostics, and
   explicit reconciliation.
8. **Two sources of architectural truth.** Overview documents can become competing
   ledgers. Mitigation: `groma/` is canonical architectural state; overview documents
   remain navigational only.

## Questions That Guide Product Changes

- Does this preserve architectural intent rather than expose implementation trivia?
- Can a human and an agent use the same supported model?
- Does a scanner remain one-way and unaware of the existing blueprint?
- Is canonical state locally owned, readable, deterministic, and reviewable?
- Can the behavior be supplied or replaced through an explicit plugin capability?
- Does ambiguity fail safely?
- Will the design still work with hundreds of thousands of components?
- Are current, historical, and planned states kept conceptually distinct?
- Does the change belong in Groma, or in the external workflow between iterations?
- Is the complexity justified by an immediate invariant or use case?
- Does this shorten or delay the path from an unfamiliar project to a useful visual
  blueprint?

If a proposed change conflicts with this manifesto, surface the conflict and
request an explicit product decision. Do not silently reinterpret the manifesto or
amend it as an implementation detail.
