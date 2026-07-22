import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from "react";

import {
  measurementSourceLabel,
  createComponent,
  fetchComponent,
  isStaticBlueprintSnapshot,
  mergeComponent,
  moveComponent,
  removeComponent,
  updateComponent,
  type ApiComponent,
  type ApiComponentRead,
  type ApiComponentScale,
  type ApiFailure,
  type ApiItemInput,
  type ApiMutationOutcome,
  type ApiRelationshipInput,
  type ApiRelationshipView,
  type ApiScaleEvidence,
} from "./api.ts";
import { componentPurpose, displayText } from "./model.ts";

const RELATIONSHIP_LIMIT = 20;
const SCALES: readonly ApiComponentScale[] = ["system", "domain", "part", "element"];

interface DetailState {
  readonly cursor?: string | undefined;
  readonly failure?: ApiFailure;
  readonly hasMore: boolean;
  readonly read?: ApiComponentRead;
  readonly relationships: readonly ApiRelationshipView[];
  readonly status: "failed" | "idle" | "loading" | "ready";
}

interface ItemDraft {
  readonly description: string;
  readonly id: string;
  readonly name: string;
}

interface RelationshipDraft {
  readonly description: string;
  readonly id?: string;
  readonly target: string;
  readonly type: string;
}

interface ComponentDraft {
  readonly actions: readonly ItemDraft[];
  readonly id: string;
  readonly inputs: readonly ItemDraft[];
  readonly intent: string;
  readonly name: string;
  readonly outputs: readonly ItemDraft[];
  readonly parent: string;
  readonly relationships: readonly RelationshipDraft[];
  readonly scale: "" | ApiComponentScale;
  readonly shared: "" | "false" | "true";
  readonly type: string;
}

type EditorMode = "edit" | "merge" | "move" | "remove" | "view";
type MutationFailure = Exclude<ApiMutationOutcome<unknown>, { readonly status: "committed" }>;

const IDLE: DetailState = { hasMore: false, relationships: [], status: "idle" };
const EMPTY_DRAFT: ComponentDraft = {
  actions: [],
  id: "",
  inputs: [],
  intent: "",
  name: "",
  outputs: [],
  parent: "",
  relationships: [],
  scale: "",
  shared: "",
  type: "",
};

const CONTROL =
  "w-full border border-line bg-paper px-2 py-1.5 text-xs focus-visible:outline-2 focus-visible:outline-survey";
const SMALL_BUTTON =
  "border border-ink bg-paper px-2 py-1 font-plan text-[10px] hover:border-survey focus-visible:outline-2 focus-visible:outline-survey disabled:cursor-wait disabled:opacity-50";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-2.5">
      <div className="font-plan text-[9px] tracking-widest text-ink-muted uppercase">{label}</div>
      <div className="m-0 mt-0.5 text-xs break-words">{children}</div>
    </div>
  );
}

function relationshipSurfaceLabel(type: string, outgoing: boolean): string {
  if (type === "informs") return outgoing ? "Tells" : "Told by";
  if (type === "imports" || type === "requires" || type === "depends-on")
    return outgoing ? "Needs" : "Needed by";
  return outgoing ? "Relates to" : "Related from";
}

function EditorField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mt-2.5 block">
      <span className="font-plan text-[9px] tracking-widest text-ink-muted uppercase">{label}</span>
      <span className="mt-0.5 block">{children}</span>
    </label>
  );
}

function ItemList({
  label,
  items,
}: {
  label: string;
  items:
    | readonly { readonly description?: string; readonly id: string; readonly name?: string }[]
    | undefined;
}) {
  if (items === undefined || items.length === 0) return null;
  return (
    <Field label={label}>
      <ul className="m-0 list-none p-0">
        {items.map((item) => (
          <li key={item.id} className="border-b border-fine py-0.5 last:border-b-0">
            {item.name ?? item.id}
            {item.description === undefined ? null : (
              <span className="block text-[10px] text-ink-muted">{item.description}</span>
            )}
          </li>
        ))}
      </ul>
    </Field>
  );
}

