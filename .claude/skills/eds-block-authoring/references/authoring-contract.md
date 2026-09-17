# EDS block authoring — the markup contract

Normative rules for any block code written in this repo, whichever skill you
came in through. This file is the single source; the skills point here rather
than restating it.

## 1. Derive the contract before writing `decorate()`

`decorate()`'s input is produced by the model partial's field groups, and it
differs per authoring surface. Work it out and write it down first — otherwise
it gets inferred from whichever test content happens to exist, which is how a
block ends up handling exactly one of the two shapes.

For a model with an `image` group and a `copy_*` group:

```
Universal Editor                      Document authoring
block > div > div   (image)           block > div > div  (image)
block > div > div   (copy)                        > div  (copy)
  = 2 rows x 1 cell                     = 1 row x 2 cells
```

Grouping rules that make the shape predictable:

- Fields sharing a `prefix_` (`copy_heading`, `copy_description`, `copy_cta`)
  collapse into **one cell**; each separate group becomes its own **row** in
  the editor.
- Companion suffixes (`imageAlt`, `copy_ctaText`, `copy_headingType`) belong to
  their base field's group, not to a new one.
- `classes` is consumed as the block's variant on a block-level model, but
  arrives as a **cell** on a container's child item.
- For a container block (a `filter` plus a child component), the child items
  *are* the rows and each item's field groups are its cells. That shape is the
  same on both surfaces, so `[...block.children]` as items is correct there —
  do not "fix" it.

## 2. Read cells, not rows

Anything anchored to `block.firstElementChild` or `[...row.children]` silently
processes half the block on one surface. The failure is quiet: the unclassified
half keeps its authored markup, so the CSS scoped to the class you meant to add
is dead, the block renders unstyled, and nothing throws.

```js
const cells = [...block.querySelectorAll(':scope > div > div')];
```

Normalize to the shape the CSS needs — **not always a single row**. If the
block is itself the flex/grid container, its panes must stay its own children.
Before choosing where a class lands, check which element the layout container's
children are, and whether any selector reaches *through* it (a `.pane > div`
rule breaks silently if the class moves onto the cell it used to contain).

Cell order is not guaranteed either: it follows model field order in the editor
and column order in a document. If a variant means "media left", set `order`
for *both* variants rather than letting one fall through to DOM order.

## 3. Never hardcode an image `aspect-ratio` as a stand-in for dimensions

It reads as a layout-stability fix and behaves as a crop: any asset whose real
ratio differs is silently cut at every breakpoint. Platform image helpers
typically copy only `src` and `alt`, so carry `width`/`height` onto the
optimized image and publish the real ratio as a custom property with the
measured design ratio as the fallback.

Exception, and state it in a comment when you take it: a **grid** of cards
wants one uniform strip, so a fixed ratio there is the design, not a bug.

## 4. Verification gates

Before claiming a block matches:

- **Test the union of captured and project breakpoints.** The capture is
  whatever the crawler was told to use (commonly 375/768/1440); the project's
  own CSS switches somewhere else entirely (commonly 600/900/1200). Verifying
  only the captured set tests *none* of the widths where this repo's layout
  actually changes. Every responsive bug found in this project so far has
  lived in that gap — a carousel that overflowed the page by 12px at 900, and
  a grid whose content collapsed to 200px per column between 900 and 1200.
  Read the `@media` queries out of the CSS you touched and add them.
- **Measure both axes.** A table with only `x` and `w` is not a verification —
  full-bleed failures, wrong crops and stray section padding are all purely
  vertical. Report `x, y, w, h` per element per breakpoint, source beside
  rendered. Screenshot diffing alone does not catch these.
- **Check for horizontal overflow at every one of those widths**
  (`document.documentElement.scrollWidth` against the viewport). It is the
  cheapest assertion available and it catches fixed-width tracks, released
  wrappers and `100vw` mistakes that no visual comparison will show you.
- **Render both surfaces.** Geometry verified on one says nothing about the
  other. If no author instance is reachable, hand-build the editor-shaped
  fixture from the model's field groups and measure that.
- **Check `editor-support.js` before assuming anything about idempotency.** In
  the standard boilerplate it inserts a *fresh server-rendered* block per
  change and removes the old one, so `decorate()` never runs on its own output.

## 5. Report blocked gaps; do not compensate for them

Unavailable licensed fonts, assets with the wrong ratio for their slot, and
deliberate breakpoint deviations are not code defects. Name them and the
measured difference. Compensating in CSS bakes in a correction that has to be
unwound later.

## 6. A block is not done until it sits on the whole page

Component-scoped verification is necessary and not sufficient. A block
measured alone, on a fixture containing only itself, has not been tested
against the things that actually break pages:

- **Adjacency.** Band padding and section margins only resolve against
  neighbours. Whether two bands sit flush or 40px apart is invisible on a
  fixture with one band.
- **Shared globals.** A token or `decorateCta()` change is verified per block
  and regresses somewhere else.
- **Chrome.** Header and footer are a different content path (`getMetadata`
  → fragment). A console 404 for `/nav` can persist for an entire session,
  dismissed as a local-dev artifact, because no fixture ever needed the nav.
- **Missing components.** A page gap is invisible component-by-component: the
  mapping lists what is needed, but nothing forces it to exist until the whole
  page is composed.

So compose the page — every approved component in source order, plus header
and footer — and verify it as a page. That is `eds-page-assemble`, and it runs
before anything is uploaded anywhere.
