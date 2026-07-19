import {
  CLI_MAX_RENDERED_BYTES,
  type CliOverviewNode,
  type CliOverviewResult,
} from "./contracts.ts";

type Hierarchy = Extract<CliOverviewResult, { readonly kind: "hierarchy" }>;
interface TreeNode {
  readonly item: CliOverviewNode;
  readonly children: TreeNode[];
  readonly path: readonly string[];
}

const GROMA_LOCKUP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 120" role="img" aria-label="groma.md lockup">
  <g transform="translate(12,8) scale(0.94)">
    <circle cx="50" cy="6" r="5" fill="currentColor"/>
    <line x1="50" y1="12" x2="50" y2="94" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
    <line x1="22" y1="32" x2="78" y2="32" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
    <line x1="22" y1="36" x2="22" y2="62" stroke="currentColor" stroke-width="4"/>
    <path d="M15 62 L29 62 L22 76 Z" fill="currentColor"/>
    <line x1="78" y1="36" x2="78" y2="62" stroke="currentColor" stroke-width="4"/>
    <path d="M71 62 L85 62 L78 76 Z" fill="currentColor"/>
    <line x1="30" y1="94" x2="70" y2="94" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
  </g>
  <text x="128" y="82" fill="currentColor" font-family="system-ui, -apple-system, 'Segoe UI', 'Helvetica Neue', sans-serif" font-size="60" font-weight="500" letter-spacing="0.5">groma</text>
  <text x="306" y="82" fill="#1D9E75" font-family="system-ui, -apple-system, 'Segoe UI', 'Helvetica Neue', sans-serif" font-size="60" font-weight="500">.md</text>
