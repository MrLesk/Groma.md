/* Bounded reads against the embedded loopback server; every call is one explicit page. */

export interface ApiComponent {
  readonly id: string;
  readonly intent?: string;
  readonly kind: "component";
  readonly label?: string;
  readonly name?: string;
  readonly parent?: string;
  readonly shared?: boolean;
  readonly summary?: string;
  readonly type?: string;
  readonly inputs?: readonly {
    readonly id: string;
    readonly name?: string;
    readonly description?: string;
  }[];
  readonly outputs?: readonly {
    readonly id: string;
    readonly name?: string;
    readonly description?: string;
  }[];
  readonly actions?: readonly {
    readonly id: string;
    readonly name?: string;
    readonly description?: string;
  }[];
  readonly scale?: ApiComponentScale;
}

export type ApiComponentScale = "system" | "domain" | "part" | "element";

export type ApiScaleEvidence =
  | {
      readonly derivation: string;
      readonly status: "insufficient";
    }
  | {
      readonly candidates: readonly ApiComponentScale[];
      readonly derivation: string;
      readonly status: "ambiguous";
    }
  | {
      readonly derivation: string;
      readonly proposal: ApiComponentScale;
      readonly status: "proposed";
    }
  | {
      readonly curated: ApiComponentScale;
      readonly derivation: string;
      readonly proposal: ApiComponentScale;
      readonly status: "aligned" | "drift";
    };

export interface ApiComponentView {
  readonly component: ApiComponent;
  readonly revision: string;
}

export interface ApiComponentPage {
  readonly generation: number;
  readonly hasMore: boolean;
  readonly items: readonly ApiComponentView[];
  readonly nextCursor?: string;
}

export interface ApiRelationshipView {
  readonly relationship: {
    readonly id: string;
    readonly source: string;
    readonly target: string;
    readonly type: string;
    readonly description?: string;
  };
  readonly revision: string;
}

export interface ApiComponentRead {
  readonly evidence: readonly {
    readonly projectId: string;
    readonly scale?: ApiScaleEvidence;
  }[];
  readonly generation: number;
  readonly item: ApiComponentView;
  readonly relationships: {
    readonly generation: number;
    readonly hasMore: boolean;
    readonly items: readonly ApiRelationshipView[];
    readonly nextCursor?: string;
  };
}

export interface ApiSearchPage {
  readonly generation: number;
  readonly hasMore: boolean;
  readonly items: readonly ApiComponent[];
  readonly nextCursor?: string;
}

export interface ApiFailure {
  readonly diagnostics: readonly ApiDiagnostic[];
}

export interface ApiDiagnostic {
  readonly code: string;
  readonly details?: Readonly<Record<string, string | number | boolean>>;
  readonly message: string;
}

export type ApiResult<T> =
  { readonly ok: true; readonly value: T } | ({ readonly ok: false } & ApiFailure);

export type ApiMutationOutcome<T> =
  | {
      readonly affected: {
        readonly components: readonly string[];
        readonly relationships: readonly string[];
      };
      readonly generation: number;
      readonly revisions: readonly {
        readonly componentId: string;
        readonly revision: string | null;
      }[];
      readonly status: "committed";
      readonly value: T;
    }
  | {
      readonly diagnostics: readonly ApiDiagnostic[];
      readonly status:
        | "conflict"
        | "indeterminate"
        | "provider-failure"
        | "request-failed"
        | "validation-rejected";
    };

export interface ApiItemInput {
  readonly description?: string;
  readonly id: string;
  readonly name?: string;
}

export interface ApiRelationshipInput {
  readonly description?: string;
  readonly id?: string;
  readonly target: string;
  readonly type: string;
}

async function read<T>(url: string): Promise<ApiResult<T>> {
  const snapshot = staticSnapshot();
  if (snapshot !== undefined) return readSnapshot(url, snapshot);
  try {
    const response = await fetch(url);
    const body: unknown = await response.json();
    return body as ApiResult<T>;
  } catch {
    return {
      diagnostics: [
        { code: "web-request-failed", message: "The blueprint server could not be reached" },
      ],
      ok: false,
    };
  }
}

