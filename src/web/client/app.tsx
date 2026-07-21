import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  fetchChildren,
  fetchConnections,
  fetchRoots,
  fetchSearch,
  type ApiComponentScale,
  type ApiFailure,
  type ApiSearchPage,
} from "./api.ts";
import { GROMA_LOCKUP } from "./brand.ts";
import { Canvas } from "./canvas.tsx";
import {
  displayText,
  emptyModel,
  mergeChildrenPage,
  mergeRootsPage,
  type BlueprintModel,
} from "./model.ts";
import { SpecPanel } from "./spec.tsx";

const ROOT_LIMIT = 20;
const CHILD_LIMIT = 10;
const CONNECTION_LIMIT = 100;
const SEARCH_LIMIT = 20;

interface SearchState {
  readonly open: boolean;
  readonly page?: ApiSearchPage;
  readonly text: string;
}

export function App() {
  const [model, setModel] = useState<BlueprintModel>(emptyModel);
  const [failure, setFailure] = useState<ApiFailure | undefined>(undefined);
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState<SearchState>({ open: false, text: "" });
  const [dependencies, setDependencies] = useState<
    readonly { source: string; target: string; type: string }[]
  >([]);
  const [visibleScale, setVisibleScale] = useState<ApiComponentScale | undefined>(undefined);
  const [focusStack, setFocusStack] = useState<readonly string[]>([]);
  const [childCounts, setChildCounts] = useState<ReadonlyMap<string, number>>(new Map());
  const pending = useRef(new Set<string>());
  const autoExpanded = useRef(new Set<string>());
  const focusId = focusStack.at(-1);

  useEffect(() => {
    let disposed = false;
    void fetchRoots(ROOT_LIMIT).then((result) => {
      if (disposed) return;
      if (result.ok) setModel((current) => mergeRootsPage(current, result.value));
      else setFailure(result);
    });
    return () => {
      disposed = true;
    };
  }, []);

  // Open the system's own parts on arrival, so a reader meets the architecture
  // rather than a single collapsed box they must first know to click. Only
  // owned roots expand; borrowed code stays a listed dependency.
  useEffect(() => {
    for (const rootId of model.rootIds) {
      const node = model.nodes.get(rootId);
      if (node === undefined || autoExpanded.current.has(rootId)) continue;
      if (node.view.component.type === "external") continue;
      if (node.childIds !== undefined) continue;
      autoExpanded.current.add(rootId);
      loadChildren(rootId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.rootIds]);

  // Every observed dependency, and — from the same paged read — how many parts
  // each component contains. The child counts tell a container from a leaf
  // before it is opened, so a directory offers a way in while a file offers only
  // its detail. Pages are bounded; a very large graph stops at a bounded cap.
  useEffect(() => {
    let disposed = false;
    const edges: { source: string; target: string; type: string }[] = [];
    const counts = new Map<string, number>();
    const seenComponents = new Set<string>();
    const consume = (cursor?: string, pagesLeft = 24): void => {
      void fetchConnections(CONNECTION_LIMIT, cursor).then((result) => {
        if (disposed || !result.ok) return;
        for (const item of result.value.items) {
          if (!seenComponents.has(item.component.id)) {
            seenComponents.add(item.component.id);
            const parent = item.component.parent;
            if (parent !== undefined) counts.set(parent, (counts.get(parent) ?? 0) + 1);
          }
          for (const relationship of item.relationships) {
            edges.push({
              source: relationship.source,
              target: relationship.target,
              type: relationship.type,
            });
          }
        }
        if (result.value.hasMore && result.value.nextCursor !== undefined && pagesLeft > 0) {
          consume(result.value.nextCursor, pagesLeft - 1);
        } else {
          setDependencies([...edges]);
          setChildCounts(new Map(counts));
        }
      });
    };
    consume();
    return () => {
      disposed = true;
    };
  }, []);

  // Escape steps back out: first it closes an open detail, then it walks up the
  // focus path one level, so a reader can always retreat the way they came in.
  useEffect(() => {
    if (selectedId === undefined && focusStack.length === 0) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectedId !== undefined) setSelectedId(undefined);
      else setFocusStack((stack) => stack.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, focusStack.length]);

  // The focused component's whole content must be present to draw it, so entering
  // a component loads every page of its children, not just the first. The effect
  // re-fires as each page arrives until the parent reports no more, and the
  // paging guard keeps it idempotent.
  useEffect(() => {
    if (focusId === undefined) return;
    const node = model.nodes.get(focusId);
    if (node === undefined) return;
    if (node.childIds === undefined) loadChildren(focusId);
    else if (node.hasMoreChildren) loadChildren(focusId, node.childrenCursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, model.nodes]);

  const loadChildren = (parentId: string, cursor?: string) => {
    if (pending.current.has(parentId)) return;
    pending.current.add(parentId);
    void fetchChildren(parentId, CHILD_LIMIT, cursor).then((result) => {
      pending.current.delete(parentId);
      if (result.ok) {
        setModel((current) => mergeChildrenPage(current, parentId, result.value));
      } else setFailure(result);
    });
  };

  const onExpand = (id: string) => {
    loadChildren(id);
  };
  const onFocus = (id: string) => {
    setSelectedId(undefined);
    setFolded((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setFocusStack((stack) => (stack.at(-1) === id ? stack : [...stack, id]));
  };
  const onFocusTo = (depth: number) => {
    setSelectedId(undefined);
    setFocusStack((stack) => stack.slice(0, depth));
  };
  const onToggleFold = (id: string) => {
    setFolded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const onLoadMoreChildren = (id: string) => {
    loadChildren(id, model.nodes.get(id)?.childrenCursor);
  };
  const onLoadMoreRoots = () => {
    void fetchRoots(ROOT_LIMIT, model.rootsCursor).then((result) => {
      if (result.ok) setModel((current) => mergeRootsPage(current, result.value));
    });
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = search.text.trim();
    if (text.length === 0 || text.length > 256) return;
    void fetchSearch(text, SEARCH_LIMIT).then((result) => {
      if (result.ok) setSearch((current) => ({ ...current, open: true, page: result.value }));
    });
  };
  const loadMoreMatches = () => {
    const cursor = search.page?.nextCursor;
    if (cursor === undefined) return;
    void fetchSearch(search.text.trim(), SEARCH_LIMIT, cursor).then((result) => {
      if (!result.ok) return;
      setSearch((current) =>
        current.page === undefined
          ? current
          : {
              ...current,
              page: { ...result.value, items: [...current.page.items, ...result.value.items] },
            },
      );
    });
  };

  const resolveDisplay = (id: string) => {
    const node = model.nodes.get(id);
    return node === undefined ? undefined : displayText(node.view.component);
  };

  const focusPath = focusStack.map((id) => ({ id, label: resolveDisplay(id) ?? id }));

  return (
    <div className="flex h-screen flex-col">
      <header
        data-canvas-keys="skip"
        className="z-20 flex items-center justify-between gap-3 border-b-2 border-ink bg-paper px-3 py-2 sm:gap-4 sm:px-5"
      >
        <div
          className="w-28 shrink-0 text-ink sm:w-36 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: GROMA_LOCKUP }}
        />
        <p className="m-0 hidden font-plan text-[11px] tracking-wide text-ink-muted uppercase md:block">
          Current blueprint{model.generation > 0 ? ` · generation ${model.generation}` : ""}
        </p>
        <div className="relative">
          <form onSubmit={submitSearch} className="flex gap-1.5">
            <input
              type="search"
              value={search.text}
              onChange={(event) => setSearch({ open: false, text: event.currentTarget.value })}
              onKeyDown={(event) => {
                if (event.key === "Escape") setSearch((current) => ({ ...current, open: false }));
              }}
              placeholder="Search the blueprint"
              aria-label="Search the blueprint"
              className="w-32 border border-ink bg-paper px-2 py-1.5 font-plan text-xs focus-visible:outline-2 focus-visible:outline-survey sm:w-56"
            />
            <button
              type="submit"
              className="border border-ink bg-paper px-2.5 py-1.5 font-plan text-xs hover:border-survey focus-visible:outline-2 focus-visible:outline-survey"
            >
              Search
            </button>
          </form>
          {search.open && search.page !== undefined ? (
            <div className="absolute top-full right-0 z-30 mt-1 max-h-80 w-80 overflow-auto border-[1.5px] border-ink bg-paper">
              {search.page.items.length === 0 ? (
                <p className="m-0 px-3 py-2 font-plan text-xs text-ink-muted">
                  No components match on this bounded page.
                </p>
              ) : (
                search.page.items.map((component) => (
                  <button
                    key={component.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(component.id);
                      setSearch((current) => ({ ...current, open: false }));
                    }}
                    className="block w-full border-0 border-b border-fine bg-transparent px-3 py-1.5 text-left text-xs hover:bg-fine focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-survey"
                  >
                    <span className="font-semibold">{displayText(component)}</span>
                    <span className="float-right font-plan text-[9px] text-ink-muted uppercase">
                      {component.type ?? "component"}
                    </span>
                    <br />
                    <span className="font-plan text-[10px] text-ink-muted">{component.id}</span>
                  </button>
                ))
              )}
              {search.page.hasMore ? (
                <button
                  type="button"
                  onClick={loadMoreMatches}
                  className="block w-full border-0 bg-transparent px-3 py-1.5 text-left font-plan text-[10px] text-ink-muted uppercase hover:bg-fine focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-survey"
                >
                  More matches · bounded page
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>
      <div className="relative min-h-0 flex-1">
        {failure !== undefined ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-desk">
            <div className="border border-amber bg-paper p-6 font-plan text-sm text-amber">
              {failure.diagnostics.map((diagnostic) => (
                <p key={diagnostic.code} className="m-0">
                  {diagnostic.message}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-full">
            <Canvas
              childCounts={childCounts}
              dependencies={dependencies}
              focusId={focusId}
              focusPath={focusPath}
              folded={folded}
              onVisibleScale={setVisibleScale}
              visibleScale={visibleScale}
              model={model}
              onExpand={onExpand}
              onFocus={onFocus}
              onFocusTo={onFocusTo}
              onLoadMoreChildren={onLoadMoreChildren}
              onLoadMoreRoots={onLoadMoreRoots}
              onSelect={setSelectedId}
              onToggleFold={onToggleFold}
              selectedId={selectedId}
            />
          </div>
        )}
        <SpecPanel
          onClose={() => setSelectedId(undefined)}
          resolveDisplay={resolveDisplay}
          selectedId={selectedId}
        />
      </div>
    </div>
  );
}
