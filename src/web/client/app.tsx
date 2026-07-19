import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  fetchChildren,
  fetchRoots,
  fetchSearch,
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
const SEARCH_LIMIT = 20;
const PANEL_WIDTH = 288;

const SHEET_GRID =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M24 0H0V24' fill='none' stroke='%23e4e5e1' stroke-width='.7'/%3E%3C/svg%3E\")";

interface SearchState {
  readonly open: boolean;
  readonly page?: ApiSearchPage;
  readonly text: string;
}

interface NodeBoxProps {
  readonly depth: number;
  readonly folded: ReadonlySet<string>;
  readonly id: string;
  readonly model: BlueprintModel;
  readonly onExpand: (id: string) => void;
  readonly onLoadMoreChildren: (id: string) => void;
  readonly onSelect: (id: string) => void;
  readonly onToggleFold: (id: string) => void;
  readonly selectedId?: string | undefined;
}

function NodeBox(props: NodeBoxProps) {
  const node = props.model.nodes.get(props.id);
  if (node === undefined) return null;
  const component = node.view.component;
  const isRoot = props.depth === 0;
  const childIds = node.childIds;
  const isFolded = props.folded.has(props.id);
  const selected = props.selectedId === props.id;
  const text = displayText(component);
  const foldControl =
    childIds === undefined ? (
      <button
        type="button"
        aria-label={`Show what lives inside ${text}`}
        onClick={() => props.onExpand(props.id)}
        className="w-4 shrink-0 border-0 bg-transparent p-0 text-left font-plan text-[10px] text-ink-muted hover:text-survey focus-visible:outline-2 focus-visible:outline-survey"
      >
        ▸
      </button>
    ) : childIds.length > 0 ? (
      <button
        type="button"
        aria-expanded={!isFolded}
        aria-label={`${isFolded ? "Unfold" : "Fold"} ${text}`}
        onClick={() => props.onToggleFold(props.id)}
        className="w-4 shrink-0 border-0 bg-transparent p-0 text-left font-plan text-[10px] text-ink-muted hover:text-survey focus-visible:outline-2 focus-visible:outline-survey"
      >
        {isFolded ? "▸" : "▾"}
      </button>
    ) : (
      <span aria-hidden="true" className="w-4 shrink-0 text-center font-plan text-[10px] text-line">
        ·
      </span>
    );
  return (
    <div className={isRoot ? "" : "mt-1.5 ml-2 border-l border-line pl-2"}>
      <div
        className={`flex min-h-7 items-center gap-1.5 border-b border-fine ${selected ? "border-r-[3px] border-r-survey outline-3 outline-double outline-ink" : ""}`}
      >
        {foldControl}
        <span
          aria-hidden="true"
          className={
            isRoot
              ? "h-2 w-2 shrink-0 rounded-full border-[1.5px] border-survey bg-survey shadow-[0_0_0_2px_var(--color-paper),0_0_0_3px_var(--color-survey)]"
              : "h-[7px] w-[7px] shrink-0 rounded-full border-[1.5px] border-ink bg-paper"
          }
        />
        <button
          type="button"
          onClick={() => props.onSelect(props.id)}
          aria-current={selected ? "true" : undefined}
          className={`min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-survey ${isRoot ? "text-base tracking-wide uppercase" : "text-[13px]"}`}
        >
          {text}
        </button>
        <span className="shrink-0 font-plan text-[9px] text-ink-muted uppercase">
          {component.type ?? "component"}
        </span>
      </div>
      {childIds !== undefined && childIds.length > 0 && !isFolded ? (
        <div>
          {childIds.map((childId) => (
            <NodeBox key={childId} {...props} depth={props.depth + 1} id={childId} />
          ))}
        </div>
      ) : null}
      {childIds !== undefined && node.hasMoreChildren && !isFolded ? (
        <button
          type="button"
          onClick={() => props.onLoadMoreChildren(props.id)}
          className="mt-1 ml-6 border border-line bg-paper px-1.5 py-0.5 font-plan text-[9px] text-ink-muted uppercase hover:border-survey focus-visible:outline-2 focus-visible:outline-survey"
        >
          More inside · bounded page
        </button>
      ) : null}
    </div>
  );
}