</svg>`;

function escape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function tree(nodes: readonly CliOverviewNode[]): readonly TreeNode[] {
  const roots: TreeNode[] = [];
  const stack: TreeNode[] = [];
  for (const item of nodes) {
    while (stack.length > item.depth) stack.pop();
    const parent = item.depth === 0 ? undefined : stack[item.depth - 1];
    const node: TreeNode = {
      item,
      children: [],
      path: Object.freeze([...(parent?.path ?? []), item.id]),
    };
    (parent?.children ?? roots).push(node);
    stack[item.depth] = node;
  }
  return Object.freeze(roots);
}

function truncationText(reasons: ReadonlySet<string>): string {
  const labels = [...reasons]
    .sort()
    .map((reason) =>
      reason === "children"
        ? "child page limit"
        : reason === "depth"
          ? "depth limit"
          : reason === "nodes"
            ? "node limit"
            : reason === "queries"
              ? "query limit"
              : "root page limit",
    );
  return `Bounded view stops here: ${labels.join(", ")}.`;
}

function nodeHtml(node: TreeNode, truncations: ReadonlyMap<string, ReadonlySet<string>>): string {
  const item = node.item;
  const children = node.children.map((child) => nodeHtml(child, truncations)).join("");
  const type = item.type ?? "component";
  const truncated = truncations.get(item.id);
  return `<details class="node depth-${item.depth}" data-id="${escape(item.id)}" data-path="${escape(node.path.join(" "))}" open><summary data-id="${escape(item.id)}" data-display="${escape(item.displayText)}" data-name="${escape(item.name ?? "")}" data-type="${escape(type)}"><span class="point" aria-hidden="true"></span><span class="node-name">${escape(item.displayText)}</span><span class="node-type">${escape(type)}</span></summary>${children.length > 0 ? `<div class="children">${children}</div>` : ""}${truncated === undefined ? "" : `<p class="truncated">${truncationText(truncated)}</p>`}</details>`;
}

export function renderBlueprintHtml(
  value: Hierarchy,
): { readonly ok: false } | { readonly html: string; readonly ok: true } {
  const truncatedParents = new Map<string, Set<string>>();
  for (const item of value.truncations) {
    if (item.parent === undefined) continue;
    const reasons = truncatedParents.get(item.parent) ?? new Set<string>();
    reasons.add(item.reason);
    truncatedParents.set(item.parent, reasons);
  }
  const roots = tree(value.nodes)
    .map((node) => `<section class="plate">${nodeHtml(node, truncatedParents)}</section>`)
    .join("");
  const globalReasons = new Set(
    value.truncations.filter((item) => item.parent === undefined).map((item) => item.reason),
  );
  const globalTruncation =
    globalReasons.size === 0
      ? ""
      : `<p class="global-truncation">${truncationText(globalReasons)}</p>`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>groma.md · blueprint ${value.generation}</title>
<style>
:root{--paper:#fbfaf6;--ink:#202422;--muted:#69716d;--line:#a9afab;--fine:#dfe2de;--green:#1D9E75;--amber:#8a5b12;font-family:"DIN 2014","Bahnschrift","Avenir Next",sans-serif;color:var(--ink);background:var(--paper)}*{box-sizing:border-box}body{margin:0;min-height:100vh;background-color:var(--paper);background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M24 0H0V24' fill='none' stroke='%23e4e5e1' stroke-width='.7'/%3E%3C/svg%3E")}.sheet{min-height:100vh;padding:24px;display:grid;grid-template-columns:minmax(0,1fr) 280px;grid-template-rows:auto 1fr;gap:18px}.title{grid-column:1/-1;display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid var(--ink);padding:0 2px 10px}.brand{font-size:28px;font-weight:750;letter-spacing:-.04em}.brand span{color:var(--green)}.meta{font:12px ui-monospace,SFMono-Regular,monospace;text-align:right;color:var(--muted)}main{min-width:0}.plates{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px;align-items:start}.plate{background:rgba(251,250,246,.94);border:1.5px solid var(--ink);box-shadow:0 10px 24px rgba(32,36,34,.07);padding:10px}.node{border-left:1px solid var(--line);margin:7px 0 0 8px;padding-left:9px}.plate>.node{border-left:0;margin:0;padding:0}.node summary{cursor:pointer;list-style:none;display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:8px;align-items:center;min-height:30px;border-bottom:1px solid var(--fine);outline-offset:3px}.node summary::-webkit-details-marker{display:none}.node summary:hover .node-name,.node summary:focus-visible .node-name{text-decoration:underline}.point{width:7px;height:7px;border:1.5px solid var(--ink);border-radius:50%;background:var(--paper)}.plate>.node>summary .point{background:var(--green);border-color:var(--green);box-shadow:0 0 0 2px var(--paper),0 0 0 3px var(--green)}.node-name{font-size:13px;font-weight:650;overflow-wrap:anywhere}.plate>.node>summary .node-name{font-size:16px;text-transform:uppercase;letter-spacing:.04em}.node-type{font:9px ui-monospace,SFMono-Regular,monospace;color:var(--muted);text-transform:uppercase}.children{padding:1px 0 3px}.truncated{font:10px ui-monospace,SFMono-Regular,monospace;color:var(--amber);border-left:3px double var(--amber);padding-left:7px}.muted{display:none}.spec{border:1.5px solid var(--ink);align-self:start;position:sticky;top:24px;background:var(--paper)}.spec h2,.spec h3{margin:0;padding:9px 11px;border-bottom:1px solid var(--ink);font-size:11px;text-transform:uppercase;letter-spacing:.12em}.spec dl{margin:0;padding:10px 11px}.spec dt{font:9px ui-monospace,SFMono-Regular,monospace;color:var(--muted);text-transform:uppercase;margin-top:9px}.spec dd{margin:2px 0;font-size:12px;overflow-wrap:anywhere}.controls{display:flex;gap:6px;padding:10px 11px;border-top:1px solid var(--line)}button{font:10px ui-monospace,SFMono-Regular,monospace;background:var(--paper);border:1px solid var(--ink);padding:7px 9px;cursor:pointer}button:hover,button:focus-visible{border-color:var(--green);outline:2px solid var(--green);outline-offset:1px}.legend{padding:10px 11px;font-size:10px;line-height:1.6}.legend b{display:inline-block;width:12px;border-top:2px solid var(--ink);margin-right:6px}.legend .survey{border-color:var(--green)}.empty{border:1px dashed var(--line);padding:24px;font-size:13px}${globalTruncation ? ".plates:after{content:'BOUNDED VIEW · MORE ROOTS AVAILABLE';font:10px ui-monospace,SFMono-Regular,monospace;color:var(--amber);border:1px dashed var(--amber);padding:12px}" : ""}@media(max-width:800px){.sheet{grid-template-columns:1fr;padding:14px}.title{grid-column:1}.spec{position:static;grid-row:3}.plates{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
/* Canonical lockup markup from brand/lockup.svg; CSS changes only its display size. */
.brand{width:180px;color:var(--ink);font-size:0}.brand svg{display:block;width:100%;height:auto}.node.selected>summary{outline:3px double var(--ink);border-right:3px solid var(--green);padding-right:5px}.truncated,.global-truncation{font:10px ui-monospace,SFMono-Regular,monospace;color:var(--amber);border-left:3px double var(--amber);padding-left:7px}.global-truncation{border:1px dashed var(--amber);padding:12px}.plates:after{display:none!important}
</style></head><body><div class="sheet"><header class="title"><div class="brand">${GROMA_LOCKUP}</div><div class="meta">CURRENT BLUEPRINT<br>GENERATION ${value.generation} · ${value.nodes.length} NODES</div></header><main><div class="plates">${roots || '<p class="empty">The current blueprint contains no visible components.</p>'}${globalTruncation}</div></main><aside class="spec" aria-live="polite"><h2>Drawing specification</h2><dl><dt>Selection</dt><dd id="detail-display">Select a component</dd><dt>Canonical name</dt><dd id="detail-name">—</dd><dt>Type</dt><dd id="detail-type">—</dd><dt>Stable identity</dt><dd id="detail-id">—</dd></dl><div class="controls"><button id="focus" type="button">Focus</button><button id="reset" type="button">Reset</button></div><h3>Notation</h3><div class="legend"><div><b></b> canonical boundary</div><div><b class="survey"></b> surveyed root point</div><div>Nested lines show containment. Folding and focus are view-local.</div></div></aside></div>
<script>(()=>{let selected=null;const all=[...document.querySelectorAll('.node')];const display=document.querySelector('#detail-display'),name=document.querySelector('#detail-name'),type=document.querySelector('#detail-type'),id=document.querySelector('#detail-id');document.addEventListener('click',e=>{const s=e.target.closest('summary');if(!s)return;for(const n of all){const active=n.dataset.id===s.dataset.id;n.classList.toggle('selected',active);const summary=n.querySelector(':scope>summary');if(active)summary.setAttribute('aria-current','true');else summary.removeAttribute('aria-current')}selected=s.dataset.id;display.textContent=s.dataset.display;name.textContent=s.dataset.name||'\u2014';type.textContent=s.dataset.type;id.textContent=selected});document.querySelector('#focus').addEventListener('click',()=>{if(!selected)return;const chosen=all.find(n=>n.dataset.id===selected);const path=chosen.dataset.path.split(' ');for(const n of all){const own=n.dataset.path.split(' ');n.classList.toggle('muted',!own.includes(selected)&&!path.includes(n.dataset.id))}});document.querySelector('#reset').addEventListener('click',()=>{for(const n of all)n.classList.remove('muted')})})();</script></body></html>\n`;
  return new TextEncoder().encode(html).byteLength <= CLI_MAX_RENDERED_BYTES
    ? Object.freeze({ html, ok: true as const })
    : Object.freeze({ ok: false as const });
}
