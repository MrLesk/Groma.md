import type { ApiComponent, ApiComponentPage, ApiComponentView } from "./api.ts";

/**
 * Pure view-model for the interactive map. Every entry comes from bounded reads;
 * the model records exactly what has been loaded while page mechanics stay outside
 * the visual blueprint.
 */

export interface BlueprintNode {
  /** Undefined until the first bounded children page for this component is merged. */
  readonly childIds?: readonly string[];
  readonly childrenCursor?: string;
  readonly hasMoreChildren: boolean;
  readonly view: ApiComponentView;
}

export interface BlueprintModel {
  readonly generation: number;
  readonly hasMoreRoots: boolean;
  readonly nodes: ReadonlyMap<string, BlueprintNode>;
  readonly rootIds: readonly string[];
  readonly rootsCursor?: string;
}

export function emptyModel(): BlueprintModel {
  return { generation: 0, hasMoreRoots: false, nodes: new Map(), rootIds: [] };
}

export function displayText(component: ApiComponent): string {
  return component.label ?? component.name ?? component.id;
}

export function componentPurpose(component: ApiComponent): string | undefined {
  return component.intent ?? component.summary;
}

export function hasReadableMeaning(component: ApiComponent): boolean {
  return component.intent !== undefined || component.label !== undefined;
}

export function isImplementationEvidence(component: ApiComponent, evidenceBound: boolean): boolean {
  return evidenceBound && !hasReadableMeaning(component);
}

function upsertViews(
  nodes: ReadonlyMap<string, BlueprintNode>,
  views: readonly ApiComponentView[],
): Map<string, BlueprintNode> {
  const next = new Map(nodes);
  for (const view of views) {
    const existing = next.get(view.component.id);
    next.set(
      view.component.id,
      existing === undefined ? { hasMoreChildren: false, view } : { ...existing, view },
    );
  }
  return next;
}

function appendUnique(existing: readonly string[], added: readonly string[]): readonly string[] {
  const seen = new Set(existing);
  return [...existing, ...added.filter((id) => !seen.has(id))];
}

export function mergeRootsPage(model: BlueprintModel, page: ApiComponentPage): BlueprintModel {
  return {
    generation: page.generation,
    hasMoreRoots: page.hasMore,
    nodes: upsertViews(model.nodes, page.items),
    rootIds: appendUnique(
      model.rootIds,
      page.items.map((item) => item.component.id),
    ),
    ...(page.nextCursor === undefined ? {} : { rootsCursor: page.nextCursor }),
  };
}

export function mergeChildrenPage(
  model: BlueprintModel,
  parentId: string,
  page: ApiComponentPage,
): BlueprintModel {
  const nodes = upsertViews(model.nodes, page.items);
  const parent = nodes.get(parentId);
  if (parent !== undefined) {
    const merged: BlueprintNode = {
      ...parent,
      childIds: appendUnique(
        parent.childIds ?? [],
        page.items.map((item) => item.component.id),
      ),
      hasMoreChildren: page.hasMore,
    };
    const withCursor: BlueprintNode =
      page.nextCursor === undefined
        ? (() => {
            const { childrenCursor: _dropped, ...rest } = merged;
            return rest;
          })()
        : { ...merged, childrenCursor: page.nextCursor };
    nodes.set(parentId, withCursor);
  }
  return {
    generation: page.generation,
    hasMoreRoots: model.hasMoreRoots,
    nodes,
    rootIds: model.rootIds,
    ...(model.rootsCursor === undefined ? {} : { rootsCursor: model.rootsCursor }),
  };
}
