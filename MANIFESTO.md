# The Groma Manifesto

Groma is a local-first architectural blueprint for humans and AI agents. It gives
large, heterogeneous projects a shared language for understanding what a system is,
why its parts exist, how those parts relate, and what the system is intended to
become.

Its purpose is not to reproduce source code in diagram form. Groma preserves
architectural intent while continuously reconciling that intent with evidence from
the systems being built.

## The First Users

**Humans and agents are both first-class users.** They work through the same model and
the same semantic operations. Groma does not assign different meanings, permissions,
or trust levels based on whether a change came from a person or an agent.

Consequences:

- A person can understand, inspect, and edit a blueprint without an AI agent.
- An agent can use the same supported interfaces without depending on private
  implementation APIs.
- Agent approval, supervision, and permissions remain outside Groma.
- The resulting architecture must stay understandable to the people responsible for
  it.

## The Core Loop

```text
observe -> reconcile -> understand -> plan -> implement externally -> verify -> preserve
```

- **Observe:** scanners report deterministic evidence about what exists.
- **Reconcile:** Groma joins new evidence with existing identity and intent without
  destroying curated meaning.
- **Understand:** humans and agents explore the current architectural graph.
- **Plan:** desired-state overlays describe a future architecture without prescribing
  implementation operations.
- **Implement externally:** Backlog.md and other tools coordinate the work required to
  move between architectural states.
- **Verify:** scanners and comparisons determine whether the implementation satisfies
  the intended architecture.
- **Preserve:** readable canonical files and Git retain the reasoning and evolution.

## Intent and Evidence

The central distinction in Groma is **intent versus evidence**.

Intent explains meaning:

- responsibilities and descriptions;
- conceptual boundaries and recursive containment;
- inputs, outputs, and actions;
- declared relationships;
- lifecycle and desired state.

Every architectural node in the standard model is a **component**. A component has an
open type token and zero or one structural parent. Components without a parent are
roots of the blueprint; every other component belongs to exactly one parent. Parents
may contain any number of components of the same or different types, recursively.
Containment is acyclic and is separate from the component's other many-to-many
relationships. The blueprint itself is the workspace around these roots, not another
required entity. A domain is therefore an ordinary root component with a `domain`
type, not a distinct container entity.

For v0.1, the structured meaning carried by a component is deliberately limited to
**intent, inputs, outputs, actions, and relationships**. Type and parent are small
structural metadata, not a separate architectural taxonomy or questionnaire.
Requirements are expressed through relationships; important failures and events are
inputs or outputs; state, guarantees, triggers, and effects remain readable intent
prose until repeated use proves that they need independent structure. This small model
is a product constraint: users should not have to complete an architectural
questionnaire before a component becomes useful.

Evidence explains what a source currently observes:

- packages and exports;
- routes and contracts;
- events and dependencies;
- deployments or other technology-specific facts.

Scanners observe. Groma reconciles. Humans and agents curate meaning.

A scanner may create candidates, but it never receives the existing blueprint and
never edits canonical state directly. Groma alone owns stable identity, evidence
bindings, conceptual overrides, and reconciliation. Missing evidence must not erase
intent.

Scanner contributions are always partial. A scanner reports only the component
candidates, inputs, outputs, actions, or relationships that it can defend as
observations. It is never required to populate every part of the component model or to
infer state, guarantees, business requirements, or architectural prose.

## The Source of Truth

The official distribution stores canonical state as deterministic, human-readable
Markdown under `groma/`.

- Intent, evidence, bindings, aliases, and plans are durable canonical records.
- Disposable projections may accelerate search and graph traversal but must be fully
  reconstructable.
- Paths and names are not identity.
- Stable opaque IDs survive moves, renames, merges, and changes in implementation.
- Git is optional to the abstract architecture, but the official distribution treats
  it as the history and review layer.
- No hosted service, account, or telemetry is required for the core workflow.

Storage formats are provider concerns rather than assumptions embedded in Groma Core.
Other host profiles may use other canonical stores while preserving the same
invariants.

## Time

Groma has a deliberately small temporal model:

- **Past:** Git revisions of the canonical blueprint.
- **Present:** the current reconciled blueprint.
- **Future:** ordered desired-state plans.

Plans describe what should be true, never a list of implementation commands. Groma
does not apply plans or manage the tasks required to realize them.

## Surface Hierarchy

Every surface expresses one shared application model.

1. **Shared application operations** define semantic reads and mutations.
2. **The CLI** provides the complete automation and agent-facing workflow.
3. **The web interface** is the primary human experience for navigating and editing
   the blueprint.
4. **Scanners** are one-way observation producers, not alternative mutation surfaces.

