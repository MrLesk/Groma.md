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
import { SpecPanel } from "./spec.tsx";

const ROOT_LIMIT = 100;
const CHILD_LIMIT = 100;
const CONNECTION_LIMIT = 100;
const SEARCH_LIMIT = 20;
const MAX_INTERNAL_PAGES = 16;

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
  const [focusStack, setFocusStack] = useState<readonly { id: string; label: string }[]>([]);
  const [childCounts, setChildCounts] = useState<ReadonlyMap<string, number>>(new Map());
  const pending = useRef(new Set<string>());
  const pendingRoots = useRef(false);
  const mounted = useRef(true);
  const autoExpanded = useRef(new Set<string>());
  const focusId = focusStack.at(-1)?.id;
  // The component the sheet is framed on: the one walked into, or the single
  // owned system at the top. Its whole content is what the level draws, so it is
  // the node whose children must be paged to completion — matching how the canvas
  // chooses the frame, so what is drawn and what is loaded never disagree.
  const ownedRootIds = model.rootIds.filter(
    (id) => model.nodes.get(id)?.view.component.type !== "external",
  );
  const soleOwnedRootId = ownedRootIds.length === 1 ? ownedRootIds[0] : undefined;
  const frameId = focusId ?? soleOwnedRootId;

  const loadRoots = (cursor?: string) => {
    if (pendingRoots.current) return;
    pendingRoots.current = true;
    void (async () => {
      let next = cursor;
      for (let page = 0; page < MAX_INTERNAL_PAGES; page += 1) {
        const result = await fetchRoots(ROOT_LIMIT, next);
        if (!mounted.current) return;
        if (!result.ok) {
          setFailure(result);
          break;
        }
        setModel((current) => mergeRootsPage(current, result.value));
        if (!result.value.hasMore || result.value.nextCursor === undefined) break;
        next = result.value.nextCursor;
      }
    })().finally(() => {
      pendingRoots.current = false;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open the system's own parts on arrival, so a reader meets the architecture
  // rather than a single collapsed box they must first know to click. Only
  // the sole owned root expands; multi-root blueprints defer child reads until
  // the reader focuses one root.
  useEffect(() => {
    if (soleOwnedRootId === undefined) return;
    const rootId = soleOwnedRootId;
    const node = model.nodes.get(rootId);
    if (node === undefined || autoExpanded.current.has(rootId)) return;
    if (node.childIds !== undefined) return;
    autoExpanded.current.add(rootId);
    loadChildren(rootId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soleOwnedRootId]);

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

  // A focus gathers bounded pages internally, then the disposable projection
  // selects one readable semantic level. Page mechanics never enter the UI.
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
    void (async () => {
      let next = cursor;
      for (let page = 0; page < MAX_INTERNAL_PAGES; page += 1) {
        const result = await fetchChildren(parentId, CHILD_LIMIT, next);
        if (!mounted.current) return;
        if (!result.ok) {
          setFailure(result);
          break;
        }
        setModel((current) => mergeChildrenPage(current, parentId, result.value));
        if (!result.value.hasMore || result.value.nextCursor === undefined) break;
        next = result.value.nextCursor;
      }
    })().finally(() => {
      pending.current.delete(parentId);
    });
  };

  const onFocus = (id: string, label: string) => {
    setCreateOpen(false);
    setSelectedId(undefined);
    setFocusStack((stack) => (stack.at(-1)?.id === id ? stack : [...stack, { id, label }]));
  };
  const onFocusTo = (depth: number) => {
    setCreateOpen(false);
    setSelectedId(undefined);
    setFocusStack((stack) => stack.slice(0, depth));
  };
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = search.text.trim();
    if (text.length === 0 || text.length > 256) return;
    void fetchSearch(text, SEARCH_LIMIT).then((result) => {
      if (result.ok) setSearch((current) => ({ ...current, open: true, page: result.value }));
    });
  };
  const resolveDisplay = (id: string) => {
    const node = model.nodes.get(id);
    return node === undefined ? undefined : displayText(node.view.component);
  };

  const focusPath = focusStack;

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
              focusPath={focusPath}
              model={model}
              onFocus={onFocus}
              onFocusTo={onFocusTo}
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
