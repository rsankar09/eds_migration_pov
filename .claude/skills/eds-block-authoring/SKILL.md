---
name: eds-block-authoring
description: For EDS components approved as "extend" or "new" in a block mapping, extract style tokens from the captured source styles and author or modify the actual block code (decorate.js + CSS + model partial) in the target EDS repo, then verify the rendered block against the original — measured numerically on both authoring surfaces, not just eyeballed against the screenshot. Use this once a block mapping has been human-approved and only for entries whose verdict is extend or new — reused blocks don't need this skill. Always leave extend/new block code as a reviewable diff or branch; never merge/commit directly without a code review gate.
compatibility: requires an approved mapping.json with extend/new verdicts; the capture bundle (measured rects, styles.json, screenshots); write access to the target EDS repo; a local EDS dev server or equivalent render harness; a headless browser for measuring rects and computed styles, not only for screenshots
---

# EDS block authoring

Turns an approved "extend" or "new" verdict into real block code, checked
against the original design.

## Inputs

- Approved `mapping.json` entries where `verdict` is `extend` or `new`.
- The capture bundle's `styles.json` and `screenshots/*.png` for the
  corresponding component.
- Target EDS repo (write access, ideally on a feature branch).
- **Which authoring surfaces the project targets.** Establish this before
  writing code, not after: it determines the markup `decorate()` receives
  (step 3). A `scripts/editor-support.js`, a `component-models.json`, or
  `_<block>.json` partials all mean Universal Editor is live and is probably
  the primary surface — in which case local document-shaped drafts are a test
  harness, not the contract.

## Process

### 1. Extract and normalize style tokens

From `styles.json`, pull the component's colors, spacing values, font
family/size/weight, and breakpoint-specific layout changes. Before inventing
new CSS custom properties, check the repo's existing token file (commonly
`styles/styles.css`) for a close match (e.g. a captured `#1a73e8` that's
within a few steps of an existing `--link-color`) — reuse the existing token
rather than duplicating it. Only propose new tokens for values with no
reasonable match.

### 2. Read before you write

Before authoring anything, open 2–3 existing blocks in the repo to learn
local conventions: how `decorate()` is typically structured, naming patterns,
how CSS files reference tokens, and how variants are usually expressed (extra
class on the block wrapper is the common EDS pattern).

### 3. Derive the markup contract from the model, before writing any JS

`decorate()`'s input is not a free choice — it is produced by the model
partial's field groups, and it differs per authoring surface. Work that out
first and write it down, because the alternative is discovering it from
whichever test content happens to exist, which is how a block ends up handling
exactly one of the two shapes.

**Read [references/authoring-contract.md](references/authoring-contract.md)
now.** It is the normative source for the grouping rules, the two DOM shapes,
and the verification gates — this skill points there rather than restating
them, so there is one copy to keep true. A repo hook also injects it when
block-authoring skills are invoked, including Adobe's `building-blocks`, so
the rules apply whichever entry point is used.

Then, for this component: design the model partial's fields (or read the
existing one for an `extend`), sketch the literal DOM each surface will
deliver, and write `decorate()` against **whichever parts are common to both**
— usually the cells — rather than against either shape's row structure.

Record the sketch in the handoff. It is the block's actual contract, and the
thing a reviewer needs in order to tell correct from accidentally-working.

Produce the editor-shaped fixture here too, while the model is in front of
you — step 6 needs it, and writing it now is what forces the contract to be
concrete rather than assumed.

### 4a. New block

Scaffold `/blocks/<name>/<name>.js`, `<name>.css`, and `_<name>.json`, then
run the repo's JSON aggregation step (commonly `npm run build:json`). A block
without a model partial is invisible to authors in Universal Editor — it is
not optional.