Bare `groma` opens the aggregate visual blueprint in an interactive terminal. CLI and
web behavior must remain semantically equivalent, and neither may bypass shared
transactions.

## Plugin Posture

Groma is a small portable core surrounded by plugins.

Core owns only technology-neutral contracts and invariants: graph identity,
transactions, reconciliation guarantees, observation sessions, events, queries, and
plugin composition.

Everything technology- or surface-specific belongs outside Core, including:

- filesystems and configuration formats;
- Markdown, SQLite, and Git;
- component-model policy;
- scanners and matchers;
- the CLI, application service, and web interface.

Official built-in plugins use the same runtime plugin API exposed to third parties.
Bootstrap capabilities are explicit rather than hidden special cases. Plugins may add
capabilities, but they may not bypass Core transactions or weaken registered
invariants.

Groma distinguishes a distributable **package** from a runtime **plugin**. A package
may contain several selectively enabled plugins, while every plugin declares the
capabilities it contributes. Installation, enablement, and runtime loading are
separate concerns.

Plugins execute as trusted code with the user's full permissions. Groma must state
that plainly and require trust before executing project-provided code. Declared
capabilities explain behavior but are not a security sandbox.

Any plugin capable of changing canonical blueprint meaning or evidence must be
declared and reproducibly pinned by the blueprint. Personal plugins may improve
presentation or local workflows, but they must not silently change shared canonical
behavior. Groma manages its own plugin packages and never mutates the package-manager
files of projects it observes.

## Design Principles

1. **Intent over implementation detail.** A blueprint explains why a part exists and
   how it participates in the system, not which syntax implements it.
2. **One model for humans and agents.** Do not create agent-only meanings or hidden
   workflows.
3. **Scanner blindness.** Observation producers never inspect or reorganize the
   existing blueprint.
4. **Meaning survives evidence changes.** Renames, deletions, and failed scans do not
   silently destroy curated intent.
5. **Local ownership.** Users own readable canonical state and can work without a
   service.
6. **Deterministic and Git-friendly.** Stable identity, ordering, serialization, and
   focused files make changes reviewable.
7. **Fail closed on ambiguity.** Never guess an entity, binding, merge, or plan target
   when identity is uncertain.
8. **One semantic path.** CLI, web, and plugins use shared operations and validation.
9. **Progressive scale.** Queries, scans, and visualizations operate on bounded pages
   and subgraphs rather than loading the world.
10. **Portability through contracts.** Operating-system and storage concerns stay
    behind replaceable capabilities.
11. **Desired state, not work orchestration.** Groma explains architectural change;
    external tools coordinate its implementation.
12. **Simplicity earns adoption.** Add abstractions only when they preserve a real
    invariant or enable a proven extension.

## Boundaries

Groma is not:

- implementation documentation or a source-code browser;
- UML generated once and allowed to drift;
- a task manager or agent orchestration system;
- an approval, permission, or proposal workflow;
- a plan executor or code generator;
- a hosted architecture service that owns user data;
- tied to one language, framework, operating system, or storage provider;
- a canvas that attempts to render an entire organization at once.

Backlog.md handles the implementation work between desired architectural iterations.
Git and external collaboration systems handle authorship, review, and approval.

## Risks, Named Honestly

1. **Implementation leakage.** Scanners can turn the blueprint into a catalogue of
   symbols. Mitigation: keep observations separate and require intent-level entities.
2. **Conceptual duplication.** Independent scanners may create overlapping candidates.
   Mitigation: stable bindings, aliases, explicit merging, and diagnostics.
3. **Scanner drift or failure.** Partial scans can create false removals. Mitigation:
   finite scoped sessions and commit only after successful completion.
4. **Git churn.** Machine evidence can overwhelm semantic review. Mitigation: separate
   canonical planes, deterministic shards, and no volatile metadata.
5. **Plugin surface drift.** Features can acquire incompatible models. Mitigation: one
   transaction model, explicit capabilities, and conformance suites.
6. **Scale failure.** A correct small graph can become unusable at organizational
   scale. Mitigation: prove storage, reconciliation, queries, and browser budgets with
   representative fixtures before interfaces freeze.
7. **Automation outrunning understanding.** Agents can generate more architecture than
   people can review. Mitigation: bounded views, explainable diagnostics, and explicit
   reconciliation.
8. **Two sources of architectural truth.** Transitional documents can outlive their
   purpose. Mitigation: once Groma can describe itself, `groma/` becomes canonical and
   overview documents remain navigational only.

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

If a proposed change conflicts with this manifesto, surface the conflict and request an
explicit product decision. Do not silently reinterpret the manifesto or amend it as an
implementation detail.
