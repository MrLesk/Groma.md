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
:root{--paper:#fbfaf6;--desk:#edeeea;--ink:#202422;--muted:#69716d;--line:#a9afab;--fine:#dfe2de;--green:#1D9E75;--amber:#8a5b12;font-family:"DIN 2014","Bahnschrift","Avenir Next",sans-serif;color:var(--ink);background:var(--desk)}*{box-sizing:border-box}body{margin:0;height:100vh;overflow:hidden;background:var(--desk)}.viewport{position:fixed;inset:0;overflow:hidden;cursor:grab;touch-action:none}.viewport.panning{cursor:grabbing}.stage{position:absolute;left:0;top:0;width:1480px;transform-origin:0 0}.sheet{width:1480px;padding:24px;border:1px solid var(--line);box-shadow:0 14px 34px rgba(32,36,34,.08);background-color:var(--paper);background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M24 0H0V24' fill='none' stroke='%23e4e5e1' stroke-width='.7'/%3E%3C/svg%3E")}.title{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid var(--ink);padding:0 2px 10px;margin-bottom:18px}.brand{width:180px;color:var(--ink);font-size:0}.brand svg{display:block;width:100%;height:auto}.meta{font:12px ui-monospace,SFMono-Regular,monospace;text-align:right;color:var(--muted)}main{min-width:0}.plates{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px;align-items:start}.plate{background:rgba(251,250,246,.94);border:1.5px solid var(--ink);box-shadow:0 10px 24px rgba(32,36,34,.07);padding:10px}.node{border-left:1px solid var(--line);margin:7px 0 0 8px;padding-left:9px}.plate>.node{border-left:0;margin:0;padding:0}.node summary{cursor:pointer;list-style:none;display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:8px;align-items:center;min-height:30px;border-bottom:1px solid var(--fine);outline-offset:3px}.node summary::-webkit-details-marker{display:none}.node summary:hover .node-name,.node summary:focus-visible .node-name{text-decoration:underline}.point{width:7px;height:7px;border:1.5px solid var(--ink);border-radius:50%;background:var(--paper)}.plate>.node>summary .point{background:var(--green);border-color:var(--green);box-shadow:0 0 0 2px var(--paper),0 0 0 3px var(--green)}.node-name{font-size:13px;font-weight:650;overflow-wrap:anywhere}.plate>.node>summary .node-name{font-size:16px;text-transform:uppercase;letter-spacing:.04em}.node-type{font:9px ui-monospace,SFMono-Regular,monospace;color:var(--muted);text-transform:uppercase}.children{padding:1px 0 3px}.muted{display:none}.spec{position:fixed;top:16px;right:16px;width:280px;max-height:calc(100vh - 32px);overflow:auto;border:1.5px solid var(--ink);background:var(--paper);z-index:2}.spec h2,.spec h3{margin:0;padding:9px 11px;border-bottom:1px solid var(--ink);font-size:11px;text-transform:uppercase;letter-spacing:.12em}.spec dl{margin:0;padding:10px 11px}.spec dt{font:9px ui-monospace,SFMono-Regular,monospace;color:var(--muted);text-transform:uppercase;margin-top:9px}.spec dd{margin:2px 0;font-size:12px;overflow-wrap:anywhere}.controls{display:flex;flex-wrap:wrap;gap:6px;padding:10px 11px;border-top:1px solid var(--line)}button{font:10px ui-monospace,SFMono-Regular,monospace;background:var(--paper);border:1px solid var(--ink);padding:7px 9px;cursor:pointer}button:hover,button:focus-visible{border-color:var(--green);outline:2px solid var(--green);outline-offset:1px}.legend{padding:10px 11px;font-size:10px;line-height:1.6}.legend b{display:inline-block;width:12px;border-top:2px solid var(--ink);margin-right:6px}.legend .survey{border-color:var(--green)}.empty{border:1px dashed var(--line);padding:24px;font-size:13px}.node.selected>summary{outline:3px double var(--ink);border-right:3px solid var(--green);padding-right:5px}.truncated,.global-truncation{font:10px ui-monospace,SFMono-Regular,monospace;color:var(--amber);border-left:3px double var(--amber);padding-left:7px}.global-truncation{border:1px dashed var(--amber);padding:12px;margin:16px 0 0}@media(max-width:800px){.spec{width:min(280px,calc(100vw - 24px))}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
/* Canonical lockup markup from brand/lockup.svg; CSS changes only its display size. */
</style></head><body><div class="viewport" id="viewport"><div class="stage" id="stage"><div class="sheet"><header class="title"><div class="brand">${GROMA_LOCKUP}</div><div class="meta">CURRENT BLUEPRINT<br>GENERATION ${value.generation} · ${value.nodes.length} NODES</div></header><main><div class="plates">${roots || '<p class="empty">The current blueprint contains no visible components.</p>'}</div>${globalTruncation}</main></div></div></div><aside class="spec" aria-live="polite"><h2>Drawing specification</h2><dl><dt>Selection</dt><dd id="detail-display">Select a component</dd><dt>Canonical name</dt><dd id="detail-name">—</dd><dt>Type</dt><dd id="detail-type">—</dd><dt>Stable identity</dt><dd id="detail-id">—</dd></dl><div class="controls"><button id="focus" type="button">Focus</button><button id="reset" type="button">Reset</button><button id="zoom-out" type="button" aria-label="Zoom out">−</button><button id="zoom-in" type="button" aria-label="Zoom in">+</button><button id="fit" type="button">Fit</button></div><h3>Notation</h3><div class="legend"><div><b></b> canonical boundary</div><div><b class="survey"></b> surveyed root point</div><div>Nested lines show containment. Folding and focus are view-local.</div><div>Drag, scroll, or arrow keys move the sheet · pinch, ctrl+wheel, + and − zoom · 0 or Fit shows everything. The view is never saved.</div></div></aside>
<script>(()=>{let selected=null;const all=[...document.querySelectorAll('.node')];const display=document.querySelector('#detail-display'),name=document.querySelector('#detail-name'),type=document.querySelector('#detail-type'),id=document.querySelector('#detail-id');document.addEventListener('click',e=>{const s=e.target.closest('summary');if(!s)return;for(const n of all){const active=n.dataset.id===s.dataset.id;n.classList.toggle('selected',active);const summary=n.querySelector(':scope>summary');if(active)summary.setAttribute('aria-current','true');else summary.removeAttribute('aria-current')}selected=s.dataset.id;display.textContent=s.dataset.display;name.textContent=s.dataset.name||'—';type.textContent=s.dataset.type;id.textContent=selected});document.querySelector('#focus').addEventListener('click',()=>{if(!selected)return;const chosen=all.find(n=>n.dataset.id===selected);const path=chosen.dataset.path.split(' ');for(const n of all){const own=n.dataset.path.split(' ');n.classList.toggle('muted',!own.includes(selected)&&!path.includes(n.dataset.id))}});document.querySelector('#reset').addEventListener('click',()=>{for(const n of all)n.classList.remove('muted')});
/* Disposable canvas view state: translate+scale kept only in memory, never persisted. */
const vp=document.querySelector('#viewport'),st=document.querySelector('#stage');let vx=0,vy=0,vs=1;const MIN=.1,MAX=3;const apply=()=>{st.style.transform='translate('+vx+'px,'+vy+'px) scale('+vs+')'};const clamp=v=>Math.min(MAX,Math.max(MIN,v));const fit=()=>{const r=vp.getBoundingClientRect(),w=st.offsetWidth,h=st.offsetHeight,sp=document.querySelector('.spec');const reserve=sp&&r.width-sp.offsetWidth-48>240?sp.offsetWidth+32:0;const aw=r.width-reserve-48,ah=r.height-48;vs=clamp(Math.min(aw/w,ah/h));vx=Math.round((aw-w*vs)/2+24);vy=Math.max(24,Math.round((r.height-h*vs)/2));apply()};const zoomAt=(px,py,f)=>{const ns=clamp(vs*f);if(ns===vs)return;const k=ns/vs;vx=px-(px-vx)*k;vy=py-(py-vy)*k;vs=ns;apply()};const zoomCenter=f=>{const r=vp.getBoundingClientRect();zoomAt(r.width/2,r.height/2,f)};
vp.addEventListener('wheel',e=>{e.preventDefault();if(e.ctrlKey||e.metaKey)zoomAt(e.clientX,e.clientY,Math.exp(-e.deltaY*.01));else{vx-=e.deltaX;vy-=e.deltaY;apply()}},{passive:false});
const pts=new Map();let pid=null,sx=0,sy=0,ox=0,oy=0,moved=false,pinch=0,suppress=false;
vp.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0&&e.button!==1)return;pts.set(e.pointerId,[e.clientX,e.clientY]);if(pts.size===1){pid=e.pointerId;sx=e.clientX;sy=e.clientY;ox=vx;oy=vy;moved=false}else if(pts.size===2){const p=[...pts.values()];pinch=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1])}});
vp.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,[e.clientX,e.clientY]);if(pts.size===2){const p=[...pts.values()];const d=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);if(pinch>0&&d>0)zoomAt((p[0][0]+p[1][0])/2,(p[0][1]+p[1][1])/2,d/pinch);pinch=d;moved=true}else if(e.pointerId===pid){const dx=e.clientX-sx,dy=e.clientY-sy;if(!moved&&Math.hypot(dx,dy)>4){moved=true;try{vp.setPointerCapture(pid)}catch{}vp.classList.add('panning')}if(moved){vx=ox+dx;vy=oy+dy;apply()}}});
const lift=e=>{if(!pts.delete(e.pointerId))return;if(pts.size<2)pinch=0;if(e.pointerId===pid){pid=null;if(moved)suppress=true;vp.classList.remove('panning')}};
vp.addEventListener('pointerup',lift);vp.addEventListener('pointercancel',lift);
vp.addEventListener('click',e=>{if(suppress){suppress=false;e.preventDefault();e.stopPropagation()}},true);
document.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey)return;if(e.target instanceof Element&&e.target.closest('.spec'))return;const k=e.key;if(k==='ArrowLeft')vx+=64;else if(k==='ArrowRight')vx-=64;else if(k==='ArrowUp')vy+=64;else if(k==='ArrowDown')vy-=64;else if(k==='+'||k==='='){zoomCenter(1.25);e.preventDefault();return}else if(k==='-'||k==='_'){zoomCenter(.8);e.preventDefault();return}else if(k==='0'){fit();e.preventDefault();return}else return;apply();e.preventDefault()});
document.addEventListener('focusin',e=>{const el=e.target;if(!(el instanceof Element)||el.closest('.spec'))return;const b=el.getBoundingClientRect(),r=vp.getBoundingClientRect(),m=24;let dx=0,dy=0;if(b.left<r.left+m)dx=r.left+m-b.left;else if(b.right>r.right-m)dx=r.right-m-b.right;if(b.top<r.top+m)dy=r.top+m-b.top;else if(b.bottom>r.bottom-m)dy=r.bottom-m-b.bottom;if(dx||dy){vx+=dx;vy+=dy;apply()}});
vp.addEventListener('scroll',()=>{vp.scrollLeft=0;vp.scrollTop=0});
document.querySelector('#zoom-in').addEventListener('click',()=>zoomCenter(1.25));document.querySelector('#zoom-out').addEventListener('click',()=>zoomCenter(.8));document.querySelector('#fit').addEventListener('click',fit);
fit()})();</script></body></html>\n`;
  return new TextEncoder().encode(html).byteLength <= CLI_MAX_RENDERED_BYTES
    ? Object.freeze({ html, ok: true as const })
    : Object.freeze({ ok: false as const });
}
