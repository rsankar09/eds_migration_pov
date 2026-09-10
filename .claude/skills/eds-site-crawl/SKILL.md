---
name: eds-site-crawl
description: Crawl a website (single URL, list of URLs, or sitemap) and produce a structured capture bundle — rendered DOM with stable node ids, computed styles, the source CSS that matches those nodes, a probe of the page's interactive behaviour, an asset manifest and multi-breakpoint screenshots — as the input for EDS (Edge Delivery Services) migration analysis. Use this whenever the user gives a URL and wants it migrated to EDS, wants a site "scanned" or "analyzed" for migration, or asks to capture/inventory a page's markup, styles or behaviour before component detection. Always run this first in an EDS migration pipeline, before eds-design-system and eds-component-detect.
compatibility: requires Playwright with a Chromium binary (`npx playwright install chromium`); bash/file tools
---

# EDS site crawl

Turns a URL into a self-contained capture bundle that every later skill
reasons over, without re-fetching the live site.

**Do not hand-roll a crawler.** `scripts/capture.mjs` in this skill folder is
the capture engine. It is site-agnostic: every heuristic keys off standard
HTML/ARIA/CSS signals, never off one CMS's class names. Run it, then read its
output.

## Run it

```bash
node .claude/skills/eds-site-crawl/scripts/capture.mjs \
  --url https://example.com/page \
  --out capture
```

| Option | Purpose |
|---|---|
| `--url <u>` | page to capture, repeatable |
| `--urls <file>` | newline-delimited URL list |
| `--sitemap <u>` | expand a sitemap.xml |
| `--out <dir>` | output root (default `capture`) |
| `--slug <name>` | force the folder name (single-URL runs) |
| `--breakpoints <csv>` | default `375,768,1440` |
| `--max-pages <n>` | cap after sitemap expansion (default 10) |
| `--storage <file>` | Playwright storageState JSON, for authenticated pages |
| `--no-interact` | skip the behaviour probe (faster, loses `behavior.json`) |

If given a sitemap, confirm the page count with the user before crawling
everything. Large sites should be **sampled one page per template**, not
crawled in full on a first pass — the engine emits a `structure_hash` per page
and groups them in `capture/index.json` under `templates` precisely so you can
do that. Crawl broadly once, then keep one slug per hash.

## What lands in the bundle

```
capture/
  index.json                  { pages, templates: { <hash>: [slugs] } }
  <page-slug>/
    meta.json                 url, title, counts, console errors, notes
    dom.html                  serialized DOM, every element carrying data-eds-id
    dom-expanded.html         same, after every toggle/summary was opened
    styles.json               per-node computed style + geometry + own_text
    css/index.json            matched rules, @media, keyframes, @font-face, :root vars
    css/matched.css           the same rules as readable CSS, grouped by media
    behavior.json             js interaction probe + css-only hover + rotators
    assets.json               every image/video/document URL, with alt and size
    third-party.json          consent/chat/tag-manager subtrees that were excluded
    tokens-raw.json           style-value histograms
    screenshots/375.png 768.png 1440.png
```

Three things make this bundle joinable, and every later skill depends on them:

- **`data-eds-id`** — the same `n<N>` id appears in `dom.html`, in
  `styles.json`, in `css/index.json`'s `nodes` array, in `behavior.json` and in
  `assets.json`. That is how you go from "this element" to "its computed
  style, its source CSS rules, and its behaviour" without guessing selectors.
- **`own_text`** — text a node paints *itself*, as opposed to text inherited
  from descendants. Attribute a colour or size to a node only when its
  `own_text` is non-empty; using `text_preview` credits every ancestor with
  its children's text and skews the result.
- **`css/matched.css`** — the source's real declarations, including
  `:hover`/`:focus` states, media queries and keyframes. Read this when
  authoring a block, rather than re-deriving styling from screenshots.

## After the run, verify before moving on

Read `meta.json` for each page and check:

- **`counts.styled_nodes` near zero** → the page rendered behind auth, a bot
  wall or a client-side framework that never settled. Re-run with `--storage`
  or a longer `--timeout`; don't pass an empty capture downstream.
- **`blocked_stylesheets` non-empty** → cross-origin CSS the browser wouldn't
  expose. Those rules are missing from `css/matched.css`; note it, because
  block authoring will have to fall back to computed styles for those nodes.
- **`console_errors`** → often means lazy content never loaded.
- **`third_party_excluded: 0` on a page that clearly has a cookie banner** →
  the pattern list in `markThirdParty()` missed it. Add the vendor to the
  pattern rather than deleting nodes by hand later.
- **`counts.interactions: 0`** → this is frequently *correct*. Statically
  rendered submenus, server-side tabs and CSS-only dropdowns produce no JS
  delta. Cross-check `behavior.json`'s `css_hover` and look at
  `dom-expanded.html` before concluding the probe failed.

Report to the user: pages captured, template groups found, and anything from
the list above.

## Edge cases

- **Auth-gated pages**: capture a `storageState` once (`npx playwright
  codegen --save-storage`) and pass `--storage`; don't capture login screens.
- **Infinite scroll**: the engine scrolls to the bottom once to trigger lazy
  loading. Genuinely infinite feeds are truncated — say so.
- **Consent banners**: dismissed automatically, and the residual markup is
  marked third-party so it never reaches the style walk or asset list.

## Handoff

The bundle feeds `eds-design-system` (site-wide tokens) and
`eds-component-detect` (per-page components). Keep it for the life of the
migration — mapping review, block authoring and final QA all re-open it.
