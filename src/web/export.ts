import type { ApplicationOperations, BlueprintExportItem } from "../application/index.ts";
import type { StaticBlueprintSnapshot } from "./client/api.ts";
import type { WebFrontend } from "./server.ts";

const EXPORT_PAGE_LIMIT = 100;
const EXPORT_MAX_PAGES = 25;
const EXPORT_MAX_COMPONENTS = EXPORT_PAGE_LIMIT * EXPORT_MAX_PAGES;
const EXPORT_MAX_HTML_BYTES = 16 * 1_048_576;

export interface StaticBlueprintBundle {
  readonly bytes: number;
  readonly componentCount: number;
  readonly generation: number;
  readonly html: string;
}

export type StaticBlueprintBundleOutcome =
  | { readonly ok: true; readonly value: StaticBlueprintBundle }
  | {
      readonly diagnostic: { readonly code: string; readonly message: string };
      readonly ok: false;
    };

interface FrontendAssets {
  readonly document: string;
  readonly scripts: readonly string[];
  readonly stylesheets: readonly string[];
}

function failed(code: string, message: string): StaticBlueprintBundleOutcome {
  return Object.freeze({ diagnostic: Object.freeze({ code, message }), ok: false as const });
}

function canonicalJson(value: unknown): string {
  const active = new WeakSet<object>();
  const encode = (candidate: unknown, depth: number): string => {
    if (depth > 100) throw new TypeError("Snapshot JSON exceeds its depth bound");
    if (candidate === null || typeof candidate === "boolean" || typeof candidate === "string") {
      return JSON.stringify(candidate);
    }
    if (typeof candidate === "number") {
      if (!Number.isFinite(candidate))
        throw new TypeError("Snapshot JSON contains a non-finite number");
      return String(candidate);
    }
    if (typeof candidate !== "object" || candidate === undefined) {
      throw new TypeError("Snapshot JSON contains an unsupported value");
    }
    if (active.has(candidate)) throw new TypeError("Snapshot JSON contains a cycle");
    active.add(candidate);
    try {
      if (Array.isArray(candidate)) {
        return `[${candidate.map((entry) => encode(entry, depth + 1)).join(",")}]`;
      }
      const fields = Object.keys(candidate)
        .sort()
        .flatMap((key) => {
          const field = (candidate as Record<string, unknown>)[key];
          return field === undefined ? [] : [`${JSON.stringify(key)}:${encode(field, depth + 1)}`];
        });
      return `{${fields.join(",")}}`;
    } finally {
      active.delete(candidate);
    }
  };
  return encode(value, 0);
}

function tagAttribute(tag: string, name: string): string | undefined {
  return new RegExp(`\\b${name}=["']([^"']+)["']`, "i").exec(tag)?.[1];
}

