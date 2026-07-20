import { useEffect, useState } from "react";

import { fetchRoots, type ApiComponentPage, type ApiFailure } from "./api.ts";
import { GROMA_LOCKUP } from "./brand.ts";

type Shell =
  | { readonly state: "loading" }
  | { readonly state: "unavailable"; readonly failure: ApiFailure }
  | { readonly state: "ready"; readonly roots: ApiComponentPage };

export function App() {
  const [shell, setShell] = useState<Shell>({ state: "loading" });

  useEffect(() => {
    let disposed = false;
    void fetchRoots(20).then((page) => {
      if (disposed) return;
      if (page.ok) setShell({ roots: page.value, state: "ready" });
      else setShell({ failure: page, state: "unavailable" });
    });
    return () => {
      disposed = true;
    };
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-end justify-between border-b-2 border-ink bg-paper px-5 py-3">
        <div
          className="w-40 text-ink [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: GROMA_LOCKUP }}
        />
        <p className="font-plan text-xs tracking-wide text-ink-muted uppercase">
          {shell.state === "ready"
            ? `Current blueprint · generation ${shell.roots.generation}`
            : "Current blueprint"}
        </p>
      </header>
      <main className="flex min-h-0 flex-1 items-center justify-center">
        {shell.state === "loading" ? (
          <p className="font-plan text-sm text-ink-muted">Reading the current blueprint…</p>
        ) : shell.state === "unavailable" ? (
          <div className="border border-amber p-6 font-plan text-sm text-amber">
            {shell.failure.diagnostics.map((diagnostic) => (
              <p key={diagnostic.code}>{diagnostic.message}</p>
            ))}
          </div>
        ) : (
          <div className="border-[1.5px] border-ink bg-paper p-6">
            <h1 className="m-0 text-base font-semibold tracking-wide uppercase">
              Blueprint reachable
            </h1>
            <p className="font-plan text-sm text-ink-muted">
              {shell.roots.items.length} root component
              {shell.roots.items.length === 1 ? "" : "s"} on the first bounded page
              {shell.roots.hasMore ? " · more available" : ""}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