function scaleAssessmentText(
  assessment: ApiScaleEvidence,
  canonicalScale: ApiComponentScale | undefined,
): string {
  switch (assessment.status) {
    case "ambiguous":
      return `Unscaled — evidence spans ${assessment.candidates.join(" and ")}`;
    case "proposed":
      return `Proposed ${assessment.proposal} — curate explicitly to accept`;
    case "aligned":
      return `${assessment.curated} — aligned with scan evidence`;
    case "drift":
      return `Drift — curated ${assessment.curated}, evidence proposes ${assessment.proposal}`;
    case "insufficient":
      return canonicalScale === undefined
        ? "Unscaled — insufficient structural counts"
        : `${canonicalScale} — insufficient structural counts to compare`;
  }
}

function itemDrafts(
  items:
    | readonly { readonly description?: string; readonly id: string; readonly name?: string }[]
    | undefined,
): readonly ItemDraft[] {
  return (items ?? []).map((item) => ({
    description: item.description ?? "",
    id: item.id,
    name: item.name ?? "",
  }));
}

function draftFor(component: ApiComponent, relationships: readonly ApiRelationshipView[]) {
  return {
    actions: itemDrafts(component.actions),
    id: component.id,
    inputs: itemDrafts(component.inputs),
    intent: component.intent ?? "",
    name: component.name ?? "",
    outputs: itemDrafts(component.outputs),
    parent: component.parent ?? "",
    relationships: relationships.flatMap((entry) =>
      entry.relationship.source !== component.id
        ? []
        : [
            {
              description: entry.relationship.description ?? "",
              id: entry.relationship.id,
              target: entry.relationship.target,
              type: entry.relationship.type,
            },
          ],
    ),
    scale: component.scale ?? "",
    shared: component.shared === undefined ? "" : component.shared ? "true" : "false",
    type: component.type ?? "",
  } satisfies ComponentDraft;
}

function cleanItems(items: readonly ItemDraft[]): readonly ApiItemInput[] {
  return items.map((item) => ({
    id: item.id.trim(),
    ...(item.name.trim().length === 0 ? {} : { name: item.name.trim() }),
    ...(item.description.trim().length === 0 ? {} : { description: item.description.trim() }),
  }));
}

function cleanRelationships(
  relationships: readonly RelationshipDraft[],
): readonly ApiRelationshipInput[] {
  return relationships.map((relationship) => ({
    ...(relationship.id === undefined ? {} : { id: relationship.id }),
    target: relationship.target.trim(),
    type: relationship.type.trim(),
    ...(relationship.description.trim().length === 0
      ? {}
      : { description: relationship.description.trim() }),
  }));
}

function ItemEditor({
  items,
  label,
  onChange,
}: {
  readonly items: readonly ItemDraft[];
  readonly label: string;
  readonly onChange: (items: readonly ItemDraft[]) => void;
}) {
  const update = (index: number, patch: Partial<ItemDraft>) =>
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  return (
    <fieldset className="mt-3 border border-fine p-2">
      <legend className="px-1 font-plan text-[9px] tracking-widest text-ink-muted uppercase">
        {label}
      </legend>
      {items.map((item, index) => (
        <div key={`${label}-${index}`} className="mb-2 border-b border-fine pb-2 last:mb-0">
          <input
            required
            aria-label={`${label} item identity`}
            className={CONTROL}
            placeholder="stable item id"
            value={item.id}
            onChange={(event) => update(index, { id: event.currentTarget.value })}
          />
          <input
            aria-label={`${label} item name`}
            className={`${CONTROL} mt-1`}
            placeholder="name (optional)"
            value={item.name}
            onChange={(event) => update(index, { name: event.currentTarget.value })}
          />
          <input
            aria-label={`${label} item description`}
            className={`${CONTROL} mt-1`}
            placeholder="description (optional)"
            value={item.description}
            onChange={(event) => update(index, { description: event.currentTarget.value })}
          />
          <button
            type="button"
            className={`${SMALL_BUTTON} mt-1`}
            onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
          >
            Remove item
          </button>
        </div>
      ))}
      <button
        type="button"
        className={SMALL_BUTTON}
        onClick={() => onChange([...items, { description: "", id: "", name: "" }])}
      >
        Add {label.toLowerCase().replace(/s$/, "")}
      </button>
    </fieldset>
  );
}