async function loadFrontendAssets(frontend: WebFrontend): Promise<FrontendAssets> {
  const server = Bun.serve({
    development: false,
    hostname: "127.0.0.1",
    port: 0,
    reusePort: false,
    routes: { "/": frontend },
    fetch: () => new Response("Not found", { status: 404 }),
  });
  try {
    const origin = `http://127.0.0.1:${server.port}/`;
    const documentResponse = await fetch(origin);
    if (!documentResponse.ok) throw new Error("Embedded document is unavailable");
    const document = await documentResponse.text();
    const styleTags = [...document.matchAll(/<link\b[^>]*>/gi)]
      .map((match) => match[0])
      .filter((tag) => /\brel=["']stylesheet["']/i.test(tag));
    const scriptTags = [
      ...document.matchAll(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*><\/script>/gi),
    ].map((match) => match[0]);
    if (styleTags.length === 0 || scriptTags.length === 0) {
      throw new Error("Embedded client assets are missing");
    }
    const readAssets = async (tags: readonly string[], attribute: "href" | "src") =>
      Promise.all(
        tags.map(async (tag) => {
          const locator = tagAttribute(tag, attribute);
          if (locator === undefined) throw new Error("Embedded client asset locator is missing");
          const response = await fetch(new URL(locator, origin));
          if (!response.ok) throw new Error("Embedded client asset is unavailable");
          return response.text();
        }),
      );
    const [stylesheets, scripts] = await Promise.all([
      readAssets(styleTags, "href"),
      readAssets(scriptTags, "src"),
    ]);
    let shell = document;
    for (const tag of [...styleTags, ...scriptTags]) shell = shell.replace(tag, "");
    return Object.freeze({ document: shell, scripts, stylesheets });
  } finally {
    await server.stop(true);
  }
}

export function assembleStaticBlueprintHtml(
  assets: FrontendAssets,
  snapshot: StaticBlueprintSnapshot,
): string {
  const snapshotJson = canonicalJson(snapshot)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
  const styles = assets.stylesheets
    .map((stylesheet) => `<style>${stylesheet.replaceAll("</style", "<\\/style")}</style>`)
    .join("");
  const scripts = assets.scripts
    .map(
      (script) => `<script type="module">${script.replaceAll("</script", "<\\/script")}</script>`,
    )
    .join("");
  const policy =
    "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; font-src data:";
  const withoutAssets = assets.document
    .replace(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>\s*/gi, "")
    .replace(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*><\/script>\s*/gi, "");
  const withoutPolicy = withoutAssets.replace(
    /<meta\b[^>]*\bhttp-equiv=["']Content-Security-Policy["'][^>]*>\s*/gi,
    "",
  );
  const withPolicy = withoutPolicy.replace(
    /<head>/i,
    `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
  );
  return withPolicy
    .replace("</head>", () => `${styles}\n  </head>`)
    .replace(
      "</body>",
      () =>
        `<script>globalThis.__GROMA_BLUEPRINT_SNAPSHOT__=${snapshotJson};</script>${scripts}\n  </body>`,
    )
    .replace("<body>", '<body data-groma-export="read-only">');
}

async function captureSnapshot(
  operations: ApplicationOperations,
): Promise<
  | { readonly ok: true; readonly value: StaticBlueprintSnapshot }
  | { readonly diagnostic: { readonly code: string; readonly message: string }; readonly ok: false }
> {
  const items: BlueprintExportItem[] = [];
  let cursor: string | undefined;
  let generation: number | undefined;
  for (let pageNumber = 0; pageNumber < EXPORT_MAX_PAGES; pageNumber += 1) {
    const result = await operations.exportBlueprint({
      ...(cursor === undefined ? {} : { cursor }),
      limit: EXPORT_PAGE_LIMIT,
    });
    if (!result.ok) {
      const diagnostic = result.diagnostics[0];
      return {
        diagnostic: {
          code: diagnostic?.code ?? "web-export-read-failed",
          message: diagnostic?.message ?? "The bounded blueprint snapshot could not be read",
        },
        ok: false,
      };
    }
    const pageGeneration = Number(result.value.generation);
    if (generation !== undefined && generation !== pageGeneration) {
      return {
        diagnostic: {
          code: "web-export-generation-changed",
          message: "The blueprint changed while its export snapshot was being read",
        },
        ok: false,
      };
    }
    generation = pageGeneration;
    items.push(...result.value.items);
    if (items.length > EXPORT_MAX_COMPONENTS) {
      return {
        diagnostic: {
          code: "web-export-bound-exceeded",
          message: `The export exceeds the supported ${EXPORT_MAX_COMPONENTS}-component snapshot bound`,
        },
        ok: false,
      };
    }
    if (!result.value.hasMore) {
      return {
        ok: true,
        value: Object.freeze({
          format: "groma-read-only-blueprint-v1" as const,
          generation: generation ?? 0,
          items: Object.freeze([...items]),
        }),
      };
    }
    if (result.value.nextCursor === undefined) {
      return {
        diagnostic: {
          code: "web-export-read-failed",
          message: "The bounded blueprint snapshot did not provide its continuation cursor",
        },
        ok: false,
      };
    }
    cursor = String(result.value.nextCursor);
  }
  return {
    diagnostic: {
      code: "web-export-bound-exceeded",
      message: `The export exceeds the supported ${EXPORT_MAX_COMPONENTS}-component snapshot bound`,
    },
    ok: false,
  };
}

/**
 * Repackage the already embedded React client with one finite shared-read snapshot.
 * The temporary loopback listener only exposes the executable's build assets while
 * they are inlined; the resulting file contains no server address or network path.
 */
export async function renderStaticBlueprintBundle(options: {
  readonly frontend: WebFrontend;
  readonly operations: ApplicationOperations;
}): Promise<StaticBlueprintBundleOutcome> {
  const captured = await captureSnapshot(options.operations);
  if (!captured.ok) return Object.freeze(captured);
  let assets: FrontendAssets;
  try {
    assets = await loadFrontendAssets(options.frontend);
  } catch {
    return failed("web-export-assets-unavailable", "The embedded web client could not be prepared");
  }
  let html: string;
  try {
    html = assembleStaticBlueprintHtml(assets, captured.value);
  } catch {
    return failed(
      "web-export-render-failed",
      "The bounded blueprint snapshot could not be rendered",
    );
  }
  const bytes = new TextEncoder().encode(html).byteLength;
  if (bytes > EXPORT_MAX_HTML_BYTES) {
    return failed(
      "web-export-bound-exceeded",
      `The self-contained export exceeds the supported ${EXPORT_MAX_HTML_BYTES}-byte artifact bound`,
    );
  }
  return Object.freeze({
    ok: true as const,
    value: Object.freeze({
      bytes,
      componentCount: captured.value.items.length,
      generation: captured.value.generation,
      html,
    }),
  });
}