async function mutate<T>(url: string, body: unknown): Promise<ApiMutationOutcome<T>> {
  if (staticSnapshot() !== undefined) {
    return {
      diagnostics: [
        {
          code: "web-read-only-snapshot",
          message: "This exported blueprint cannot change canonical state",
        },
      ],
      status: "request-failed",
    };
  }
  try {
    const response = await fetch(url, {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const value: unknown = await response.json();
    if (
      typeof value === "object" &&
      value !== null &&
      "status" in value &&
      typeof value.status === "string"
    ) {
      return value as ApiMutationOutcome<T>;
    }
    const failure = value as Partial<ApiFailure>;
    return {
      diagnostics: failure.diagnostics ?? [
        { code: "web-mutation-failed", message: "The blueprint mutation was refused" },
      ],
      status: "request-failed",
    };
  } catch {
    return {
      diagnostics: [
        { code: "web-request-failed", message: "The blueprint server could not be reached" },
      ],
      status: "request-failed",
    };
  }
}

export interface CreateComponentInput {
  readonly component: {
    readonly actions?: readonly ApiItemInput[];
    readonly id?: string;
    readonly inputs?: readonly ApiItemInput[];
    readonly intent?: string;
    readonly name?: string;
    readonly outputs?: readonly ApiItemInput[];
    readonly parent?: string;
    readonly scale?: ApiComponentScale;
    readonly shared?: boolean;
    readonly type?: string;
  };
  readonly relationships?: readonly ApiRelationshipInput[];
}

export interface UpdateComponentInput {
  readonly expectedRevision: string;
  readonly id: string;
  readonly patch: {
    readonly actions?: readonly ApiItemInput[] | null;
    readonly inputs?: readonly ApiItemInput[] | null;
    readonly intent?: string | null;
    readonly name?: string | null;
    readonly outputs?: readonly ApiItemInput[] | null;
    readonly scale?: ApiComponentScale | null;
    readonly shared?: boolean | null;
    readonly type?: string | null;
  };
  readonly relationships?: {
    readonly remove?: readonly string[];
    readonly upsert?: readonly ApiRelationshipInput[];
  };
}

export function createComponent(
  request: CreateComponentInput,
): Promise<ApiMutationOutcome<ApiComponent>> {
  return mutate("/api/component/create", request);
}

export function updateComponent(
  request: UpdateComponentInput,
): Promise<ApiMutationOutcome<ApiComponent>> {
  return mutate("/api/component/update", request);
}

export function moveComponent(request: {
  readonly expectedRevision: string;
  readonly id: string;
  readonly parent: string | null;
}): Promise<ApiMutationOutcome<ApiComponent>> {
  return mutate("/api/component/move", request);
}

export function mergeComponent(request: {
  readonly expectedRevision: string;
  readonly obsolete: string;
  readonly survivor: string;
}): Promise<ApiMutationOutcome<ApiComponent>> {
  return mutate("/api/component/merge", request);
}

export function removeComponent(request: {
  readonly expectedRevision: string;
  readonly id: string;
}): Promise<ApiMutationOutcome<string>> {
  return mutate("/api/component/remove", request);
}

function withCursor(base: string, cursor?: string): string {
  return cursor === undefined ? base : `${base}&cursor=${encodeURIComponent(cursor)}`;
}

export function fetchRoots(limit: number, cursor?: string): Promise<ApiResult<ApiComponentPage>> {
  return read(withCursor(`/api/roots?limit=${limit}`, cursor));
}

export function fetchChildren(
  parent: string,
  limit: number,
  cursor?: string,
): Promise<ApiResult<ApiComponentPage>> {
  return read(
    withCursor(`/api/children?parent=${encodeURIComponent(parent)}&limit=${limit}`, cursor),
  );
}

export function fetchComponent(
  id: string,
  relationshipsLimit: number,
  relationshipsCursor?: string,
): Promise<ApiResult<ApiComponentRead>> {
  return read(
    withCursor(
      `/api/component?id=${encodeURIComponent(id)}&limit=${relationshipsLimit}`,
      relationshipsCursor,
    ),
  );
}

export interface ApiConnectionItem {
  readonly component: ApiComponent;
  readonly relationships: readonly {
    readonly description?: string;
    readonly id: string;
    readonly source: string;
    readonly target: string;
    readonly type: string;
  }[];
}

export interface ApiConnectionPage {
  readonly generation: number;
  readonly hasMore: boolean;
  readonly items: readonly ApiConnectionItem[];
  readonly nextCursor?: string;
}

export interface StaticBlueprintSnapshot {
  readonly format: "groma-read-only-blueprint-v1";
  readonly generation: number;
  readonly items: readonly ApiConnectionItem[];
}

declare global {
  var __GROMA_BLUEPRINT_SNAPSHOT__: StaticBlueprintSnapshot | undefined;
}

function staticSnapshot(): StaticBlueprintSnapshot | undefined {
  const candidate = globalThis.__GROMA_BLUEPRINT_SNAPSHOT__;
  return candidate?.format === "groma-read-only-blueprint-v1" ? candidate : undefined;
}

export function isStaticBlueprintSnapshot(): boolean {
  return staticSnapshot() !== undefined;
}

function snapshotFailure(message: string): ApiFailure & { readonly ok: false } {
  return {
    diagnostics: [{ code: "web-snapshot-invalid-request", message }],
    ok: false,
  };
}

function snapshotPage<T>(
  values: readonly T[],
  generation: number,
  limit: number,
  cursor: string | null,
): ApiResult<{
  readonly generation: number;
  readonly hasMore: boolean;
  readonly items: readonly T[];
  readonly nextCursor?: string;
}> {
  const offset = cursor === null ? 0 : Number(cursor);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return snapshotFailure("The snapshot page limit is invalid");
  }
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > values.length) {
    return snapshotFailure("The snapshot cursor is invalid");
  }
  const items = values.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  const hasMore = nextOffset < values.length;
  return {
    ok: true,
    value: {
      generation,
      hasMore,
      items,
      ...(hasMore ? { nextCursor: String(nextOffset) } : {}),
    },
  };
}

