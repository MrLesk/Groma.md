import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  fetchChildren,
  fetchConnections,
  fetchRoots,
  fetchSearch,
  isStaticBlueprintSnapshot,
  type ApiFailure,
  type ApiSearchPage,
} from "./api.ts";
import { GROMA_LOCKUP } from "./brand.ts";
import { Canvas } from "./canvas.tsx";
import {
  componentPurpose,
  displayText,
  emptyModel,
  isImplementationEvidence,
  mergeChildrenPage,
  mergeRootsPage,
  type BlueprintModel,
} from "./model.ts";
import { shouldContinueOwnedRootDiscovery } from "./root-discovery.ts";
import { SpecPanel } from "./spec.tsx";

const ROOT_LIMIT = 20;
const CHILD_LIMIT = 12;
const CONNECTION_LIMIT = 100;
const SEARCH_LIMIT = 20;

interface SearchState {
  readonly open: boolean;
  readonly page?: ApiSearchPage;
  readonly text: string;
}

export function App() {
  const exported = isStaticBlueprintSnapshot();
  const [model, setModel] = useState<BlueprintModel>(emptyModel);
  const [failure, setFailure] = useState<ApiFailure | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState<SearchState>({ open: false, text: "" });
  const [dependencies, setDependencies] = useState<
    readonly { source: string; target: string; type: string }[]
  >([]);
  const [focusStack, setFocusStack] = useState<readonly string[]>([]);
  const [childCounts, setChildCounts] = useState<ReadonlyMap<string, number>>(new Map());
  const pending = useRef(new Set<string>());
  const pendingRoots = useRef(false);
  const rootPagesRead = useRef(0);
  const mounted = useRef(true);
  const autoExpanded = useRef(new Set<string>());
  const focusId = focusStack.at(-1);
  // The component the sheet is framed on: the one walked into, or the single
  // owned system at the top. Its whole content is what the level draws, so it is
  // the node whose children must be paged to completion — matching how the canvas
  // chooses the frame, so what is drawn and what is loaded never disagree.
  const ownedRootIds = model.rootIds.filter(
    (id) => model.nodes.get(id)?.view.component.type !== "external",
  );
  const frameId = focusId ?? (ownedRootIds.length === 1 ? ownedRootIds[0] : undefined);

  const loadRoots = (cursor?: string) => {
    if (pendingRoots.current) return;
    pendingRoots.current = true;
    void fetchRoots(ROOT_LIMIT, cursor).then((result) => {
      pendingRoots.current = false;
      if (!mounted.current) return;
      if (result.ok) {
        rootPagesRead.current += 1;
        setModel((current) => mergeRootsPage(current, result.value));
      } else setFailure(result);
    });
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    loadRoots();
    // The reader sees one bounded root page immediately. Later pages are chosen
    // below only when opaque root ordering has not yet reached owned code.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scanner identities deliberately sort opaquely, so a dependency-heavy project
  // can place many borrowed roots before its own system. Continue a small, explicit
  // root budget until the drawing has an owned plate; the existing "more roots"
  // control remains responsible for anything beyond that budget.
  useEffect(() => {
    if (!shouldContinueOwnedRootDiscovery(model, rootPagesRead.current)) return;
    loadRoots(model.rootsCursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.hasMoreRoots, model.nodes, model.rootIds, model.rootsCursor]);

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

  // A focus reads one bounded page. The canvas then applies the stricter visual
  // budget and sends the reader to focus/search for the rest; it never pages a
  // level to exhaustion and then shrinks the result below readable scale.
  useEffect(() => {
    if (frameId === undefined) return;
    const node = model.nodes.get(frameId);
    if (node === undefined) return;
    if (node.childIds === undefined) loadChildren(frameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameId, model.nodes]);

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

  const onFocus = (id: string) => {
    setCreateOpen(false);
    setSelectedId(undefined);
    setFocusStack((stack) => (stack.at(-1) === id ? stack : [...stack, id]));
  };
  const onFocusTo = (depth: number) => {
    setCreateOpen(false);
    setSelectedId(undefined);
    setFocusStack((stack) => stack.slice(0, depth));
  };
  const onLoadMoreRoots = () => {
    if (model.rootsCursor !== undefined) loadRoots(model.rootsCursor);
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
        className="z-20 flex items-center justify-between gap-3 border-b border-line bg-paper px-3 py-1.5 sm:gap-4 sm:px-5"
      >
        <div
          className="w-24 shrink-0 text-ink sm:w-28 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: GROMA_LOCKUP }}
        />
        <p className="m-0 hidden font-plan text-[11px] tracking-wide text-ink-muted uppercase md:block">
          {exported ? "Read-only export" : "Current blueprint"}
          {model.generation > 0 ? ` · generation ${model.generation}` : ""}
        </p>
        <div className="relative flex gap-1.5">
          {exported ? null : (
            <button
              type="button"
              onClick={() => {
                setSelectedId(undefined);
                setCreateOpen(true);
              }}
              className="border border-ink bg-paper px-2.5 py-1.5 font-plan text-xs hover:border-survey focus-visible:outline-2 focus-visible:outline-survey"
            >
              New component
            </button>
          )}
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
            <div className="absolute top-full right-0 z-30 mt-1 max-h-[70vh] w-96 overflow-auto border-[1.5px] border-ink bg-paper">
              {search.page.items.length === 0 ? (
                <p className="m-0 px-3 py-2 font-plan text-xs text-ink-muted">
                  No components match on this bounded page.
                </p>
              ) : (
                search.page.items.map((item) => {
                  const { component } = item;
                  const implementation = isImplementationEvidence(component, item.evidenceBound);
                  const parent =
                    component.parent === undefined ? undefined : resolveDisplay(component.parent);
                  return (
                    <div key={component.id} className="groma-search-result">
                      <button
                        type="button"
                        onClick={() => {
                          setCreateOpen(false);
                          setSelectedId(component.id);
                          setSearch((current) => ({ ...current, open: false }));
                        }}
                      >
                        <span className="groma-search-result__cue">
                          {implementation
                            ? "Implementation evidence"
                            : componentPurpose(component) === undefined
                              ? "Purpose not recorded"
                              : "Architectural intent"}
                        </span>
                        <strong>{displayText(component)}</strong>
                        <span className="groma-search-result__purpose">
                          {componentPurpose(component) ?? "No purpose has been written yet."}
                        </span>
                        <span className="groma-search-result__context">
                          {component.parent === undefined
                            ? "Blueprint root"
                            : `Inside ${parent ?? "another component"}`}
                        </span>
                      </button>
                      <details>
                        <summary>Technical details</summary>
                        <code>{component.id}</code>
                      </details>
                    </div>
                  );
                })
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
              model={model}
              onFocus={onFocus}
              onFocusTo={onFocusTo}
              onLoadMoreRoots={onLoadMoreRoots}
              onSelect={(id) => {
                setCreateOpen(false);
                setSelectedId(id);
              }}
              selectedId={selectedId}
            />
          </div>
        )}
        <SpecPanel
          createOpen={createOpen}
          onClose={() => {
            setCreateOpen(false);
            setSelectedId(undefined);
          }}
          onCommitted={() => window.location.reload()}
          resolveDisplay={resolveDisplay}
          selectedId={selectedId}
        />
      </div>
    </div>
  );
}
