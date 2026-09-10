---
name: eds-block-authoring
description: For EDS components approved as "extend" or "new" in a block mapping, author or modify the real block code in the target EDS repo — decorate() JS, CSS written against the derived design tokens, and the `_{block}.json` component model that makes the block authorable in Universal Editor — then visually verify the rendered block against the original screenshot. Use this once a block mapping has been human-approved and only for entries whose verdict is extend or new. Always leave extend/new block code as a reviewable diff or branch; never merge/commit directly without a code review gate.
compatibility: requires an approved mapping.json with extend/new verdicts; the capture bundle (styles.json, css/matched.css, behavior.json, screenshots); the design-system tokens; write access to the target EDS repo; a local EDS dev server; Playwright for screenshot diffing
---

# EDS block authoring

Turns an approved "extend" or "new" verdict into real block code, checked
against the original design.

A finished block is **three** artefacts, not two. Shipping `.js` + `.css`
without the model partial produces a block that renders correctly and that no
author can place or configure — which has happened on this project before.

## Inputs

- Approved `mapping.json` entries with verdict `extend` or `new`, each
  carrying a `content_model` and a `behavior_contract`.
- The component's slice of the capture: its `css_node_ids`, the matching
  rules in `css/matched.css`, its `behavior` entry, its screenshot crop.
- `design-system.css` / `design-system.json` from `eds-design-system`.

## Process

### 1. Read before you write

Open 2–3 existing blocks in the repo and learn local conventions: how
`decorate()` is structured, naming patterns, how CSS references tokens, how
variants are expressed (an extra class on the block wrapper is the common EDS
pattern), and how an existing `_{block}.json` is shaped. Don't reinvent the
pattern.

### 2. Take the styling from the source CSS, not from the screenshot

Filter `css/index.json` to rules whose `nodes` intersect the component's
`css_node_ids`, or read the corresponding section of `css/matched.css`. That
gives you the real declarations — including `:hover`/`:focus` states and the
`@media` variants — instead of values eyeballed from an image.

Then express them in tokens:

- Reference `var(--token)` from the design system wherever a value matches.
- If a value has no token and is genuinely shared, it belongs in the design
  system, not inlined here — go add it.
- Only block-local values stay literal in the block CSS.

Match the source's own breakpoints (in `design-system.json`), and follow the
repo's mobile-first `min-width` convention when they're compatible.

### 3a. New block

Scaffold three files under `/blocks/<name>/`:

- **`<name>.js`** — `export default function decorate(block)`, restructuring
  the authored table markup into the final DOM.
- **`<name>.css`** — token-based, all selectors scoped to `.<name>`; never
  `.<name>-container` or `.<name>-wrapper`, which are section-level.
- **`_<name>.json`** — `definitions`, `models`, `filters` from the mapping's
  `content_model`. Variants go in one `classes` select field with an option
  per variant; repeating content is authored as rows, not numbered fields.

### 3b. Extend an existing block

- Add a variant class rather than branching the base `decorate()`, unless the
  gap needs DOM the existing function can't produce.
- **Add the variant to the block's `_{block}.json` too** — a `classes` option
  the author can pick. A variant that exists only in CSS is unreachable.
- Confirm output is unchanged for existing usages; check other pages that
  already use the block.

### 4. Implement the behaviour, don't approximate it

Work from the `behavior_contract`:

- `interactions` entries give you the real state change — which attribute or
  class flipped, on which target. Reproduce that contract, using semantic
  ARIA (`aria-expanded`, `aria-selected`, `aria-controls`) even when the
  source used class toggles.
- `css_hover` entries mean the source needed **no JS**. Reproduce them in CSS
  and add keyboard/focus equivalents — a hover-only menu is not accessible,
  and this is the right moment to fix it.
- `rotators` carry `autoplay`, `approx_interval_ms`, `has_dots`,
  `has_prev_next`. Honour `prefers-reduced-motion` and give autoplay a pause
  control regardless of what the source did.
- An empty behaviour slice on a component that looks interactive usually
  means it's statically rendered. Confirm against `dom-expanded.html` before
  writing JS nobody needs.

### 5. Regenerate and lint the models

```bash
npm run build:json   # regenerates component-definition/models/filters.json
npm run lint         # eslint (incl. eslint-plugin-xwalk) + stylelint
```

Both are required. `build:json` is what actually makes the model reach
Universal Editor; skipping it leaves the aggregate JSON stale and the block
unusable in the editor even though the partial looks right.

### 6. Verify visually

Render the block on the local dev server (`aem up`, plus a draft HTML file if
no authored content exists yet) and screenshot at the same breakpoints as the
capture. Diff against the component's crop from `screenshots/`.

Iterate on CSS until the diff is within tolerance. Where a gap remains and is
a deliberate simplification rather than a bug, say so explicitly in the
report — don't leave it silent.

Check the browser console at every breakpoint; a block that renders correctly
and throws is not done.

## Output

A branch/diff with the new or modified block files (**`.js`, `.css`, and
`_{block}.json`**, plus any `styles/styles.css` token additions), and a short
visual diff report: before/after screenshots, measured geometry, bugs found
and fixed, and remaining gaps — keyed to the `component_id` from
`mapping.json`.

## Human gate

Code review / PR approval before merge. This skill produces a proposal, not a
finished merge.