function snapshotViews(items: readonly ApiConnectionItem[]): readonly ApiComponentView[] {
  return items.map((item) => ({ component: item.component, revision: "snapshot" }));
}

function readSnapshot<T>(rawUrl: string, snapshot: StaticBlueprintSnapshot): ApiResult<T> {
  const url = new URL(rawUrl, "https://groma.invalid");
  const limit = Number(url.searchParams.get("limit"));
  const cursor = url.searchParams.get("cursor");
  if (url.pathname === "/api/roots") {
    const roots = snapshot.items.filter((item) => item.component.parent === undefined);
    return snapshotPage(snapshotViews(roots), snapshot.generation, limit, cursor) as ApiResult<T>;
  }
  if (url.pathname === "/api/children") {
    const parent = url.searchParams.get("parent");
    if (parent === null || parent.length === 0) {
      return snapshotFailure("The snapshot child parent is invalid") as ApiResult<T>;
    }
    const children = snapshot.items.filter((item) => item.component.parent === parent);
    return snapshotPage(
      snapshotViews(children),
      snapshot.generation,
      limit,
      cursor,
    ) as ApiResult<T>;
  }
  if (url.pathname === "/api/connections") {
    return snapshotPage(snapshot.items, snapshot.generation, limit, cursor) as ApiResult<T>;
  }
  if (url.pathname === "/api/search") {
    const text = url.searchParams.get("text")?.trim().toLowerCase();
    if (text === undefined || text.length === 0 || text.length > 256) {
      return snapshotFailure("The snapshot search text is invalid") as ApiResult<T>;
    }
    const matches = snapshot.items
      .map((item) => item.component)
      .filter((component) =>
        [
          component.id,
          component.intent,
          component.label,
          component.name,
          component.scale,
          component.summary,
          component.type,
        ]
          .filter((value): value is string => value !== undefined)
          .some((value) => value.toLowerCase().includes(text)),
      );
    return snapshotPage(matches, snapshot.generation, limit, cursor) as ApiResult<T>;
  }
  if (url.pathname === "/api/component") {
    const id = url.searchParams.get("id");
    const item = snapshot.items.find((entry) => entry.component.id === id);
    if (item === undefined) {
      return snapshotFailure(
        "The component is not present in this bounded snapshot",
      ) as ApiResult<T>;
    }
    const relationships = snapshot.items
      .flatMap((entry) => entry.relationships)
      .filter((relationship) => relationship.source === id || relationship.target === id)
      .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
      .map((relationship) => ({ relationship, revision: "snapshot" }));
    const page = snapshotPage(relationships, snapshot.generation, limit, cursor);
    if (!page.ok) return page as ApiResult<T>;
    return {
      ok: true,
      value: {
        evidence: [],
        generation: snapshot.generation,
        item: { component: item.component, revision: "snapshot" },
        relationships: page.value,
      } as T,
    };
  }
  return snapshotFailure("The snapshot route is unknown") as ApiResult<T>;
}

/** One bounded page of components with the relationships the canvas draws. */
export function fetchConnections(
  limit: number,
  cursor?: string,
): Promise<ApiResult<ApiConnectionPage>> {
  return read(withCursor(`/api/connections?limit=${limit}`, cursor));
}

export function fetchSearch(
  text: string,
  limit: number,
  cursor?: string,
): Promise<ApiResult<ApiSearchPage>> {
  return read(withCursor(`/api/search?text=${encodeURIComponent(text)}&limit=${limit}`, cursor));
}