**Registering the model is only half of it: add the block to the section
filter too** (commonly `models/_section.json`'s `filters` entry). A block with
a perfect partial that is not listed there cannot be inserted into a section
at all — it is just as unreachable as one with no partial, and it fails the
same silent way: the code is right, renders fine in a local draft, and the
author simply has no way to place it. Assert it after aggregating:

```sh
# the block must appear in the section filter's components
jq -r '.filters[] | select(.id=="section") | .components' component-filters.json
```

- `decorate(block)` restructures the authored markup into the final DOM (see
  repo conventions from step 2 — don't reinvent the pattern).
- CSS uses the normalized tokens from step 1.
- Match the component's responsive behavior across the **union** of the
  captured breakpoints and the project's own CSS breakpoints — see the
  contract; they are usually disjoint sets, and the project's are where this
  repo's layout actually switches.

**Implement the step 3 contract: read cells, not rows.** Anything anchored to
`block.firstElementChild` or `[...row.children]` silently processes half the
block on one of the two surfaces — and the failure is quiet. The unclassified
half keeps its authored markup, so every CSS rule scoped to the class you
meant to add is simply dead: the block renders unstyled rather than throwing,
and a console check finds nothing.

Read cells directly and normalize:

```js
const cells = [...block.querySelectorAll(':scope > div > div')];
const row = document.createElement('div');
cells.forEach((cell) => { /* classify, then row.append(cell) */ });
block.replaceChildren(row);
```

Normalize to the shape the CSS needs, which is not always a single row. If the
block itself is the flex/grid container, its panes have to stay *its own
children* — collapsing them into one row gives the container a single child
and the layout dies. Check two things before choosing where a class lands:
which element the layout container's children are, and whether any selector
reaches *through* that element (a `.pane > div` padding rule breaks silently
if you move the class from the wrapper onto the cell it used to contain).

Two consequences to handle while you're there:

- **Don't rely on cell order.** It follows model field order in the editor and
  column order in a document. If a variant means "media on the left", set
  `order` explicitly for *both* variants rather than letting one fall through
  to DOM order.
- **Check how the project re-decorates before assuming anything about
  idempotency.** In the standard boilerplate, `editor-support.js` inserts a
  *fresh server-rendered* block per content change, decorates that, and removes
  the old one — so `decorate()` never runs on its own output, and writing
  idempotency machinery on the belief that it does is wasted work built on a
  false premise. Read the project's `editor-support.js` and confirm which it
  does. It matters most for blocks that rebuild their own DOM (`block
  .replaceChildren(ul)`): those break badly if re-run and are completely fine
  if not. Prefer `classList.toggle(name, condition)` over `add` regardless —
  it states the current content either way and costs nothing.

**Never hardcode an image `aspect-ratio` as a stand-in for intrinsic
dimensions.** It reads as a layout-stability fix and behaves as a crop: any
asset whose real ratio differs is silently cut, at every breakpoint. The
platform's image helpers typically copy only `src` and `alt`, so carry
`width`/`height` across onto the optimized image, and publish the real ratio
to CSS as a custom property with the measured design ratio as the fallback.

### 4b. Extend existing block

- Add a variant class (e.g. `cards.horizontal`) rather than branching the
  base `decorate()` logic, unless the gap requires new DOM structure the
  existing function can't produce.
- Confirm the change doesn't alter output for existing usages of the block —
  check other pages/blocks that already reference it if you can find them.

### 5. Verify numerically, then visually

Screenshot comparison alone is not enough — a side-by-side at a glance hides
exactly the errors this step exists to catch. Measure first.

Render the block (local EDS dev server, or an equivalent minimal harness) and
read back `getBoundingClientRect()` plus the computed styles you care about at
every breakpoint in the union set (captured ∪ the project's own `@media`
widths). Compare against the measured rects in the
capture bundle, not against your reading of the screenshot.

**Report both axes for every element you check.** A verification table with
only `x` and `w` columns is not a verification — full-bleed failures, wrong
image crops, and stray section padding are all purely vertical, so an x/w
table reports "strong match" on a block that is visibly wrong. Every row needs
`x, y, w, h`, and any element you claim matches needs a source number beside
it:

| element | source (x,y,w,h) | rendered (x,y,w,h) | Δ |
|---|---|---|---|

Specific things the numbers catch that the eye does not:

- **Band heights and full-bleed panes.** Check whether the source's media pane
  fills its band's full height or sits at its own intrinsic ratio. If the band
  height is a fixed design unit, confirm it is constant in the capture across
  *all* instances of the component regardless of their copy length — then
  implement it as `min-height`, so longer authored copy grows the band instead
  of overflowing it.
- **Section-level spacing.** Section styles in the repo may add vertical
  padding or margin the source band does not have. Compare consecutive
  components' `y` offsets in the capture: if they are exactly one band-height
  apart, the bands are contiguous and the section must contribute nothing.
- **Leading.** Line-height is a computed length, so it can be matched exactly
  and is worth matching even when the font itself is unavailable. Hold it as a
  ratio rather than a length so a theme rescale keeps it proportional.

Then screenshot at each breakpoint and diff against the original crop, and
confirm no horizontal overflow (`documentElement.scrollWidth` equals the
viewport at every breakpoint).

### 6. Verify on both authoring surfaces

Geometry verified on one surface tells you nothing about the other, because
the delivered row structure differs (see step 3). Before calling the block done,
render it **both** ways and confirm the measurements are identical:

1. The document-authored shape (a local drafts page, or real content).
2. The Universal Editor shape — one row per model field group.

If you cannot reach an author instance, build the editor-shaped markup by hand
from the model partial's field groups as a local fixture and measure that. Keep
it as a regression page if the repo has somewhere sensible to put it: this bug
class is invisible without one, and it does not announce itself as an error.

Confirm on both: the expected classes are actually applied to every cell, the
CTA/button decoration ran, and the geometry matches the numbers from step 5.

### 7. Lint/build

Run whatever lint/build step the repo defines before considering the block
done, including the model-partial aggregation step from 4a. Delete any
throwaway verification scripts first — a linter that reports the repo as dirty
because of your own scratch files buries real findings.

## Output

A branch/diff containing the new or modified block files and model partial,
plus a verification report attached to the same component id from
`mapping.json`, containing:

- The numeric table from step 5 (`x, y, w, h` per element, per breakpoint,
  source beside rendered).
- Confirmation that both authoring surfaces were measured (step 6).
- Before/after screenshots.
- Remaining gaps, stated as gaps.

### Separate code gaps from content and licensing gaps

Some mismatches cannot be fixed in block code. Report them as blocked, name
what would unblock them, and do not compensate for them in CSS:

- **Unavailable fonts.** Captured `font-family` values are frequently licensed
  webfonts absent from the target repo. A fallback stack has different metrics,
  so headings wrap at different points and no amount of tracking or size
  tweaking fixes it — it just bakes in compensation that breaks when the real
  font arrives. Report the exact families the capture names.
- **Assets wrong for the component.** An author can put any asset in any slot.
  If the ratio is far from what the design implies, the block will upscale and
  cover-crop it. Report the asset's real dimensions and the ratio the component
  expects, rather than reshaping the block around one bad asset.
- **Deliberate deviations.** Breakpoints snapped to the project's standard set
  rather than the source's, tokens reused instead of duplicated, and similar
  choices. State the resulting numeric difference so a reviewer can accept it
  knowingly instead of discovering it later.

## Human gate

Code review / PR approval before merge — this skill produces a proposal, not
a finished merge.
