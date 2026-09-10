---
name: eds-component-detect
description: Analyze a capture bundle (from eds-site-crawl) and produce a reviewed inventory of meaningful UI components — hero banners, card grids, tabs, accordions, carousels, tables, forms, nav, footer, CTA banners — as distinct from atomic text/image elements that don't need their own EDS block. Deduplicates components that recur across pages into one entry with variants, and attaches each component's style and behaviour slice. Use this after a site has been crawled and before any EDS block mapping is attempted. Always stop for human review of the inventory before handing off to eds-block-mapping — never auto-approve component boundaries.
compatibility: requires a capture bundle produced by eds-site-crawl; image viewing capability for screenshot crops
---

# EDS component detection

Classifies a site's DOM into the *composite* components that deserve their own
EDS block, filtering out plain text/image leaves that don't — and recognises
when the same component appears on several pages.

See `references/component-taxonomy.md` for the full type list and per-type
detection heuristics before you start — read it, don't guess at the taxonomy.

## Inputs

A capture bundle: `capture/index.json` plus, per page, `dom.html`,
`dom-expanded.html`, `styles.json`, `css/index.json`, `behavior.json`,
`assets.json`, `screenshots/*.png`.

Work across **all** captured pages at once. Detecting per page in isolation is
what produces four slightly different card blocks for one design.

## Process

### 1. Propose candidate boundaries

From DOM structure: repeated sibling patterns (3+ similarly-shaped siblings →
grid/list), semantic tags (`nav`, `header`, `footer`, `table`, `form`), ARIA
roles (`role="tablist"`, `aria-expanded` siblings → tabs/accordion), and known
class-name fragments (`carousel`, `swiper`, `slider`, `testimonial`,
`accordion`).

Read `dom-expanded.html`, not just `dom.html`, when the component has hidden
state — a mega-menu's second level or a closed accordion panel only exists in
the expanded dump.

### 2. Reject atomic leaves

A single heading + paragraph, or one image with a caption and no
repeating/interactive structure, is not a component — it's page content. Ask:
would this need its own `decorate()` in EDS, or does it already work as a
plain paragraph/image in the default content flow? If the latter, exclude it.

Skip anything inside a `data-eds-third-party` subtree; those are listed in
`third-party.json` and are never page content.

### 3. Give each component a cross-page identity

For each candidate compute a `component_key`: a structural fingerprint of its
tag/role skeleton, ignoring text content and page-specific classes. Candidates
sharing a key across pages are **one** inventory entry with `pages: [...]`,
not several.

Where instances of one key differ meaningfully — a card grid that's 3-up on
one page and 4-up on another, a hero with and without an image — record the
difference as a `variants` entry rather than splitting the component. Variants
become the block's variant classes downstream; splitting them becomes
duplicate blocks.

### 4. Attach the style and behaviour slice

Every captured node carries a `data-eds-id`. Use the ids inside a component's
subtree to pull:

- its computed styles from `styles.json`,
- the source rules that target it from `css/index.json` (filter `rules[].nodes`
  for those ids) — including `:hover` states and `@media` variants,
- any entries in `behavior.json` whose `node_id` or `target_ids` fall inside
  it, plus matching `css_hover` rules and `rotators`.

Record these as `css_node_ids` and `behavior` on the entry. This is what lets
block authoring reproduce the component instead of approximating it from a
screenshot.

### 5. Flag ambiguity

Overlapping boundaries, a component readable as two types, or low visual
confidence all get `"needs_review": true`. Flag rather than guess.

### 6. Emit `inventory.json` at the capture root

```json
[
  {
    "id": "cmp-003",
    "component_key": "ul>li*5>a",
    "type_guess": "card-grid",
    "confidence": 0.82,
    "needs_review": false,
    "pages": ["home", "agentbrokers-transamerica"],
    "variants": [
      { "name": "3-up", "pages": ["home"], "difference": "grid-template-columns: repeat(3, 1fr)" }
    ],
    "html_snippet": "<section class=\"...\">...</section>",
    "bounding_rect": { "x": 0, "y": 1240, "w": 1440, "h": 620 },
    "css_node_ids": ["n41", "n42", "n43"],
    "behavior": { "interactions": [], "css_hover": ["ul.menu li:hover > ul"], "rotators": [] },
    "assets": ["https://…/agent_3.jpg"],
    "screenshot_crop": "capture/home/crops/cmp-003.png",
    "breakpoint_variants": ["375", "768", "1440"]
  }
]
```

## Human gate — do not skip

Present the inventory as a list with each `screenshot_crop` thumbnail,
`type_guess`, and which pages it appears on. Ask the user to:

- confirm or relabel the type,
- merge entries that are really one component,
- split entries that bundle two,
- confirm the variant list — a variant that should be its own block, or two
  "components" that should be one block with a variant, is the single most
  expensive thing to get wrong here,
- drop false positives.

Only a confirmed inventory (all `needs_review: false`, all types confirmed)
goes to `eds-block-mapping`. Do not proceed on unconfirmed output even if
confidence looks high — this is the cheapest point in the pipeline to catch a
mistake, and every later stage compounds it.

## Handoff

Confirmed `inventory.json` feeds `eds-block-mapping`.