function RelationshipEditor({
  onChange,
  onRemove,
  relationships,
}: {
  readonly onChange: (relationships: readonly RelationshipDraft[]) => void;
  readonly onRemove: (relationship: RelationshipDraft, index: number) => void;
  readonly relationships: readonly RelationshipDraft[];
}) {
  const update = (index: number, patch: Partial<RelationshipDraft>) =>
    onChange(
      relationships.map((relationship, relationshipIndex) =>
        relationshipIndex === index ? { ...relationship, ...patch } : relationship,
      ),
    );
  return (
    <fieldset className="mt-3 border border-fine p-2">
      <legend className="px-1 font-plan text-[9px] tracking-widest text-ink-muted uppercase">
        Outgoing relationships
      </legend>
      {relationships.map((relationship, index) => (
        <div
          key={relationship.id ?? `new-${index}`}
          className="mb-2 border-b border-fine pb-2 last:mb-0"
        >
          <input
            required
            aria-label="Relationship target"
            className={CONTROL}
            placeholder="target component id"
            value={relationship.target}
            onChange={(event) => update(index, { target: event.currentTarget.value })}
          />
          <input
            required
            aria-label="Relationship type"
            className={`${CONTROL} mt-1`}
            placeholder="type"
            value={relationship.type}
            onChange={(event) => update(index, { type: event.currentTarget.value })}
          />
          <input
            aria-label="Relationship description"
            className={`${CONTROL} mt-1`}
            placeholder="description (optional)"
            value={relationship.description}
            onChange={(event) => update(index, { description: event.currentTarget.value })}
          />
          <button
            type="button"
            className={`${SMALL_BUTTON} mt-1`}
            onClick={() => onRemove(relationship, index)}
          >
            Remove relationship
          </button>
        </div>
      ))}
      <button
        type="button"
        className={SMALL_BUTTON}
        onClick={() => onChange([...relationships, { description: "", target: "", type: "" }])}
      >
        Add relationship
      </button>
      <p className="mb-0 font-plan text-[9px] leading-4 text-ink-muted">
        Relationships are edited from their source. Incoming relationships remain read-only here.
      </p>
    </fieldset>
  );
}

function DraftEditor({
  creating,
  draft,
  onChange,
  onRemoveRelationship,
}: {
  readonly creating: boolean;
  readonly draft: ComponentDraft;
  readonly onChange: Dispatch<SetStateAction<ComponentDraft>>;
  readonly onRemoveRelationship: (relationship: RelationshipDraft, index: number) => void;
}) {
  const set = (patch: Partial<ComponentDraft>) => onChange((current) => ({ ...current, ...patch }));
  return (
    <>
      {creating ? (
        <EditorField label="Stable identity (optional)">
          <input
            className={CONTROL}
            placeholder="leave blank to mint an identity"
            value={draft.id}
            onChange={(event) => set({ id: event.currentTarget.value })}
          />
        </EditorField>
      ) : null}
      <EditorField label="Canonical name">
        <input
          className={CONTROL}
          value={draft.name}
          onChange={(event) => set({ name: event.currentTarget.value })}
        />
      </EditorField>
      <EditorField label="Type">
        <input
          className={CONTROL}
          placeholder="open lowercase token"
          value={draft.type}
          onChange={(event) => set({ type: event.currentTarget.value })}
        />
      </EditorField>
      {creating ? (
        <EditorField label="Parent">
          <input
            className={CONTROL}
            placeholder="blank for a root"
            value={draft.parent}
            onChange={(event) => set({ parent: event.currentTarget.value })}
          />
        </EditorField>
      ) : null}
      <EditorField label="Intent">
        <textarea
          className={`${CONTROL} min-h-24 resize-y`}
          value={draft.intent}
          onChange={(event) => set({ intent: event.currentTarget.value })}
        />
      </EditorField>
      <EditorField label="Scale">
        <select
          className={CONTROL}
          value={draft.scale}
          onChange={(event) => set({ scale: event.currentTarget.value as ComponentDraft["scale"] })}
        >
          <option value="">Unscaled</option>
          {SCALES.map((scale) => (
            <option key={scale} value={scale}>
              {scale}
            </option>
          ))}
        </select>
      </EditorField>
      <EditorField label="Shared">
        <select
          className={CONTROL}
          value={draft.shared}
          onChange={(event) =>
            set({ shared: event.currentTarget.value as ComponentDraft["shared"] })
          }
        >
          <option value="">Not specified</option>
          <option value="true">Shared</option>
          <option value="false">Not shared</option>
        </select>
      </EditorField>
      <ItemEditor items={draft.inputs} label="Inputs" onChange={(inputs) => set({ inputs })} />
      <ItemEditor items={draft.outputs} label="Outputs" onChange={(outputs) => set({ outputs })} />
      <ItemEditor items={draft.actions} label="Actions" onChange={(actions) => set({ actions })} />
      <RelationshipEditor
        relationships={draft.relationships}
        onChange={(relationships) => set({ relationships })}
        onRemove={onRemoveRelationship}
      />
    </>
  );
}