export function App() {
  const [model, setModel] = useState<BlueprintModel>(emptyModel);
  const [failure, setFailure] = useState<ApiFailure | undefined>(undefined);
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState<SearchState>({ open: false, text: "" });
  const [fitKey, setFitKey] = useState(0);
  const pending = useRef(new Set<string>());
  const initialFitDone = useRef(false);

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

  const loadChildren = (parentId: string, cursor?: string) => {
    if (pending.current.has(parentId)) return;
    pending.current.add(parentId);
    void fetchChildren(parentId, CHILD_LIMIT, cursor).then((result) => {
      pending.current.delete(parentId);
      if (result.ok) {
        setModel((current) => mergeChildrenPage(current, parentId, result.value));
      }
      if (!initialFitDone.current && pending.current.size === 0) {
        initialFitDone.current = true;
        setFitKey((value) => value + 1);
      }
    });
  };

  useEffect(() => {
    for (const rootId of model.rootIds) {
      const node = model.nodes.get(rootId);
      if (node !== undefined && node.childIds === undefined) loadChildren(rootId);
    }
    // Roots with no children still deserve one deterministic fit.
    if (!initialFitDone.current && model.rootIds.length > 0 && pending.current.size === 0) {
      initialFitDone.current = true;
      setFitKey((value) => value + 1);
    }
  }, [model]);

  const onExpand = (id: string) => {
    loadChildren(id);
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

  return (
    <div className="flex h-screen flex-col">
      <header
        data-canvas-keys="skip"
        className="z-20 flex items-center justify-between gap-4 border-b-2 border-ink bg-paper px-5 py-2"
      >
        <div
          className="w-36 shrink-0 text-ink [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
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
              className="w-56 border border-ink bg-paper px-2 py-1.5 font-plan text-xs focus-visible:outline-2 focus-visible:outline-survey"
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
          <div className="flex h-full flex-col">
            <Canvas fitKey={fitKey} reserveRight={PANEL_WIDTH}>
              <div
                className="w-[1480px] border-[1.5px] border-ink bg-paper p-6 shadow-[0_14px_34px_rgba(32,36,34,.08)]"
                style={{ backgroundImage: SHEET_GRID }}
              >
                <header className="mb-4 flex items-end justify-between border-b-2 border-ink pb-2">
                  <p className="m-0 text-base font-bold tracking-[.08em] uppercase">
                    Architectural blueprint
                  </p>
                  <table className="border-[1.5px] border-ink font-plan text-[10px]">
                    <tbody>
                      <tr>
                        <th className="border border-line px-2 py-0.5 text-left font-normal tracking-widest text-ink-muted">
                          DIAGRAM
                        </th>
                        <td className="border border-line px-2 py-0.5">CURRENT BLUEPRINT</td>
                        <th className="border border-line px-2 py-0.5 text-left font-normal tracking-widest text-ink-muted">
                          GENERATION
                        </th>
                        <td className="border border-line px-2 py-0.5">{model.generation}</td>
                        <th className="border border-line px-2 py-0.5 text-left font-normal tracking-widest text-ink-muted">
                          COMPONENTS
                        </th>
                        <td className="border border-line px-2 py-0.5">{model.nodes.size}</td>
                      </tr>
                    </tbody>
                  </table>
                </header>
                <main className="grid grid-cols-4 items-start gap-4">
                  {model.rootIds.length === 0 ? (
                    <p className="col-span-4 border border-dashed border-line p-6 text-[13px]">
                      Reading the current blueprint…
                    </p>
                  ) : (
                    model.rootIds.map((rootId) => (
                      <section
                        key={rootId}
                        className="border-[1.5px] border-ink bg-paper/95 p-2.5 shadow-[0_10px_24px_rgba(32,36,34,.07)]"
                      >
                        <NodeBox
                          depth={0}
                          folded={folded}
                          id={rootId}
                          model={model}
                          onExpand={onExpand}
                          onLoadMoreChildren={onLoadMoreChildren}
                          onSelect={setSelectedId}
                          onToggleFold={onToggleFold}
                          selectedId={selectedId}
                        />
                      </section>
                    ))
                  )}
                </main>
                {model.hasMoreRoots ? (
                  <div className="mt-4 border border-dashed border-amber p-3 font-plan text-[10px] text-amber uppercase">
                    Bounded view · more root components available{" "}
                    <button
                      type="button"
                      onClick={onLoadMoreRoots}
                      className="ml-2 border border-amber bg-paper px-2 py-0.5 font-plan text-[10px] text-amber uppercase hover:border-survey hover:text-survey focus-visible:outline-2 focus-visible:outline-survey"
                    >
                      Load the next bounded page
                    </button>
                  </div>
                ) : null}
                <footer className="mt-4 flex justify-end">
                  <div className="border-[1.5px] border-ink bg-paper px-3 py-2 text-[10px] leading-relaxed">
                    <span className="mr-2 inline-block w-3 border-t-2 border-ink align-middle" />
                    canonical boundary
                    <span className="mr-2 ml-4 inline-block w-3 border-t-2 border-survey align-middle" />
                    surveyed root point
                    <span className="ml-4 text-ink-muted">
                      Nested boundaries show containment. Folding, focus, pan, and zoom are
                      view-local.
                    </span>
                  </div>
                </footer>
              </div>
            </Canvas>
          </div>
        )}
        <SpecPanel resolveDisplay={resolveDisplay} selectedId={selectedId} />
      </div>
    </div>
  );
}
