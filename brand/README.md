# Groma brand

Groma is named after the Roman surveyor's cross-staff — the instrument that transferred architectural intent onto the ground. Every Roman city, road, and camp was laid out behind one. The people who used it were the *gromatici*; Groma's community name, **the Gromatics**, honors them.

## Assets

| File | What it is | Use it for |
|---|---|---|
| `mark-frontal.svg` | The primary glyph: staff, crossbar, two plumb lines, ground line | Avatars, favicons, app icons, anywhere small |
| `mark-topdown.svg` | The groma seen from above: a surveyor's cross over the sighted point | Alternative glyph; watermarks, stickers, loading marks |
| `mark-sightline.svg` | Frontal glyph plus one accent sight line hitting a surveyed point | Hero contexts, splash screens, docs headers |
| `lockup.svg` | Glyph + `groma` wordmark + `.md` suffix in the accent color | README header, website header, social banners |

The illustrated blueprint-style drawing (full instrument with four plumb lines, construction lines, and the sighted point) is the hero illustration for the website and launch material. It is an illustration, not a mark — never scale it below roughly 200 px.

## Rules

1. **Reduction system, not one logo.** The illustrated version is for hero surfaces only. Everything at or below 64 px uses `mark-frontal.svg`. The glyph must stay legible at 16 px — if a proposed variant fails at 16 px, it is not a mark.
2. **Match stroke weights.** The glyph's stroke weight and the wordmark's weight must read as one voice. Never pair a hairline mark with a heavy wordmark or vice versa.
3. **One accent color.** The accent is the sight line: teal `#1D9E75`. It marks the surveyed point — intent projected onto reality. Nothing else in the identity gets color. Structural strokes are `currentColor` (black on light, white on dark).
4. **The wordmark is lowercase.** The product is a CLI: `groma`. Prefer engineering-drawing faces (DIN-derived: DIN, Overpass, Archivo) over techno or sci-fi faces. The lockup in this folder uses a system-font placeholder — outline the final type before print or social use.
5. **`.md` is part of the brand.** The full name is `groma.md` — domain, npm package, and lockup. In the lockup the `.md` suffix is set in the accent teal. Use the bare glyph when space demands, but never set the wordmark as "Groma" title-case in product surfaces.
6. **Clear space.** Keep at least the width of the crossbar's plumb-line drop (roughly 25% of the glyph height) free around the mark.

## Don't

- Don't add gradients, shadows, or 3D effects to the marks.
- Don't recolor the structural strokes; only the sight line and surveyed point carry the accent.
- Don't use the illustrated hero version as an avatar or favicon.
- Don't rotate the frontal mark; the plumb lines hang — gravity is part of the meaning.
- Don't set the wordmark in title case or add spacing between `groma` and `.md`.

## Dark backgrounds

The marks use `currentColor`, so they invert cleanly when inlined in HTML/CSS. When embedding as `<img>` on GitHub, use a `<picture>` element with `prefers-color-scheme` and the `*-dark.svg` variants in this folder (same geometry, strokes fixed to `#F0EFEA`). The dark variants are generated from the sources — edit the source, then regenerate.
