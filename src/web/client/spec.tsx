import { useEffect, useState, type ReactNode } from "react";

import {
  fetchComponent,
  type ApiComponentScale,
  type ApiComponentRead,
  type ApiFailure,
  type ApiRelationshipView,
  type ApiScaleEvidence,
} from "./api.ts";
import { displayText } from "./model.ts";

const RELATIONSHIP_LIMIT = 20;

interface DetailState {
  readonly cursor?: string | undefined;
  readonly failure?: ApiFailure;
  readonly hasMore: boolean;
  readonly read?: ApiComponentRead;
  readonly relationships: readonly ApiRelationshipView[];
  readonly status: "failed" | "idle" | "loading" | "ready";
}

const IDLE: DetailState = { hasMore: false, relationships: [], status: "idle" };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-2.5">
      <dt className="font-plan text-[9px] tracking-widest text-ink-muted uppercase">{label}</dt>
      <dd className="m-0 mt-0.5 text-xs break-words">{children}</dd>
    </div>
  );
}

function ItemList({
  label,
  items,
}: {
  label: string;
  items: readonly { readonly name: string }[] | undefined;
}) {
  if (items === undefined || items.length === 0) return null;
  return (
    <Field label={label}>
      <ul className="m-0 list-none p-0">
        {items.map((item) => (
          <li key={item.name} className="border-b border-fine py-0.5 last:border-b-0">
            {item.name}
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

export interface SpecPanelProps {
  readonly onClose: () => void;
  readonly resolveDisplay: (id: string) => string | undefined;
  readonly selectedId?: string | undefined;
}

export function SpecPanel({ onClose, resolveDisplay, selectedId }: SpecPanelProps) {
  const [detail, setDetail] = useState<DetailState>(IDLE);

  useEffect(() => {
    if (selectedId === undefined) {
      setDetail(IDLE);
      return;
    }
    let disposed = false;
    setDetail({ hasMore: false, relationships: [], status: "loading" });
    void fetchComponent(selectedId, RELATIONSHIP_LIMIT).then((result) => {
      if (disposed) return;
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
      } else {
        setDetail({ failure: result, hasMore: false, relationships: [], status: "failed" });
      }
    });
    return () => {
      disposed = true;
    };
  }, [selectedId]);

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

  const component = detail.read?.item.component;
  const scaleAssessments = (detail.read?.evidence ?? []).flatMap((entry) =>
    entry.scale === undefined ? [] : [{ projectId: entry.projectId, scale: entry.scale }],
  );
  if (selectedId === undefined) return null;

  return (
    <aside
      aria-label="Component detail"
      aria-live="polite"
      data-canvas-keys="skip"
      className="absolute top-4 right-4 z-10 max-h-[calc(100vh-104px)] w-72 overflow-auto border-[1.5px] border-ink bg-paper"
    >
      <h2 className="m-0 flex items-center justify-between gap-2 border-b border-ink px-3 py-2 text-[11px] tracking-[.12em] uppercase">
        Component detail
        <button
          type="button"
          aria-label="Close component detail"
          onClick={onClose}
          className="cursor-pointer border-0 bg-transparent p-0 font-plan text-sm leading-none text-ink-muted hover:text-ink"
        >
          ×
        </button>
      </h2>
      {detail.status === "loading" ? (
        <p className="px-3 py-3 font-plan text-xs text-ink-muted">Reading the detail…</p>
      ) : detail.status === "failed" ? (
        <div className="border-l-2 border-amber px-3 py-3 font-plan text-xs text-amber">
          {(detail.failure?.diagnostics ?? []).map((diagnostic) => (
            <p key={diagnostic.code} className="m-0">
              {diagnostic.message}
            </p>
          ))}
        </div>
      ) : component === undefined ? null : (
        <dl className="m-0 px-3 pt-1 pb-3">
          <Field label="Selection">{displayText(component)}</Field>
          <Field label="Canonical name">{component.name ?? "—"}</Field>
          <Field label="Type">{component.type ?? "component"}</Field>
          <Field label="Stable identity">
            <span className="font-plan">{component.id}</span>
          </Field>
          {component.summary === undefined ? null : (
            <Field label="Summary">{component.summary}</Field>
          )}
          {component.intent === undefined ? null : <Field label="Intent">{component.intent}</Field>}
          <Field label="Scale">
            {scaleAssessments.length === 0 ? (
              (component.scale ?? "Unscaled")
            ) : scaleAssessments.length === 1 ? (
              scaleAssessmentText(scaleAssessments[0]!.scale, component.scale)
            ) : (
              <ul className="m-0 list-none p-0">
                {scaleAssessments.map(({ projectId, scale }) => (
                  <li key={projectId} className="border-b border-fine py-0.5 last:border-b-0">
                    <span className="font-plan text-[9px] text-ink-muted">{projectId}</span>
                    <br />
                    {scaleAssessmentText(scale, component.scale)}
                  </li>
                ))}
              </ul>
            )}
          </Field>
          <ItemList label="Inputs" items={component.inputs} />
          <ItemList label="Outputs" items={component.outputs} />
          <ItemList label="Actions" items={component.actions} />
          <Field label="Evidence">
            {detail.read !== undefined && detail.read.evidence.length > 0
              ? `Scan evidence from ${detail.read.evidence.length} source${detail.read.evidence.length === 1 ? "" : "s"}`
              : "No scan evidence recorded"}
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
                        {outgoing ? "→" : "←"} {entry.relationship.type}
                      </span>
                      <br />
                      {resolveDisplay(other) ?? <span className="font-plan">{other}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
            {detail.hasMore ? (
              <button
                type="button"
                onClick={loadMoreRelationships}
                className="mt-1.5 border border-ink bg-paper px-2 py-1 font-plan text-[10px] hover:border-survey focus-visible:outline-2 focus-visible:outline-survey"
              >
                More relationships
              </button>
            ) : null}
          </Field>
        </dl>
      )}
    </aside>
  );
}
