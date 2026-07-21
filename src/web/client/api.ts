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
  readonly inputs?: readonly { readonly id: string; readonly name: string }[];
  readonly outputs?: readonly { readonly id: string; readonly name: string }[];
  readonly actions?: readonly {
    readonly id: string;
    readonly name: string;
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
  readonly diagnostics: readonly { readonly code: string; readonly message: string }[];
}

export type ApiResult<T> =
  { readonly ok: true; readonly value: T } | ({ readonly ok: false } & ApiFailure);

async function read<T>(url: string): Promise<ApiResult<T>> {
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