function Diagnostics({ failure }: { readonly failure: MutationFailure }) {
  return (
    <div className="mt-3 border-l-2 border-amber bg-paper px-2 py-2 font-plan text-[10px] text-amber">
      <p className="m-0 font-semibold uppercase">
        {failure.status === "conflict" ? "Revision conflict" : "Change refused"}
      </p>
      {failure.diagnostics.map((diagnostic) => (
        <div key={`${diagnostic.code}-${diagnostic.message}`} className="mt-1">
          <p className="m-0">{diagnostic.message}</p>
          <p className="m-0 text-[9px]">{diagnostic.code}</p>
          {diagnostic.details === undefined ? null : (
            <ul className="m-0 list-none p-0">
              {Object.entries(diagnostic.details).map(([name, value]) => (
                <li key={name}>
                  {name}: {String(value)}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export interface SpecPanelProps {
  readonly createOpen?: boolean;
  readonly onClose: () => void;
  readonly onCommitted: () => void;
  readonly resolveDisplay: (id: string) => string | undefined;
  readonly selectedId?: string | undefined;
}

export function SpecPanel({
  createOpen = false,
  onClose,
  onCommitted,
  resolveDisplay,
  selectedId,
}: SpecPanelProps) {
  const exported = isStaticBlueprintSnapshot();
  const [detail, setDetail] = useState<DetailState>(IDLE);
  const [draft, setDraft] = useState<ComponentDraft>(EMPTY_DRAFT);
  const [mode, setMode] = useState<EditorMode>("view");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<MutationFailure | undefined>();
  const [removedRelationships, setRemovedRelationships] = useState<readonly string[]>([]);
  const [operationTarget, setOperationTarget] = useState("");

  const loadDetail = useCallback((id: string, preserveDraft = false) => {
    setDetail({ hasMore: false, relationships: [], status: "loading" });
    void fetchComponent(id, RELATIONSHIP_LIMIT).then((result) => {
      if (result.ok) {
        setDetail({
          ...(result.value.relationships.nextCursor === undefined
            ? {}
            : { cursor: result.value.relationships.nextCursor }),
          hasMore: result.value.relationships.hasMore,
          read: result.value,
          relationships: result.value.relationships.items,
          status: "ready",
        });
        if (!preserveDraft)
          setDraft(draftFor(result.value.item.component, result.value.relationships.items));
      } else {
        setDetail({ failure: result, hasMore: false, relationships: [], status: "failed" });
      }
    });
  }, []);

  useEffect(() => {
    setFeedback(undefined);
    setRemovedRelationships([]);
    setOperationTarget("");
    if (createOpen) {
      setDetail(IDLE);
      setDraft(EMPTY_DRAFT);
      setMode("edit");
      return;
    }
    setMode("view");
    if (selectedId === undefined) {
      setDetail(IDLE);
      return;
    }
    loadDetail(selectedId);
  }, [createOpen, loadDetail, selectedId]);

  const loadMoreRelationships = () => {
    if (selectedId === undefined || detail.cursor === undefined) return;
    const cursor = detail.cursor;
    void fetchComponent(selectedId, RELATIONSHIP_LIMIT, cursor).then((result) => {
      if (!result.ok) return;
      setDetail((current) =>
        current.read === undefined
          ? current
          : {
              ...current,
              ...(result.value.relationships.nextCursor === undefined
                ? { cursor: undefined }
                : { cursor: result.value.relationships.nextCursor }),
              hasMore: result.value.relationships.hasMore,
              relationships: [...current.relationships, ...result.value.relationships.items],
            },
      );
    });
  };

  const handleOutcome = <T,>(outcome: ApiMutationOutcome<T>) => {
    setBusy(false);
    if (outcome.status === "committed") {
      onCommitted();
      return;
    }
    setFeedback(outcome);
  };

  const submitDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setFeedback(undefined);
    if (createOpen) {
      const relationships = cleanRelationships(draft.relationships);
      void createComponent({
        component: {
          ...(draft.id.trim().length === 0 ? {} : { id: draft.id.trim() }),
          ...(draft.name.trim().length === 0 ? {} : { name: draft.name.trim() }),
          ...(draft.type.trim().length === 0 ? {} : { type: draft.type.trim() }),
          ...(draft.parent.trim().length === 0 ? {} : { parent: draft.parent.trim() }),
          ...(draft.intent.trim().length === 0 ? {} : { intent: draft.intent.trim() }),
          ...(draft.scale === "" ? {} : { scale: draft.scale }),
          ...(draft.shared === "" ? {} : { shared: draft.shared === "true" }),
          ...(draft.inputs.length === 0 ? {} : { inputs: cleanItems(draft.inputs) }),
          ...(draft.outputs.length === 0 ? {} : { outputs: cleanItems(draft.outputs) }),
          ...(draft.actions.length === 0 ? {} : { actions: cleanItems(draft.actions) }),
        },
        ...(relationships.length === 0 ? {} : { relationships }),
      }).then(handleOutcome);
      return;
    }
    const read = detail.read;
    if (selectedId === undefined || read === undefined) {
      setBusy(false);
      return;
    }
    const upsert = cleanRelationships(draft.relationships);
    void updateComponent({
      expectedRevision: read.item.revision,
      id: selectedId,
      patch: {
        name: draft.name.trim().length === 0 ? null : draft.name.trim(),
        type: draft.type.trim().length === 0 ? null : draft.type.trim(),
        intent: draft.intent.trim().length === 0 ? null : draft.intent.trim(),
        scale: draft.scale === "" ? null : draft.scale,
        shared: draft.shared === "" ? null : draft.shared === "true",
        inputs: draft.inputs.length === 0 ? null : cleanItems(draft.inputs),
        outputs: draft.outputs.length === 0 ? null : cleanItems(draft.outputs),
        actions: draft.actions.length === 0 ? null : cleanItems(draft.actions),
      },
      ...(upsert.length === 0 && removedRelationships.length === 0
        ? {}
        : {
            relationships: {
              ...(removedRelationships.length === 0 ? {} : { remove: removedRelationships }),
              ...(upsert.length === 0 ? {} : { upsert }),
            },
          }),
    }).then(handleOutcome);
  };

  const component = detail.read?.item.component;
  const cognitiveComplexity = detail.read?.item.cognitiveComplexity ?? [];
  const sourceLines = detail.read?.item.sourceLines ?? [];
  const scaleAssessments = (detail.read?.evidence ?? []).flatMap((entry) =>
    entry.scale === undefined ? [] : [{ projectId: entry.projectId, scale: entry.scale }],
  );
  if ((!createOpen && selectedId === undefined) || (exported && createOpen)) return null;

  const acceptScale = (scale: ApiComponentScale) => {
    if (selectedId === undefined || detail.read === undefined) return;
    setBusy(true);
    setFeedback(undefined);
    void updateComponent({
      expectedRevision: detail.read.item.revision,
      id: selectedId,
      patch: { scale },
    }).then(handleOutcome);
  };

  const submitOperation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedId === undefined || detail.read === undefined) return;
    setBusy(true);
    setFeedback(undefined);
    const expectedRevision = detail.read.item.revision;
    if (mode === "move") {
      void moveComponent({
        expectedRevision,
        id: selectedId,
        parent: operationTarget.trim().length === 0 ? null : operationTarget.trim(),
      }).then(handleOutcome);
    } else if (mode === "merge") {
      void mergeComponent({
        expectedRevision,
        obsolete: selectedId,
        survivor: operationTarget.trim(),
      }).then(handleOutcome);
    } else if (mode === "remove") {
      void removeComponent({ expectedRevision, id: selectedId }).then(handleOutcome);
    }
  };

  return (
    <aside
      aria-label={createOpen ? "Create component" : "Component detail"}
      aria-live="polite"
      data-canvas-keys="skip"
      className="absolute inset-x-0 bottom-0 z-20 max-h-[72vh] overflow-auto border-t-[1.5px] border-ink bg-paper shadow-[0_-8px_24px_rgba(32,36,34,0.12)] sm:inset-x-auto sm:top-4 sm:right-4 sm:bottom-auto sm:max-h-[calc(100vh-104px)] sm:w-96 sm:border-[1.5px] sm:shadow-[0_8px_24px_rgba(32,36,34,0.10)]"
    >
      <h2 className="sticky top-0 z-10 m-0 flex items-center justify-between gap-2 border-b border-ink bg-paper px-3 py-2 text-[11px] tracking-[.12em] uppercase">
        {createOpen ? "Create component" : mode === "view" ? "Component detail" : "Edit component"}
        <button
          type="button"
          aria-label="Close component panel"
          onClick={onClose}
          className="cursor-pointer border-0 bg-transparent p-0 font-plan text-sm leading-none text-ink-muted hover:text-ink"
        >
          ×
        </button>
      </h2>
      {createOpen ? (
        <form className="px-3 pt-1 pb-3" onSubmit={submitDraft}>
          <DraftEditor
            creating
            draft={draft}
            onChange={setDraft}
            onRemoveRelationship={(_, index) =>
              setDraft((current) => ({
                ...current,
                relationships: current.relationships.filter(
                  (__, relationshipIndex) => relationshipIndex !== index,
                ),
              }))
            }
          />
          {feedback === undefined ? null : <Diagnostics failure={feedback} />}
          <div className="mt-3 flex gap-2">
            <button disabled={busy} type="submit" className={SMALL_BUTTON}>
              {busy ? "Creating…" : "Create component"}
            </button>
            <button type="button" className={SMALL_BUTTON} onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      ) : detail.status === "loading" ? (
        <p className="px-3 py-3 font-plan text-xs text-ink-muted">Reading the detail…</p>
      ) : detail.status === "failed" ? (
        <div className="border-l-2 border-amber px-3 py-3 font-plan text-xs text-amber">
          {(detail.failure?.diagnostics ?? []).map((diagnostic) => (
            <p key={diagnostic.code} className="m-0">
              {diagnostic.message}
            </p>
          ))}
        </div>
      ) : component === undefined ? null : mode === "edit" ? (
        <form className="px-3 pt-1 pb-3" onSubmit={submitDraft}>
          <DraftEditor
            creating={false}
            draft={draft}
            onChange={setDraft}
            onRemoveRelationship={(relationship, index) => {
              if (relationship.id !== undefined) {
                setRemovedRelationships((current) => [...current, relationship.id!]);
              }
              setDraft((current) => ({
                ...current,
                relationships: current.relationships.filter(
                  (__, relationshipIndex) => relationshipIndex !== index,
                ),
              }));
            }}
          />
          {feedback === undefined ? null : (
            <>
              <Diagnostics failure={feedback} />
              {feedback.status === "conflict" && selectedId !== undefined ? (
                <button
                  type="button"
                  className={`${SMALL_BUTTON} mt-2`}
                  onClick={() => {
                    setFeedback(undefined);
                    loadDetail(selectedId, true);
                  }}
                >
                  Refresh revision and review draft
                </button>
              ) : null}
            </>
          )}
          <div className="mt-3 flex gap-2">
            <button disabled={busy} type="submit" className={SMALL_BUTTON}>
              {busy ? "Saving…" : "Save change"}
            </button>
            <button
              type="button"
              className={SMALL_BUTTON}
              onClick={() => {
                setMode("view");
                setFeedback(undefined);
                setRemovedRelationships([]);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : mode !== "view" ? (
        <form className="px-3 py-3" onSubmit={submitOperation}>
          <p className="mt-0 text-xs">
            {mode === "move"
              ? "Move this component under another stable identity, or leave the parent blank to make it a root."
              : mode === "merge"
                ? "Merge this obsolete identity into the named survivor. The obsolete identity remains as an alias."
                : "Remove this component only when no children, relationships, or aliases still depend on it."}
          </p>
          {mode === "move" || mode === "merge" ? (
            <EditorField label={mode === "move" ? "New parent" : "Surviving component"}>
              <input
                required={mode === "merge"}
                className={CONTROL}
                value={operationTarget}
                onChange={(event) => setOperationTarget(event.currentTarget.value)}
              />
            </EditorField>
          ) : null}
          {feedback === undefined ? null : (
            <>
              <Diagnostics failure={feedback} />
              {feedback.status === "conflict" && selectedId !== undefined ? (
                <button
                  type="button"
                  className={`${SMALL_BUTTON} mt-2`}
                  onClick={() => {
                    setFeedback(undefined);
                    loadDetail(selectedId, true);
                  }}
                >
                  Refresh revision and review action
                </button>
              ) : null}
            </>
          )}
          <div className="mt-3 flex gap-2">
            <button disabled={busy} type="submit" className={SMALL_BUTTON}>
              {busy
                ? "Applying…"
                : mode === "move"
                  ? "Move component"
                  : mode === "merge"
                    ? "Merge component"
                    : "Remove component"}
            </button>
            <button
              type="button"
              className={SMALL_BUTTON}
              onClick={() => {
                setMode("view");
                setFeedback(undefined);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="m-0 px-3 pt-1 pb-3">
          <section className="groma-spec-lead">
            <p>
              {component.scale ?? "unscaled"} · {component.type ?? "component"}
            </p>
            <h3>{displayText(component)}</h3>
            {detail.read?.item.evidenceBound ? (
              <p className="groma-spec-lead__observed">Observed in code</p>
            ) : null}
            <div className={componentPurpose(component) === undefined ? "is-missing" : undefined}>
              {componentPurpose(component) ?? "Purpose not yet recorded."}
            </div>
          </section>
          <Field label="Contained by">
            {component.parent === undefined
              ? "Blueprint root"
              : (resolveDisplay(component.parent) ?? "Another component")}
          </Field>
          <Field label="Relationships">
            {detail.relationships.length === 0 ? (
              "None on this page"
            ) : (
              <ul className="m-0 list-none p-0">
                {detail.relationships.map((entry) => {
                  const outgoing = entry.relationship.source === component.id;
                  const other = outgoing ? entry.relationship.target : entry.relationship.source;
                  return (
                    <li
                      key={entry.relationship.id}
                      className="border-b border-fine py-1 last:border-b-0"
                    >
                      <span className="font-plan text-[9px] text-ink-muted uppercase">
                        {outgoing ? "→" : "←"}{" "}
                        {relationshipSurfaceLabel(entry.relationship.type, outgoing)}
                      </span>{" "}
                      <strong className="font-medium">
                        {resolveDisplay(other) ?? "Another component"}
                      </strong>
                    </li>
                  );
                })}
              </ul>
            )}
            {detail.hasMore ? (
              <button
                type="button"
                onClick={loadMoreRelationships}
                className={`${SMALL_BUTTON} mt-1.5`}
              >
                More relationships
              </button>
            ) : null}
          </Field>
          <ItemList label="What goes in" items={component.inputs} />
          <ItemList label="What comes out" items={component.outputs} />
          <ItemList label="What it can do" items={component.actions} />
          <details className="groma-spec-technical">
            <summary>Technical details</summary>
            <Field label="Canonical name">{component.name ?? "—"}</Field>
            <Field label="Stable identity">
              <span className="font-plan">{component.id}</span>
            </Field>
            <Field label="Scale">
              {scaleAssessments.length === 0 ? (
                (component.scale ?? "Unscaled")
              ) : (
                <ul className="m-0 list-none p-0">
                  {scaleAssessments.map(({ projectId, scale }) => {
                    const proposal =
                      scale.status === "proposed" || scale.status === "drift"
                        ? scale.proposal
                        : undefined;
                    return (
                      <li key={projectId} className="border-b border-fine py-1 last:border-b-0">
                        {scaleAssessmentText(scale, component.scale)}
                        {!exported && proposal !== undefined ? (
                          <button
                            disabled={busy}
                            type="button"
                            className={`${SMALL_BUTTON} mt-1 block`}
                            onClick={() => acceptScale(proposal)}
                          >
                            Accept {proposal}
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Field>
            <Field label="Shared">
              {component.shared === undefined ? "Not specified" : component.shared ? "Yes" : "No"}
            </Field>
            <Field label="Evidence">
              {exported
                ? "Evidence detail is not included in this bounded export"
                : detail.read !== undefined && detail.read.evidence.length > 0
                  ? `Scan evidence from ${detail.read.evidence.length} source${detail.read.evidence.length === 1 ? "" : "s"}`
                  : "No scan evidence recorded"}
            </Field>
            {cognitiveComplexity.length === 0 ? null : (
              <Field label="Cognitive complexity">
                <ul className="m-0 list-none p-0">
                  {cognitiveComplexity.map((measurement) => (
                    <li
                      key={`${measurement.projectId}:${measurementSourceLabel(measurement)}`}
                      className="border-b border-fine py-1 last:border-b-0"
                    >
                      {measurement.value} — scanner-measured nesting and branching
                      <span className="block font-plan text-[9px] text-ink-muted">
                        {measurementSourceLabel(measurement)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Field>
            )}
            {sourceLines.length === 0 ? null : (
              <Field label="Source span">
                <ul className="m-0 list-none p-0">
                  {sourceLines.map((measurement) => (
                    <li
                      key={`${measurement.projectId}:${measurementSourceLabel(measurement)}`}
                      className="border-b border-fine py-1 last:border-b-0"
                    >
                      {measurement.value} physical source line
                      {measurement.value === 1 ? "" : "s"} in this callable declaration
                      <span className="block font-plan text-[9px] text-ink-muted">
                        {measurementSourceLabel(measurement)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Field>
            )}
          </details>
          {feedback === undefined ? null : (
            <>
              <Diagnostics failure={feedback} />
              {feedback.status === "conflict" && selectedId !== undefined ? (
                <button
                  type="button"
                  className={`${SMALL_BUTTON} mt-2`}
                  onClick={() => {
                    setFeedback(undefined);
                    loadDetail(selectedId);
                  }}
                >
                  Refresh current component
                </button>
              ) : null}
            </>
          )}
          {exported ? null : (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-ink pt-2">
              {(["edit", "move", "merge", "remove"] as const).map((action) => (
                <button
                  key={action}
                  type="button"
                  className={SMALL_BUTTON}
                  onClick={() => {
                    setDraft(draftFor(component, detail.relationships));
                    setRemovedRelationships([]);
                    setOperationTarget("");
                    setFeedback(undefined);
                    setMode(action);
                  }}
                >
                  {action === "edit"
                    ? "Edit"
                    : action === "move"
                      ? "Move"
                      : action === "merge"
                        ? "Merge"
                        : "Remove"}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
